import type Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const iciDir = dirname(fileURLToPath(import.meta.url));

interface Migration {
  version: number;
  fichier: string;
}

// Chaque migration porte user_version à sa propre valeur. schema.sql est la
// migration initiale (v1) ; les jalons suivants ajoutent des fichiers dans
// migrations/.
const MIGRATIONS: Migration[] = [
  { version: 1, fichier: join(iciDir, "schema.sql") },
  { version: 2, fichier: join(iciDir, "migrations", "v2-carte.sql") },
  { version: 3, fichier: join(iciDir, "migrations", "v3-zoho.sql") },
  { version: 4, fichier: join(iciDir, "migrations", "v4-conversations.sql") },
];

function versionCourante(db: Database.Database): number {
  const row = db.pragma("user_version", { simple: true });
  return Number(row);
}

/** Applique les migrations manquantes. Idempotent : ne rejoue rien si déjà à jour. */
export function migrer(db: Database.Database): void {
  let version = versionCourante(db);
  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;
    const sql = readFileSync(migration.fichier, "utf-8");
    const executer = db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${migration.version}`);
    });
    executer();
    version = migration.version;
  }
}
