import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";

const SCHEMA_V1 = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf-8");
const MIGRATIONS_JUSQUA_V10 = [
  "v2-carte.sql",
  "v3-zoho.sql",
  "v4-conversations.sql",
  "v5-projets.sql",
  "v6-documents.sql",
  "v7-base-connaissances.sql",
  "v8-agents.sql",
  "v9-projet-demandes.sql",
  "v10-vues-kanban.sql",
].map((f) => readFileSync(new URL(`../src/db/migrations/${f}`, import.meta.url), "utf-8"));

let dossiersTemp: string[] = [];

afterEach(() => {
  for (const d of dossiersTemp) rmSync(d, { recursive: true, force: true });
  dossiersTemp = [];
});

function nouvelleDbTemp(): Database.Database {
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-mig11-"));
  dossiersTemp.push(dossier);
  return ouvrirDb(join(dossier, "registre.db"));
}

function colonnesDe(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name).sort();
}

describe("migration v10 -> v11 (transport MCP)", () => {
  it("reconstruit ecritures_proposees sans perte de colonnes ni de données existantes", () => {
    const db = nouvelleDbTemp();
    db.exec(SCHEMA_V1);
    for (const sql of MIGRATIONS_JUSQUA_V10) db.exec(sql);
    db.pragma("user_version = 10");

    // Colonnes AVANT reconstruction, hors le seul changement voulu (conversation_id /
    // message_id passent NOT NULL -> nullable, et origine apparaît) : si un jalon entre
    // v7 et v10 avait ajouté une colonne à cette table sans qu'on le sache, ce garde-fou
    // la détecterait ici plutôt que de la laisser disparaître silencieusement au DROP.
    const colonnesAvant = colonnesDe(db, "ecritures_proposees");
    expect(colonnesAvant).toEqual(
      ["id", "conversation_id", "message_id", "tool_use_id", "outil", "parametres", "statut", "resultat", "tranche_le"].sort()
    );

    const maintenant = new Date().toISOString();
    db.prepare("INSERT INTO conversations (id, cree_le, titre, maj_le) VALUES ('c1', ?, 'Titre', ?)").run(
      maintenant,
      maintenant
    );
    db.prepare(
      "INSERT INTO messages (id, conversation_id, cree_le, role, contenu) VALUES ('m1', 'c1', ?, 'user', '[]')"
    ).run(maintenant);
    db.prepare(
      `INSERT INTO ecritures_proposees (id, conversation_id, message_id, tool_use_id, outil, parametres, statut, resultat, tranche_le)
       VALUES ('e1', 'c1', 'm1', 'tu_1', 'enregistrer_demande', '{"a":1}', 'validee', '{"ok":true}', ?)`
    ).run(maintenant);

    migrer(db);
    expect(db.pragma("user_version", { simple: true })).toBeGreaterThanOrEqual(11);

    // Colonnes APRÈS reconstruction : toutes les colonnes d'avant doivent survivre,
    // plus la seule addition attendue (origine).
    const colonnesApres = colonnesDe(db, "ecritures_proposees");
    for (const c of colonnesAvant) {
      expect(colonnesApres).toContain(c);
    }
    expect(colonnesApres).toEqual([...colonnesAvant, "origine"].sort());

    const ligne = db.prepare("SELECT * FROM ecritures_proposees WHERE id = 'e1'").get() as Record<string, unknown>;
    expect(ligne.conversation_id).toBe("c1");
    expect(ligne.message_id).toBe("m1");
    expect(ligne.tool_use_id).toBe("tu_1");
    expect(ligne.outil).toBe("enregistrer_demande");
    expect(ligne.parametres).toBe('{"a":1}');
    expect(ligne.statut).toBe("validee");
    expect(ligne.resultat).toBe('{"ok":true}');
    expect(ligne.origine).toBe("app");

    db.close();
  });

  it("conversation_id et message_id sont désormais nullables (écriture née hors conversation)", () => {
    const db = nouvelleDbTemp();
    migrer(db);

    db.prepare(
      `INSERT INTO ecritures_proposees (id, conversation_id, message_id, origine, tool_use_id, outil, parametres)
       VALUES ('e2', NULL, NULL, 'mcp', 'mcp-tu_2', 'enregistrer_changement', '{}')`
    ).run();

    const ligne = db.prepare("SELECT conversation_id, message_id, origine FROM ecritures_proposees WHERE id = 'e2'").get() as {
      conversation_id: string | null;
      message_id: string | null;
      origine: string;
    };
    expect(ligne.conversation_id).toBeNull();
    expect(ligne.message_id).toBeNull();
    expect(ligne.origine).toBe("mcp");

    db.close();
  });

  it("origine rejette toute valeur hors 'app'/'mcp'", () => {
    const db = nouvelleDbTemp();
    migrer(db);

    expect(() =>
      db
        .prepare(
          `INSERT INTO ecritures_proposees (id, origine, tool_use_id, outil, parametres)
           VALUES ('e3', 'autre', 'tu_3', 'enregistrer_demande', '{}')`
        )
        .run()
    ).toThrow();

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
