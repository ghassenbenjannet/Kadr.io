import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";
import { decrireSysteme } from "../src/tools/decrire-systeme.js";
import { decrireModule } from "../src/tools/decrire-module.js";
import { decrireChamp } from "../src/tools/decrire-champ.js";

const SCHEMA_V1 = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf-8");
const MIGRATION_V2 = readFileSync(
  new URL("../src/db/migrations/v2-carte.sql", import.meta.url),
  "utf-8"
);

let dossiersTemp: string[] = [];

afterEach(() => {
  for (const d of dossiersTemp) rmSync(d, { recursive: true, force: true });
  dossiersTemp = [];
});

function nouvelleDbTemp(): Database.Database {
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-mig3-"));
  dossiersTemp.push(dossier);
  return ouvrirDb(join(dossier, "registre.db"));
}

describe("migration v2 -> v3", () => {
  it("conserve les données de la carte, ajoute disparu_le et la table imports", () => {
    const db = nouvelleDbTemp();
    db.exec(SCHEMA_V1);
    db.exec(MIGRATION_V2);
    db.pragma("user_version = 2");

    decrireSysteme(db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(db, { systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client", source_de_verite: "Zoho CRM" });

    migrer(db);

    expect(db.pragma("user_version", { simple: true })).toBe(3);

    const champ = db.prepare("SELECT nom, disparu_le FROM champs WHERE nom = 'Statut_Client'").get() as {
      nom: string;
      disparu_le: string | null;
    };
    expect(champ.nom).toBe("Statut_Client");
    expect(champ.disparu_le).toBeNull();

    const colonnesModules = db.prepare("PRAGMA table_info(modules)").all() as { name: string }[];
    expect(colonnesModules.some((c) => c.name === "disparu_le")).toBe(true);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toContain("imports");

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
