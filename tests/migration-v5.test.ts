import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";

let dossiersTemp: string[] = [];

afterEach(() => {
  for (const d of dossiersTemp) rmSync(d, { recursive: true, force: true });
  dossiersTemp = [];
});

function nouvelleDbTemp(): Database.Database {
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-mig5-"));
  dossiersTemp.push(dossier);
  return ouvrirDb(join(dossier, "registre.db"));
}

describe("migration v4 -> v5 (projets)", () => {
  it("ajoute projets/epics/tickets/plans_test/cas_test/ticket_plans_test", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    expect(db.pragma("user_version", { simple: true })).toBeGreaterThanOrEqual(5);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "projets",
        "epics",
        "tickets",
        "plans_test",
        "cas_test",
        "ticket_plans_test",
      ])
    );
    db.close();
  });

  it("un projet, un epic et un ticket respectent les contraintes et la cascade de suppression", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const maintenant = new Date().toISOString();

    db.prepare(
      "INSERT INTO projets (id, cree_le, nom, maj_le) VALUES ('p1', ?, 'CS-Vue360', ?)"
    ).run(maintenant, maintenant);
    db.prepare(
      "INSERT INTO epics (id, cree_le, projet_id, nom, maj_le) VALUES ('e1', ?, 'p1', 'Discovery', ?)"
    ).run(maintenant, maintenant);
    db.prepare(
      `INSERT INTO tickets (id, cree_le, epic_id, titre, type, maj_le)
       VALUES ('t1', ?, 'e1', 'Atelier besoins CS', 'atelier', ?)`
    ).run(maintenant, maintenant);

    const ticket = db.prepare("SELECT statut FROM tickets WHERE id = 't1'").get() as { statut: string };
    expect(ticket.statut).toBe("a_faire");

    db.prepare("DELETE FROM projets WHERE id = 'p1'").run();
    const epics = db.prepare("SELECT COUNT(*) AS n FROM epics WHERE projet_id = 'p1'").get() as { n: number };
    const tickets = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE epic_id = 'e1'").get() as { n: number };
    expect(epics.n).toBe(0);
    expect(tickets.n).toBe(0);

    db.close();
  });

  it("un plan de test avec ses cas, lié à un ticket via ticket_plans_test", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const maintenant = new Date().toISOString();

    db.prepare("INSERT INTO projets (id, cree_le, nom, maj_le) VALUES ('p2', ?, 'Projet X', ?)").run(
      maintenant,
      maintenant
    );
    db.prepare("INSERT INTO epics (id, cree_le, projet_id, nom, maj_le) VALUES ('e2', ?, 'p2', 'Build', ?)").run(
      maintenant,
      maintenant
    );
    db.prepare(
      `INSERT INTO tickets (id, cree_le, epic_id, titre, type, maj_le)
       VALUES ('t2', ?, 'e2', 'Développer export', 'task', ?)`
    ).run(maintenant, maintenant);
    db.prepare("INSERT INTO plans_test (id, cree_le, nom, maj_le) VALUES ('pt1', ?, 'Recette export', ?)").run(
      maintenant,
      maintenant
    );
    db.prepare(
      `INSERT INTO cas_test (id, cree_le, plan_test_id, etape, resultat_attendu, maj_le)
       VALUES ('ct1', ?, 'pt1', 'Exporter 10 leads', 'Fichier CSV avec 10 lignes', ?)`
    ).run(maintenant, maintenant);
    db.prepare("INSERT INTO ticket_plans_test (ticket_id, plan_test_id) VALUES ('t2', 'pt1')").run();

    const lien = db
      .prepare("SELECT plan_test_id FROM ticket_plans_test WHERE ticket_id = 't2'")
      .get() as { plan_test_id: string };
    expect(lien.plan_test_id).toBe("pt1");

    const cas = db.prepare("SELECT statut FROM cas_test WHERE id = 'ct1'").get() as { statut: string };
    expect(cas.statut).toBe("a_faire");

    db.close();
  });

  it("remigrer est sans effet", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const version = db.pragma("user_version", { simple: true });
    expect(() => migrer(db)).not.toThrow();
    expect(db.pragma("user_version", { simple: true })).toBe(version);
    db.close();
  });
});
