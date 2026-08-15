import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerProjet } from "../src/tools/creer-projet.js";
import { creerEpic } from "../src/tools/creer-epic.js";
import { mettreAJourProjet } from "../src/tools/mettre-a-jour-projet.js";
import { mettreAJourEpic } from "../src/tools/mettre-a-jour-epic.js";
import { enregistrerDecision } from "../src/tools/enregistrer-decision.js";
import { mettreAJourDecision } from "../src/tools/mettre-a-jour-decision.js";
import { enregistrerChangement } from "../src/tools/enregistrer-changement.js";
import { mettreAJourChangement } from "../src/tools/mettre-a-jour-changement.js";
import { enregistrerIncident } from "../src/tools/enregistrer-incident.js";
import { mettreAJourIncident } from "../src/tools/mettre-a-jour-incident.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("mettre_a_jour_projet", () => {
  it("clôture un projet", () => {
    contexte = creerDbTemp();
    const p = creerProjet(contexte.db, { nom: "Projet A" });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const r = mettreAJourProjet(contexte.db, { id: p.id, statut: "clos" });
    expect(r.ok).toBe(true);
    const ligne = contexte.db.prepare("SELECT statut FROM projets WHERE id = ?").get(p.id) as { statut: string };
    expect(ligne.statut).toBe("clos");
  });

  it("refuse un projet introuvable et une mise à jour vide", () => {
    contexte = creerDbTemp();
    expect(mettreAJourProjet(contexte.db, { id: "inconnu", statut: "clos" }).ok).toBe(false);
    const p = creerProjet(contexte.db, { nom: "Projet B" });
    if (!p.ok) return;
    expect(mettreAJourProjet(contexte.db, { id: p.id }).ok).toBe(false);
  });
});

describe("mettre_a_jour_epic", () => {
  it("fait avancer le statut d'un epic", () => {
    contexte = creerDbTemp();
    const e = creerEpic(contexte.db, { projet: "P", nom: "Discovery" });
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    const r = mettreAJourEpic(contexte.db, { id: e.id, statut: "termine" });
    expect(r.ok).toBe(true);
    const ligne = contexte.db.prepare("SELECT statut FROM epics WHERE id = ?").get(e.id) as { statut: string };
    expect(ligne.statut).toBe("termine");
  });

  it("refuse un epic introuvable", () => {
    contexte = creerDbTemp();
    expect(mettreAJourEpic(contexte.db, { id: "inconnu", statut: "termine" }).ok).toBe(false);
  });
});

describe("mettre_a_jour_decision", () => {
  it("fait évoluer le statut", () => {
    contexte = creerDbTemp();
    const d = enregistrerDecision(contexte.db, {
      contexte: "x",
      options: [{ option: "a" }],
      decision: "on fait a",
      decideur: "moi",
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    const r = mettreAJourDecision(contexte.db, { id: d.id, statut: "appliquee" });
    expect(r.ok).toBe(true);
    const ligne = contexte.db.prepare("SELECT statut FROM decisions WHERE id = ?").get(d.id) as {
      statut: string;
    };
    expect(ligne.statut).toBe("appliquee");
  });

  it("exige remplacee_par pour passer à remplacee", () => {
    contexte = creerDbTemp();
    const d = enregistrerDecision(contexte.db, {
      contexte: "x",
      options: [{ option: "a" }],
      decision: "on fait a",
      decideur: "moi",
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    const r = mettreAJourDecision(contexte.db, { id: d.id, statut: "remplacee" });
    expect(r.ok).toBe(false);
  });

  it("refuse une décision de remplacement introuvable", () => {
    contexte = creerDbTemp();
    const d = enregistrerDecision(contexte.db, {
      contexte: "x",
      options: [{ option: "a" }],
      decision: "on fait a",
      decideur: "moi",
    });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    const r = mettreAJourDecision(contexte.db, { id: d.id, statut: "remplacee", remplacee_par: "inconnue" });
    expect(r.ok).toBe(false);
  });
});

describe("mettre_a_jour_changement", () => {
  it("ajoute rollback/test après coup", () => {
    contexte = creerDbTemp();
    const c = enregistrerChangement(contexte.db, { description: "x", perimetre: "y", type: "autre" });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const r = mettreAJourChangement(contexte.db, { id: c.id, rollback: "revert du script", test_effectue: "recette manuelle" });
    expect(r.ok).toBe(true);
    const ligne = contexte.db.prepare("SELECT rollback, test_effectue FROM changements WHERE id = ?").get(
      c.id
    ) as { rollback: string; test_effectue: string };
    expect(ligne.rollback).toBe("revert du script");
    expect(ligne.test_effectue).toBe("recette manuelle");
  });
});

describe("mettre_a_jour_incident", () => {
  it("déduit resolu_le quand une résolution est ajoutée sans date explicite", () => {
    contexte = creerDbTemp();
    const i = enregistrerIncident(contexte.db, { symptome: "x", impact: "y" });
    expect(i.ok).toBe(true);
    if (!i.ok) return;
    const r = mettreAJourIncident(contexte.db, { id: i.id, resolution: "redémarrage du service" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.avertissements).toContain("Aucune action préventive déclarée. Le contrôle C6 restera ouvert.");

    const ligne = contexte.db.prepare("SELECT resolution, resolu_le FROM incidents WHERE id = ?").get(i.id) as {
      resolution: string;
      resolu_le: string | null;
    };
    expect(ligne.resolution).toBe("redémarrage du service");
    expect(ligne.resolu_le).not.toBeNull();
  });

  it("pas d'avertissement quand l'action préventive est fournie", () => {
    contexte = creerDbTemp();
    const i = enregistrerIncident(contexte.db, { symptome: "x", impact: "y" });
    expect(i.ok).toBe(true);
    if (!i.ok) return;
    const r = mettreAJourIncident(contexte.db, {
      id: i.id,
      resolution: "redémarrage",
      action_preventive: "alerte de supervision ajoutée",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.avertissements).toEqual([]);
  });
});
