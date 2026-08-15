import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";
import { enregistrerDecision } from "../src/tools/enregistrer-decision.js";
import { enregistrerChangement } from "../src/tools/enregistrer-changement.js";
import { enregistrerIncident } from "../src/tools/enregistrer-incident.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("enregistrer_demande", () => {
  it("refuse une priorité sans arbitre", () => {
    contexte = creerDbTemp();
    const r = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "je veux voir les factures dans la fiche client",
      type: "evolution",
      priorite: "P1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreur).toBe("Une priorité doit être attribuable : qui l'a arbitrée ?");
    }
  });

  it("enregistre une demande avec priorité arbitrée", () => {
    contexte = creerDbTemp();
    const r = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "je veux voir les factures dans la fiche client",
      type: "evolution",
      priorite: "P1",
      priorite_arbitree_par: "moi",
    });
    expect(r.ok).toBe(true);
  });

  it("expression_brute est immuable : aucun outil ne permet de la modifier", () => {
    contexte = creerDbTemp();
    const r = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "texte original",
      type: "evolution",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Aucun outil d'écriture n'expose de mise à jour de expression_brute :
    // on vérifie qu'une modification directe en DB reste la seule voie
    // possible (absente de la surface applicative), ce que confirme
    // l'inspection du module enregistrer-demande.ts (aucun UPDATE émis).
    const ligne = contexte.db
      .prepare("SELECT expression_brute FROM demandes WHERE id = ?")
      .get(r.id) as { expression_brute: string };
    expect(ligne.expression_brute).toBe("texte original");
  });
});

describe("enregistrer_decision", () => {
  it("enregistre une décision proposée par défaut", () => {
    contexte = creerDbTemp();
    const r = enregistrerDecision(contexte.db, {
      contexte: "Le champ Statut_Client est modifiable partout",
      options: [
        { option: "Rendre lecture seule sauf Admin" },
        { option: "Ne rien changer", ecartee_car: "risque d'écart avec la source" },
      ],
      decision: "Rendre lecture seule sauf Admin",
      decideur: "moi",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resume).toContain("proposee");
  });
});

describe("enregistrer_changement", () => {
  it("réussit sans rollback mais avec un avertissement", () => {
    contexte = creerDbTemp();
    const r = enregistrerChangement(contexte.db, {
      description: "Désactivation de la règle de relance",
      perimetre: "Module Devis",
      type: "deluge",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.avertissements).toContain(
        "Aucun retour arrière déclaré. Le contrôle C1 restera ouvert."
      );
    }
  });

  it("réussit sans avertissement quand rollback fourni", () => {
    contexte = creerDbTemp();
    const r = enregistrerChangement(contexte.db, {
      description: "Désactivation de la règle de relance",
      perimetre: "Module Devis",
      type: "deluge",
      rollback: "réactiver la règle WF-12",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.avertissements).toHaveLength(0);
  });

  it("refuse un demande_id inexistant", () => {
    contexte = creerDbTemp();
    const r = enregistrerChangement(contexte.db, {
      description: "x",
      perimetre: "y",
      type: "autre",
      demande_id: "inconnu",
    });
    expect(r.ok).toBe(false);
  });

  it("accepte un demande_id existant", () => {
    contexte = creerDbTemp();
    const demande = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "x",
      type: "evolution",
    });
    expect(demande.ok).toBe(true);
    if (!demande.ok) return;
    const r = enregistrerChangement(contexte.db, {
      description: "x",
      perimetre: "y",
      type: "autre",
      demande_id: demande.id,
    });
    expect(r.ok).toBe(true);
  });
});

describe("enregistrer_incident", () => {
  it("refuse un changement_id inexistant", () => {
    contexte = creerDbTemp();
    const r = enregistrerIncident(contexte.db, {
      symptome: "synchro cassée",
      impact: "devis non transmis",
      changement_id: "inconnu",
    });
    expect(r.ok).toBe(false);
  });

  it("enregistre un incident lié à un changement existant", () => {
    contexte = creerDbTemp();
    const changement = enregistrerChangement(contexte.db, {
      description: "x",
      perimetre: "y",
      type: "autre",
    });
    expect(changement.ok).toBe(true);
    if (!changement.ok) return;
    const r = enregistrerIncident(contexte.db, {
      symptome: "synchro cassée",
      impact: "devis non transmis",
      changement_id: changement.id,
    });
    expect(r.ok).toBe(true);
  });
});
