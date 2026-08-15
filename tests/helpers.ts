import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { ouvrirDb } from "../src/db/client.js";
import { migrer } from "../src/db/migrate.js";

export interface DbTemp {
  db: Database.Database;
  dossier: string;
}

export function creerDbTemp(): DbTemp {
  const dossier = mkdtempSync(join(tmpdir(), "registre-si-"));
  const db = ouvrirDb(join(dossier, "registre.db"));
  migrer(db);
  return { db, dossier };
}

export function fermerDbTemp({ db, dossier }: DbTemp): void {
  db.close();
  rmSync(dossier, { recursive: true, force: true });
}
