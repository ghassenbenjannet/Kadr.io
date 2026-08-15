import type Database from "better-sqlite3";

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  const jour = String(d.getUTCDate()).padStart(2, "0");
  const mois = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}`;
}

export interface DetailEntite {
  date: string;
  libelle: string;
}

/** Résout une entité du journal (entite + id) en une phrase lisible et sa date de création. */
export function detailEntite(db: Database.Database, entite: string, id: string): DetailEntite | null {
  switch (entite) {
    case "demande": {
      const row = db
        .prepare("SELECT cree_le, demandeur, equipe FROM demandes WHERE id = ?")
        .get(id) as { cree_le: string; demandeur: string; equipe: string } | undefined;
      if (!row) return null;
      return {
        date: row.cree_le,
        libelle: `demande du ${formatDateFr(row.cree_le)} : ${row.demandeur} (${row.equipe})`,
      };
    }
    case "decision": {
      const row = db.prepare("SELECT cree_le, decision FROM decisions WHERE id = ?").get(id) as
        | { cree_le: string; decision: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, libelle: `décision du ${formatDateFr(row.cree_le)} : ${row.decision}` };
    }
    case "changement": {
      const row = db
        .prepare("SELECT cree_le, description FROM changements WHERE id = ?")
        .get(id) as { cree_le: string; description: string } | undefined;
      if (!row) return null;
      return {
        date: row.cree_le,
        libelle: `changement du ${formatDateFr(row.cree_le)} : ${row.description}`,
      };
    }
    case "incident": {
      const row = db.prepare("SELECT cree_le, symptome FROM incidents WHERE id = ?").get(id) as
        | { cree_le: string; symptome: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, libelle: `incident du ${formatDateFr(row.cree_le)} : ${row.symptome}` };
    }
    default:
      return null;
  }
}
