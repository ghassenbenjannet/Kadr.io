import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";

const SCHEMA_V1 = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf-8");
const MIGRATIONS_JUSQUA_V11 = [
  "v2-carte.sql",
  "v3-zoho.sql",
  "v4-conversations.sql",
  "v5-projets.sql",
  "v6-documents.sql",
  "v7-base-connaissances.sql",
  "v8-agents.sql",
  "v9-projet-demandes.sql",
  "v10-vues-kanban.sql",
  "v11-mcp.sql",
].map((f) => readFileSync(new URL(`../src/db/migrations/${f}`, import.meta.url), "utf-8"));

let dossiersTemp: string[] = [];

afterEach(() => {
  for (const d of dossiersTemp) rmSync(d, { recursive: true, force: true });
  dossiersTemp = [];
});

function nouvelleDbTemp(): Database.Database {
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-mig12-"));
  dossiersTemp.push(dossier);
  return ouvrirDb(join(dossier, "registre.db"));
}

function colonnesDe(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

describe("migration v11 -> v12 (annulation du journal)", () => {
  it("ajoute annule_le et annulation_raison aux 4 tables du journal, sans perte de données existantes", () => {
    const db = nouvelleDbTemp();
    db.exec(SCHEMA_V1);
    for (const sql of MIGRATIONS_JUSQUA_V11) db.exec(sql);
    db.pragma("user_version = 11");

    const maintenant = new Date().toISOString();
    db.prepare(
      `INSERT INTO demandes (id, cree_le, demandeur, equipe, expression_brute, type, statut, maj_le)
       VALUES ('d1', ?, 'Sophie', 'CS', 'texte avant migration', 'evolution', 'recue', ?)`
    ).run(maintenant, maintenant);

    migrer(db);
    expect(db.pragma("user_version", { simple: true })).toBeGreaterThanOrEqual(12);

    for (const table of ["demandes", "decisions", "changements", "incidents"]) {
      const colonnes = colonnesDe(db, table);
      expect(colonnes).toContain("annule_le");
      expect(colonnes).toContain("annulation_raison");
    }

    const demande = db.prepare("SELECT expression_brute, annule_le FROM demandes WHERE id = 'd1'").get() as {
      expression_brute: string;
      annule_le: string | null;
    };
    expect(demande.expression_brute).toBe("texte avant migration");
    expect(demande.annule_le).toBeNull();

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
