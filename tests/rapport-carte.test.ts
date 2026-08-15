import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { collecterDonneesEtatSi, rendreEtatSi } from "../src/rapport/etat-si.js";
import { rendreImpactMarkdown } from "../src/rapport/impact.js";
import { decrireSysteme } from "../src/tools/decrire-systeme.js";
import { decrireModule } from "../src/tools/decrire-module.js";
import { decrireChamp } from "../src/tools/decrire-champ.js";
import { decrireIntegration } from "../src/tools/decrire-integration.js";
import { genererRapport } from "../src/tools/generer-rapport.js";
import { impact } from "../src/tools/impact.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const MAINTENANT = new Date("2026-08-15T09:00:00.000Z");

describe("rapport etat_si", () => {
  it("liste systèmes, couverture des modules, intégrations, sur jeu de données vide", () => {
    contexte = creerDbTemp();
    const md = rendreEtatSi(collecterDonneesEtatSi(contexte.db), MAINTENANT);
    expect(md).toContain("Aucun système décrit pour l'instant.");
    expect(md).toContain("Aucun module décrit pour l'instant.");
    expect(md).toContain("Aucune intégration décrite pour l'instant.");
    expect(md).toContain("Aucun constat ouvert.");
  });

  it("snapshot sur jeu de données fixe", () => {
    contexte = creerDbTemp();
    const db = contexte.db;
    decrireSysteme(db, { nom: "Zoho CRM", role: "CRM principal", criticite: "haute" });
    decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(db, { systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client", source_de_verite: "Zoho CRM" });
    decrireChamp(db, { systeme: "Zoho CRM", module: "Comptes", nom: "Montant" });
    decrireIntegration(db, { nom: "Devis -> CRM", source: "App Devis", cible: "Zoho CRM" });

    db.prepare(
      `INSERT INTO constats (id, cree_le, controle, entite, entite_id, consequence, statut)
       SELECT 'co1', '2026-08-11T09:00:00.000Z', 'M1', 'champ', c.id,
              'Champ sans source de vérité : aucun arbitrage possible en cas d''écart entre systèmes.', 'ouvert'
       FROM champs c WHERE c.nom = 'Montant'`
    ).run();
    db.prepare(
      `INSERT INTO constats (id, cree_le, controle, entite, entite_id, consequence, statut)
       SELECT 'co2', '2026-08-11T09:00:00.000Z', 'I1', 'integration', i.id,
              'Pas de clé d''idempotence : un rejeu après incident créera des doublons.', 'ouvert'
       FROM integrations i WHERE i.nom = 'Devis -> CRM'`
    ).run();

    const md = rendreEtatSi(collecterDonneesEtatSi(db), MAINTENANT);
    expect(md).toMatchSnapshot();
  });
});

describe("rapport impact", () => {
  it("rend le markdown à partir de la sortie de impact()", () => {
    contexte = creerDbTemp();
    const db = contexte.db;
    decrireSysteme(db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(db, { systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client" });

    const sortie = impact(db, {
      cible: { type: "champ", systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client" },
    });
    expect(sortie.ok).toBe(true);
    if (!sortie.ok) return;
    const md = rendreImpactMarkdown(sortie);
    expect(md).toContain("# Impact — champ « Statut_Client »");
    expect(md).toContain("## Automatisations concernées");
    expect(md).toContain("Aucune.");
    expect(md).toContain("## Historique");
    expect(md).toContain("Aucun changement enregistré.");
  });
});

describe("generer_rapport — etat_si et impact", () => {
  it("type etat_si", () => {
    contexte = creerDbTemp();
    const r = genererRapport(contexte.db, { type: "etat_si" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.markdown).toContain("# État du SI");
  });

  it("type impact requiert une cible", () => {
    contexte = creerDbTemp();
    const r = genererRapport(contexte.db, { type: "impact" });
    expect(r.ok).toBe(false);
  });

  it("type impact avec une cible connue", () => {
    contexte = creerDbTemp();
    const db = contexte.db;
    decrireSysteme(db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(db, { systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client" });

    const r = genererRapport(db, {
      type: "impact",
      cible: { type: "champ", systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.markdown).toContain("Impact — champ « Statut_Client »");
  });
});
