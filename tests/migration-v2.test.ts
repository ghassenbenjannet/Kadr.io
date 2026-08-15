import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";

const SCHEMA_V1 = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf-8");

let dossiersTemp: string[] = [];

afterEach(() => {
  for (const d of dossiersTemp) rmSync(d, { recursive: true, force: true });
  dossiersTemp = [];
});

function nouvelleDbTemp(): { db: Database.Database; chemin: string } {
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-mig-"));
  dossiersTemp.push(dossier);
  const chemin = join(dossier, "registre.db");
  return { db: ouvrirDb(chemin), chemin };
}

describe("migration v1 -> v2", () => {
  it("conserve les données du journal et amène user_version à 2", () => {
    // Simule une DB v1 existante (schema.sql seul, sans les tables de carte),
    // puis vérifie que migrer() applique v2 par-dessus sans perte de données.
    const { db: dbV1Seule } = nouvelleDbTemp();
    dbV1Seule.exec(SCHEMA_V1);
    dbV1Seule.pragma("user_version = 1");

    const r = enregistrerDemande(dbV1Seule, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "texte avant migration",
      type: "evolution",
    });
    expect(r.ok).toBe(true);

    migrer(dbV1Seule);

    const version = dbV1Seule.pragma("user_version", { simple: true });
    expect(version).toBeGreaterThanOrEqual(2);

    const demande = dbV1Seule.prepare("SELECT expression_brute FROM demandes").get() as {
      expression_brute: string;
    };
    expect(demande.expression_brute).toBe("texte avant migration");

    const tables = dbV1Seule
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "systemes",
        "modules",
        "champs",
        "habilitations",
        "integrations",
        "integration_champs",
        "erreurs_integration",
        "metriques",
        "automatisations",
        "automatisation_champs",
        "carte_journal",
      ])
    );

    dbV1Seule.close();
  });

  it("remigrer est sans effet (idempotent)", () => {
    const { db } = nouvelleDbTemp();
    migrer(db);
    const versionApres1erPassage = db.pragma("user_version", { simple: true });
    expect(() => migrer(db)).not.toThrow();
    expect(db.pragma("user_version", { simple: true })).toBe(versionApres1erPassage);
    db.close();
  });
});
