// Listing du journal pour l'écran de lecture (GET /api/journal), distinct de
// rechercher_journal qui exige un terme de recherche plein texte.

import type Database from "better-sqlite3";
import { detailEntite } from "../db/libelles.js";

const ENTITES = ["demande", "decision", "changement", "incident"] as const;
type EntiteJournal = (typeof ENTITES)[number];

export interface LigneJournal {
  entite: EntiteJournal;
  id: string;
  date: string;
  resume: string;
}

export interface FiltresJournal {
  entite?: string;
  depuis?: string;
  jusquA?: string;
  limite?: number;
}

export function listerJournal(db: Database.Database, filtres: FiltresJournal = {}): LigneJournal[] {
  const entites = filtres.entite && ENTITES.includes(filtres.entite as EntiteJournal)
    ? [filtres.entite as EntiteJournal]
    : ENTITES;

  const lignes: LigneJournal[] = [];
  for (const entite of entites) {
    const rows = db.prepare(`SELECT id, cree_le FROM ${tableDe(entite)} ORDER BY cree_le DESC`).all() as {
      id: string;
      cree_le: string;
    }[];
    for (const row of rows) {
      if (filtres.depuis && row.cree_le < filtres.depuis) continue;
      if (filtres.jusquA && row.cree_le > filtres.jusquA) continue;
      const detail = detailEntite(db, entite, row.id);
      lignes.push({ entite, id: row.id, date: row.cree_le, resume: detail?.libelle ?? `${entite} ${row.id}` });
    }
  }

  lignes.sort((a, b) => b.date.localeCompare(a.date));
  return lignes.slice(0, filtres.limite ?? 50);
}

function tableDe(entite: EntiteJournal): string {
  switch (entite) {
    case "demande":
      return "demandes";
    case "decision":
      return "decisions";
    case "changement":
      return "changements";
    case "incident":
      return "incidents";
  }
}
