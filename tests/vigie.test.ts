import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { enregistrerChangement } from "../src/tools/enregistrer-changement.js";
import { lancerControles } from "../src/tools/lancer-controles.js";
import { constatsOuverts } from "../src/tools/constats-ouverts.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("lancer_controles / constats_ouverts", () => {
  it("crée un constat C2 pour un changement sans test, puis rejouer ne duplique pas", () => {
    contexte = creerDbTemp();
    enregistrerChangement(contexte.db, {
      description: "Changement sans test",
      perimetre: "Module Devis",
      type: "deluge",
      rollback: "annuler la règle",
    });

    const premierPassage = lancerControles(contexte.db, { perimetre: "tous" });
    expect(premierPassage.ok).toBe(true);
    if (!premierPassage.ok) return;
    expect(premierPassage.nouveaux).toBeGreaterThanOrEqual(1);
    expect(premierPassage.ouverts.some((c) => c.controle === "C2")).toBe(true);

    const deuxiemePassage = lancerControles(contexte.db, { perimetre: "tous" });
    expect(deuxiemePassage.ok).toBe(true);
    if (!deuxiemePassage.ok) return;
    expect(deuxiemePassage.nouveaux).toBe(0);

    const total = contexte.db.prepare("SELECT COUNT(*) as n FROM constats WHERE controle = 'C2'").get() as {
      n: number;
    };
    expect(total.n).toBe(1);
  });

  it("corriger la cause résout le constat (passe en traite)", () => {
    contexte = creerDbTemp();
    const c = enregistrerChangement(contexte.db, {
      description: "Changement sans test",
      perimetre: "Module Devis",
      type: "deluge",
      rollback: "annuler la règle",
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;

    lancerControles(contexte.db, { perimetre: "tous" });
    contexte.db
      .prepare("UPDATE changements SET test_effectue = ? WHERE id = ?")
      .run("testé avec Sophie", c.id);

    const deuxiemePassage = lancerControles(contexte.db, { perimetre: "tous" });
    expect(deuxiemePassage.ok).toBe(true);
    if (!deuxiemePassage.ok) return;
    expect(deuxiemePassage.resolus).toBeGreaterThanOrEqual(1);
    expect(deuxiemePassage.ouverts.some((x) => x.controle === "C2")).toBe(false);

    const constat = contexte.db.prepare("SELECT statut FROM constats WHERE controle = 'C2'").get() as {
      statut: string;
    };
    expect(constat.statut).toBe("traite");
  });

  it("constats_ouverts reflète l'état après lancer_controles", () => {
    contexte = creerDbTemp();
    enregistrerChangement(contexte.db, {
      description: "Changement sans rollback ni test",
      perimetre: "Module Devis",
      type: "sql",
    });
    lancerControles(contexte.db, { perimetre: "tous" });

    const r = constatsOuverts(contexte.db, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.constats.length).toBeGreaterThan(0);
    for (const c of r.constats) {
      expect(c.resume).toContain("changement du");
      expect(c.consequence.length).toBeGreaterThan(0);
    }
  });

  it("M2 (perimetre 'modele') : casse différente entre source et système ne déclenche pas", () => {
    contexte = creerDbTemp();
    const db = contexte.db;
    const maintenant = new Date().toISOString();
    db.prepare(
      "INSERT INTO systemes (id, cree_le, nom, role, maj_le) VALUES ('sys1', ?, 'Zoho CRM', 'CRM', ?)"
    ).run(maintenant, maintenant);
    db.prepare(
      "INSERT INTO modules (id, cree_le, systeme_id, nom, maj_le) VALUES ('mod1', ?, 'sys1', 'Comptes', ?)"
    ).run(maintenant, maintenant);
    db.prepare(
      `INSERT INTO champs (id, cree_le, module_id, nom, source_de_verite, editable, maj_le)
       VALUES ('ch1', ?, 'mod1', 'Statut_Client', 'zoho crm', 1, ?)`
    ).run(maintenant, maintenant);

    const r = lancerControles(db, { perimetre: "modele" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ouverts.some((c) => c.controle === "M2")).toBe(false);
    // M1 ne doit pas non plus se déclencher : la source est renseignée.
    expect(r.ouverts.some((c) => c.controle === "M1")).toBe(false);
  });

  it("I-family (perimetre 'integration') : intégration sans idempotence ni métrique", () => {
    contexte = creerDbTemp();
    const db = contexte.db;
    const maintenant = new Date().toISOString();
    db.prepare(
      "INSERT INTO systemes (id, cree_le, nom, role, maj_le) VALUES ('sys1', ?, 'App Devis', 'Devis', ?)"
    ).run(maintenant, maintenant);
    db.prepare(
      "INSERT INTO systemes (id, cree_le, nom, role, maj_le) VALUES ('sys2', ?, 'Zoho CRM', 'CRM', ?)"
    ).run(maintenant, maintenant);
    db.prepare(
      `INSERT INTO integrations (id, cree_le, nom, source_id, cible_id, maj_le)
       VALUES ('int1', ?, 'Devis -> CRM', 'sys1', 'sys2', ?)`
    ).run(maintenant, maintenant);

    const r = lancerControles(db, { perimetre: "integration" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const code of ["I1", "I2", "I3", "I5", "I7"]) {
      expect(r.ouverts.some((c) => c.controle === code)).toBe(true);
    }
  });
});
