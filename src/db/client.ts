import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

export function resoudreCheminDb(): string {
  const chemin = process.env.REGISTRE_DB_PATH;
  if (chemin && chemin.length > 0) {
    return resolve(chemin);
  }
  return resolve(homedir(), ".registre-si", "registre.db");
}

export function ouvrirDb(chemin: string = resoudreCheminDb()): Database.Database {
  mkdirSync(dirname(chemin), { recursive: true });
  const db = new Database(chemin);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
