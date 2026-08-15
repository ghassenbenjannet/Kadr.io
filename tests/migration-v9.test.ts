import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";

const SCHEMA_V1 = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf-8");
const MIGRATIONS_JUSQUA_V8 = [
  "v2-carte.sql",
  "v3-zoho.sql",
  "v4-conversations.sql",
  "v5-projets.sql",
  "v6-documents.sql",
  "v7-base-connaissances.sql",
  "v8-agents.sql",
].map((f) => readFileSync(new URL(`../src/db/migrations/${f}`, import.meta.url), "utf-8"));

let dossiersTemp: string[] = [];

afterEach(() => {
  for (const d of dossiersTemp) rmSync(d, { recursive: true, force: true });
  dossiersTemp = [];
});

function nouvelleDbTemp(): Database.Database {
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-mig9-"));
  dossiersTemp.push(dossier);
  return ouvrirDb(join(dossier, "registre.db"));
}

describe("migration v8 -> v9 (projets <-> demandes many-to-many)", () => {
  it("reporte le lien projets.demande_id existant dans projet_demandes, puis retire la colonne", () => {
    const db = nouvelleDbTemp();
    db.exec(SCHEMA_V1);
    for (const sql of MIGRATIONS_JUSQUA_V8) db.exec(sql);
    db.pragma("user_version = 8");

    const maintenant = new Date().toISOString();
    db.prepare(
      `INSERT INTO demandes (id, cree_le, demandeur, equipe, expression_brute, type, statut, maj_le)
       VALUES ('d1', ?, 'Sophie', 'CS', 'vue 360', 'evolution', 'recue', ?)`
    ).run(maintenant, maintenant);
    db.prepare(
      `INSERT INTO projets (id, cree_le, nom, demande_id, statut, maj_le) VALUES ('p1', ?, 'Projet X', 'd1', 'actif', ?)`
    ).run(maintenant, maintenant);

    migrer(db);
    expect(db.pragma("user_version", { simple: true })).toBeGreaterThanOrEqual(10);

    const colonnes = db.prepare("PRAGMA table_info(projets)").all() as { name: string }[];
    expect(colonnes.map((c) => c.name)).not.toContain("demande_id");

    const lien = db.prepare("SELECT demande_id FROM projet_demandes WHERE projet_id = 'p1'").get() as {
      demande_id: string;
    };
    expect(lien.demande_id).toBe("d1");

    db.close();
  });

  it("un projet peut être lié à plusieurs demandes", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const maintenant = new Date().toISOString();

    for (const id of ["d1", "d2"]) {
      db.prepare(
        `INSERT INTO demandes (id, cree_le, demandeur, equipe, expression_brute, type, statut, maj_le)
         VALUES (?, ?, 'Sophie', 'CS', 'x', 'evolution', 'recue', ?)`
      ).run(id, maintenant, maintenant);
    }
    db.prepare(`INSERT INTO projets (id, cree_le, nom, statut, maj_le) VALUES ('p1', ?, 'Projet X', 'actif', ?)`).run(
      maintenant,
      maintenant
    );
    db.prepare("INSERT INTO projet_demandes (projet_id, demande_id) VALUES ('p1', 'd1'), ('p1', 'd2')").run();

    const liens = db.prepare("SELECT COUNT(*) AS n FROM projet_demandes WHERE projet_id = 'p1'").get() as {
      n: number;
    };
    expect(liens.n).toBe(2);

    db.close();
  });

  it("supprimer une demande retire son lien sans supprimer le projet", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const maintenant = new Date().toISOString();
    db.prepare(
      `INSERT INTO demandes (id, cree_le, demandeur, equipe, expression_brute, type, statut, maj_le)
       VALUES ('d1', ?, 'Sophie', 'CS', 'x', 'evolution', 'recue', ?)`
    ).run(maintenant, maintenant);
    db.prepare(`INSERT INTO projets (id, cree_le, nom, statut, maj_le) VALUES ('p1', ?, 'Projet X', 'actif', ?)`).run(
      maintenant,
      maintenant
    );
    db.prepare("INSERT INTO projet_demandes (projet_id, demande_id) VALUES ('p1', 'd1')").run();

    db.prepare("DELETE FROM demandes WHERE id = 'd1'").run();

    const lien = db.prepare("SELECT COUNT(*) AS n FROM projet_demandes").get() as { n: number };
    expect(lien.n).toBe(0);
    const projet = db.prepare("SELECT id FROM projets WHERE id = 'p1'").get();
    expect(projet).toBeDefined();

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
