// Détail complet d'une entité du journal, par id — pour les pages détail de
// Journal/Tickets (demandes). Distinct de detailEntite (db/libelles.ts) qui
// ne produit qu'un libellé d'une ligne pour les rapports.

import type Database from "better-sqlite3";

const TABLES: Record<string, string> = {
  demande: "demandes",
  decision: "decisions",
  changement: "changements",
  incident: "incidents",
};

export function detailEntiteComplet(
  db: Database.Database,
  entite: string,
  id: string
): Record<string, unknown> | null {
  const table = TABLES[entite];
  if (!table) return null;
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  if (entite === "decision" && typeof row.options === "string") {
    row.options = JSON.parse(row.options);
  }
  if (entite === "demande") {
    row.projets_lies = db
      .prepare(
        `SELECT p.id, p.nom FROM projets p
         JOIN projet_demandes pd ON pd.projet_id = p.id
         WHERE pd.demande_id = ? ORDER BY p.nom`
      )
      .all(id);
  }
  return row;
}
