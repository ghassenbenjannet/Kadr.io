import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";

describe("db: migration", () => {
  let dossiersTemp: string[] = [];

  afterEach(() => {
    for (const d of dossiersTemp) rmSync(d, { recursive: true, force: true });
    dossiersTemp = [];
  });

  function nouvelleDbTemp(): { db: Database.Database; chemin: string } {
    const dossier = mkdtempSync(join(tmpdir(), "registre-si-"));
    dossiersTemp.push(dossier);
    const chemin = join(dossier, "registre.db");
    const db = ouvrirDb(chemin);
    return { db, chemin };
  }

  it("crée la DB et applique toutes les migrations disponibles", () => {
    const { db } = nouvelleDbTemp();
    migrer(db);
    const version = db.pragma("user_version", { simple: true });
    expect(version).toBeGreaterThanOrEqual(2);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining(["demandes", "decisions", "changements", "incidents", "constats"])
    );
    db.close();
  });

  it("relancer migrer() est idempotent", () => {
    const { db } = nouvelleDbTemp();
    migrer(db);
    const versionApres1erPassage = db.pragma("user_version", { simple: true });
    expect(() => migrer(db)).not.toThrow();
    const version = db.pragma("user_version", { simple: true });
    expect(version).toBe(versionApres1erPassage);
    db.close();
  });
});
