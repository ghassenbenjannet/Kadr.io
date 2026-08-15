import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";

const SCHEMA_V1 = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf-8");
const MIGRATION_V2 = readFileSync(new URL("../src/db/migrations/v2-carte.sql", import.meta.url), "utf-8");
const MIGRATION_V3 = readFileSync(new URL("../src/db/migrations/v3-zoho.sql", import.meta.url), "utf-8");

let dossiersTemp: string[] = [];

afterEach(() => {
  for (const d of dossiersTemp) rmSync(d, { recursive: true, force: true });
  dossiersTemp = [];
});

function nouvelleDbTemp(): Database.Database {
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-mig4-"));
  dossiersTemp.push(dossier);
  return ouvrirDb(join(dossier, "registre.db"));
}

describe("migration v3 -> v4 (conversations)", () => {
  it("ajoute conversations/messages/ecritures_proposees sans perte de données existantes", () => {
    const db = nouvelleDbTemp();
    db.exec(SCHEMA_V1);
    db.exec(MIGRATION_V2);
    db.exec(MIGRATION_V3);
    db.pragma("user_version = 3");

    const maintenant = new Date().toISOString();
    db.prepare(
      `INSERT INTO demandes (id, cree_le, demandeur, equipe, expression_brute, type, statut, maj_le)
       VALUES ('d1', ?, 'Sophie', 'CS', 'texte avant migration', 'evolution', 'recue', ?)`
    ).run(maintenant, maintenant);

    migrer(db);

    expect(db.pragma("user_version", { simple: true })).toBeGreaterThanOrEqual(4);

    const demande = db.prepare("SELECT expression_brute FROM demandes WHERE id = 'd1'").get() as {
      expression_brute: string;
    };
    expect(demande.expression_brute).toBe("texte avant migration");

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining(["conversations", "messages", "ecritures_proposees"])
    );

    db.close();
  });

  it("les tables acceptent des lignes respectant les contraintes du schéma", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const maintenant = new Date().toISOString();

    db.prepare("INSERT INTO conversations (id, cree_le, titre, maj_le) VALUES ('c1', ?, 'Titre', ?)").run(
      maintenant,
      maintenant
    );
    db.prepare(
      "INSERT INTO messages (id, conversation_id, cree_le, role, contenu) VALUES ('m1', 'c1', ?, 'user', '[]')"
    ).run(maintenant);
    db.prepare(
      `INSERT INTO ecritures_proposees (id, conversation_id, message_id, tool_use_id, outil, parametres)
       VALUES ('e1', 'c1', 'm1', 'tu_1', 'enregistrer_demande', '{}')`
    ).run();

    const ecriture = db.prepare("SELECT statut FROM ecritures_proposees WHERE id = 'e1'").get() as {
      statut: string;
    };
    expect(ecriture.statut).toBe("en_attente");

    db.close();
  });

  it("supprimer une conversation supprime ses messages en cascade", () => {
    const db = nouvelleDbTemp();
    migrer(db);
    const maintenant = new Date().toISOString();

    db.prepare("INSERT INTO conversations (id, cree_le, titre, maj_le) VALUES ('c2', ?, 'Titre', ?)").run(
      maintenant,
      maintenant
    );
    db.prepare(
      "INSERT INTO messages (id, conversation_id, cree_le, role, contenu) VALUES ('m2', 'c2', ?, 'user', '[]')"
    ).run(maintenant);

    db.prepare("DELETE FROM conversations WHERE id = 'c2'").run();
    const messages = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE conversation_id = 'c2'").get() as {
      n: number;
    };
    expect(messages.n).toBe(0);

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
