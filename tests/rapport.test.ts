import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { collecterDonneesHebdo, rendreHebdo, bornesSemaine, semaineCouranteIso } from "../src/rapport/hebdo.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const SEMAINE = "2026-W33"; // lundi 10/08/2026 au dimanche 16/08/2026
const MAINTENANT = new Date("2026-08-15T09:00:00.000Z");

function insererDemande(
  db: DbTemp["db"],
  overrides: Partial<{
    id: string;
    cree_le: string;
    maj_le: string;
    demandeur: string;
    equipe: string;
    expression_brute: string;
    reformulation: string | null;
    type: string;
    statut: string;
  }>
) {
  const v = {
    id: overrides.id ?? "dem1",
    cree_le: overrides.cree_le ?? "2026-08-11T10:00:00.000Z",
    maj_le: overrides.maj_le ?? overrides.cree_le ?? "2026-08-11T10:00:00.000Z",
    demandeur: overrides.demandeur ?? "Sophie",
    equipe: overrides.equipe ?? "CS",
    expression_brute: overrides.expression_brute ?? "texte brut",
    reformulation: overrides.reformulation ?? null,
    type: overrides.type ?? "evolution",
    statut: overrides.statut ?? "recue",
  };
  db.prepare(
    `INSERT INTO demandes (id, cree_le, demandeur, equipe, expression_brute, reformulation, type, statut, maj_le)
     VALUES (@id, @cree_le, @demandeur, @equipe, @expression_brute, @reformulation, @type, @statut, @maj_le)`
  ).run(v);
}

describe("bornes de semaine ISO", () => {
  it("2026-W33 couvre le 10/08 au 16/08 (lundi à dimanche)", () => {
    const { debut, fin } = bornesSemaine(SEMAINE);
    expect(debut.toISOString().slice(0, 10)).toBe("2026-08-10");
    expect(fin.toISOString().slice(0, 10)).toBe("2026-08-17");
  });

  it("semaineCouranteIso produit le format AAAA-Www", () => {
    expect(semaineCouranteIso(MAINTENANT)).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe("rapport hebdo — cas vides", () => {
  it("affiche « Aucun incident cette semaine. » sans incident", () => {
    contexte = creerDbTemp();
    const donnees = collecterDonneesHebdo(contexte.db, SEMAINE, MAINTENANT);
    const md = rendreHebdo(donnees);
    expect(md).toContain("Aucun incident cette semaine.");
  });

  it("affiche « Aucun point de vigilance ouvert. » sans constat", () => {
    contexte = creerDbTemp();
    const donnees = collecterDonneesHebdo(contexte.db, SEMAINE, MAINTENANT);
    const md = rendreHebdo(donnees);
    expect(md).toContain("Aucun point de vigilance ouvert.");
  });

  it("ne mentionne jamais un code de contrôle brut (ex: 'C1')", () => {
    contexte = creerDbTemp();
    contexte.db
      .prepare(
        `INSERT INTO changements (id, cree_le, description, perimetre, type, maj_le) VALUES
         ('ch1','2026-08-11T10:00:00.000Z','Désactivation relance','Module Devis','deluge','2026-08-11T10:00:00.000Z')`
      )
      .run();
    contexte.db
      .prepare(
        `INSERT INTO constats (id, cree_le, controle, entite, entite_id, consequence, statut) VALUES
         ('co1','2026-08-11T10:00:00.000Z','C1','changement','ch1','Aucun retour arrière déclaré : un incident sur ce changement se traitera en improvisation.','ouvert')`
      )
      .run();
    const donnees = collecterDonneesHebdo(contexte.db, SEMAINE, MAINTENANT);
    const md = rendreHebdo(donnees);
    expect(md).not.toMatch(/\bC1\b/);
    expect(md).toContain("Aucun retour arrière déclaré");
  });
});

describe("rapport hebdo — snapshot jeu de données fixe", () => {
  it("rend le rapport complet", () => {
    contexte = creerDbTemp();
    const db = contexte.db;

    insererDemande(db, {
      id: "dem1",
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "voir les factures dans la fiche client",
      cree_le: "2026-08-11T10:00:00.000Z",
      statut: "recue",
    });
    insererDemande(db, {
      id: "dem2",
      demandeur: "Marc",
      equipe: "ADV",
      expression_brute: "corriger le délai devis",
      reformulation: "corriger l'affichage du délai sur les devis",
      cree_le: "2026-07-20T08:00:00.000Z",
      statut: "qualifiee",
    });
    insererDemande(db, {
      id: "dem3",
      demandeur: "Julie",
      equipe: "Produit",
      expression_brute: "ajouter un champ",
      cree_le: "2026-08-12T08:00:00.000Z",
      maj_le: "2026-08-13T08:00:00.000Z",
      statut: "realisee",
    });
    insererDemande(db, {
      id: "dem4",
      demandeur: "Karim",
      equipe: "AE",
      expression_brute: "ouvrir un accès Zoho",
      cree_le: "2026-08-05T08:00:00.000Z",
      statut: "arbitree",
    });

    db.prepare(
      `INSERT INTO changements (id, cree_le, description, perimetre, type, rollback, test_effectue, maj_le) VALUES
       ('ch1','2026-08-12T14:00:00.000Z','Désactivation de la règle de relance','Module Devis','deluge',NULL,'testé avec Sophie','2026-08-12T14:00:00.000Z'),
       ('ch2','2026-08-13T09:00:00.000Z','Correction mapping API Books','Intégration Books','sql','réexécuter le script inverse','testé en sandbox','2026-08-13T09:00:00.000Z')`
    ).run();

    db.prepare(
      `INSERT INTO incidents (id, cree_le, symptome, impact, resolu_le, action_preventive, prevention_faite, maj_le) VALUES
       ('inc1','2026-08-12T15:00:00.000Z','Synchro devis en échec','Devis non transmis à la facturation','2026-08-12T18:00:00.000Z','Ajout d''une alerte de supervision',1,'2026-08-12T18:00:00.000Z')`
    ).run();

    db.prepare(
      `INSERT INTO constats (id, cree_le, controle, entite, entite_id, consequence, statut) VALUES
       ('co1','2026-08-12T14:00:00.000Z','C1','changement','ch1','Aucun retour arrière déclaré : un incident sur ce changement se traitera en improvisation.','ouvert')`
    ).run();

    db.prepare(
      `INSERT INTO decisions (id, cree_le, contexte, options, decision, decideur, statut, maj_le) VALUES
       ('dec1','2026-08-11T09:00:00.000Z','Champ Statut_Client modifiable partout','[{"option":"Lecture seule sauf Admin"}]','Lecture seule sauf Admin','CEO','validee','2026-08-11T09:00:00.000Z')`
    ).run();

    db.prepare(
      `INSERT INTO systemes (id, cree_le, nom, role, maj_le) VALUES
       ('sys1','2026-08-11T09:00:00.000Z','App Devis','Génération des devis','2026-08-11T09:00:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO modules (id, cree_le, systeme_id, nom, maj_le) VALUES
       ('mod1','2026-08-11T09:00:00.000Z','sys1','Devis','2026-08-11T09:00:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO champs (id, cree_le, module_id, nom, maj_le) VALUES
       ('ch_carte1','2026-08-11T09:00:00.000Z','mod1','Statut_Client','2026-08-11T09:00:00.000Z')`
    ).run();
    db.prepare(
      `INSERT INTO constats (id, cree_le, controle, entite, entite_id, consequence, statut) VALUES
       ('co2','2026-08-11T09:00:00.000Z','M1','champ','ch_carte1','Champ sans source de vérité : aucun arbitrage possible en cas d''écart entre systèmes.','ouvert')`
    ).run();

    const donnees = collecterDonneesHebdo(db, SEMAINE, MAINTENANT);
    const md = rendreHebdo(donnees);
    expect(md).toMatchSnapshot();
  });
});
