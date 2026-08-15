import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";

const SCHEMA_V1 = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf-8");
const MIGRATIONS_JUSQUA_V6 = ["v2-carte.sql", "v3-zoho.sql", "v4-conversations.sql", "v5-projets.sql", "v6-documents.sql"].map(
  (f) => readFileSync(new URL(`../src/db/migrations/${f}`, import.meta.url), "utf-8")
);

let dossiersTemp: string[] = [];

afterEach(() => {
  for (const d of dossiersTemp) rmSync(d, { recursive: true, force: true });
  dossiersTemp = [];
});

function nouvelleDbTemp(): Database.Database {
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-mig7-"));
  dossiersTemp.push(dossier);
  return ouvrirDb(join(dossier, "registre.db"));
}

describe("migration v6 -> v7 (base de connaissances)", () => {
  it("projet_id devient nullable, sans perte des documents existants", () => {
    const db = nouvelleDbTemp();
    db.exec(SCHEMA_V1);
    for (const sql of MIGRATIONS_JUSQUA_V6) db.exec(sql);
    db.pragma("user_version = 6");

    const maintenant = new Date().toISOString();
    db.prepare("INSERT INTO projets (id, cree_le, nom, maj_le) VALUES ('p1', ?, 'Projet X', ?)").run(
      maintenant,
      maintenant
    );
    db.prepare(
      `INSERT INTO documents (id, cree_le, projet_id, type, titre, contenu, maj_le)
       VALUES ('d1', ?, 'p1', 'cadrage', 'Cadrage', 'texte avant migration', ?)`
    ).run(maintenant, maintenant);

    migrer(db);
    expect(db.pragma("user_version", { simple: true })).toBeGreaterThanOrEqual(7);

    const doc = db.prepare("SELECT contenu, projet_id FROM documents WHERE id = 'd1'").get() as {
      contenu: string;
      projet_id: string;
    };
    expect(doc.contenu).toBe("texte avant migration");
    expect(doc.projet_id).toBe("p1");

    db.prepare(
      `INSERT INTO documents (id, cree_le, projet_id, type, titre, contenu, maj_le)
       VALUES ('d2', ?, NULL, 'architecture_existante', 'Existant Zoho', 'texte', ?)`
    ).run(maintenant, maintenant);
    const global = db.prepare("SELECT projet_id FROM documents WHERE id = 'd2'").get() as {
      projet_id: string | null;
    };
    expect(global.projet_id).toBeNull();

    db.close();
  });

  it("la recherche plein texte trouve un document par son contenu", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const maintenant = new Date().toISOString();

    db.prepare(
      `INSERT INTO documents (id, cree_le, projet_id, type, titre, contenu, maj_le)
       VALUES ('d1', ?, NULL, 'architecture_existante', 'Existant Zoho CRM', 'Le module Comptes gère les factures', ?)`
    ).run(maintenant, maintenant);

    const resultat = db
      .prepare("SELECT rowid, snippet(documents_fts, 1, '', '', '…', 8) AS extrait FROM documents_fts WHERE documents_fts MATCH 'factures*'")
      .all() as { rowid: number; extrait: string }[];
    expect(resultat.length).toBe(1);

    const doc = db.prepare("SELECT id FROM documents WHERE rowid = ?").get(resultat[0]!.rowid) as { id: string };
    expect(doc.id).toBe("d1");

    db.close();
  });

  it("la FTS suit une mise à jour de contenu", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const maintenant = new Date().toISOString();
    db.prepare(
      `INSERT INTO documents (id, cree_le, projet_id, type, titre, contenu, maj_le)
       VALUES ('d1', ?, NULL, 'note', 'Note', 'contenu original', ?)`
    ).run(maintenant, maintenant);

    db.prepare("UPDATE documents SET contenu = 'contenu modifié avec un mot rare xyzzy' WHERE id = 'd1'").run();

    const resultat = db
      .prepare("SELECT rowid FROM documents_fts WHERE documents_fts MATCH 'xyzzy*'")
      .all() as { rowid: number }[];
    expect(resultat.length).toBe(1);

    const ancien = db
      .prepare("SELECT rowid FROM documents_fts WHERE documents_fts MATCH 'original*'")
      .all() as { rowid: number }[];
    expect(ancien.length).toBe(0);

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
