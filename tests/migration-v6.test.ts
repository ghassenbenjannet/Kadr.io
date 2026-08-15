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
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-mig6-"));
  dossiersTemp.push(dossier);
  return ouvrirDb(join(dossier, "registre.db"));
}

describe("migration v5 -> v6 (documents)", () => {
  it("ajoute la table documents", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    expect(db.pragma("user_version", { simple: true })).toBeGreaterThanOrEqual(6);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("documents");
    db.close();
  });

  it("un document est rattaché à un projet et disparaît avec lui", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const maintenant = new Date().toISOString();

    db.prepare("INSERT INTO projets (id, cree_le, nom, maj_le) VALUES ('p1', ?, 'Projet X', ?)").run(
      maintenant,
      maintenant
    );
    db.prepare(
      `INSERT INTO documents (id, cree_le, projet_id, type, titre, contenu, maj_le)
       VALUES ('d1', ?, 'p1', 'cadrage', 'Cadrage initial', '## Contexte', ?)`
    ).run(maintenant, maintenant);

    const doc = db.prepare("SELECT titre FROM documents WHERE id = 'd1'").get() as { titre: string };
    expect(doc.titre).toBe("Cadrage initial");

    db.prepare("DELETE FROM projets WHERE id = 'p1'").run();
    const restant = db.prepare("SELECT COUNT(*) AS n FROM documents WHERE projet_id = 'p1'").get() as {
      n: number;
    };
    expect(restant.n).toBe(0);
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
