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
  annule: boolean;
  annulationRaison: string | null;
}

export interface FiltresJournal {
  entite?: string;
  depuis?: string;
  jusquA?: string;
  limite?: number;
  /** Inclut les entrées annulées (grisées côté écran Journal). Par défaut, exclues. */
  inclureAnnulees?: boolean;
}

export function listerJournal(db: Database.Database, filtres: FiltresJournal = {}): LigneJournal[] {
  const entites = filtres.entite && ENTITES.includes(filtres.entite as EntiteJournal)
    ? [filtres.entite as EntiteJournal]
    : ENTITES;

  const lignes: LigneJournal[] = [];
  for (const entite of entites) {
    const rows = db
      .prepare(`SELECT id, cree_le, annule_le, annulation_raison FROM ${tableDe(entite)} ORDER BY cree_le DESC`)
      .all() as { id: string; cree_le: string; annule_le: string | null; annulation_raison: string | null }[];
    for (const row of rows) {
      if (!filtres.inclureAnnulees && row.annule_le) continue;
      if (filtres.depuis && row.cree_le < filtres.depuis) continue;
      if (filtres.jusquA && row.cree_le > filtres.jusquA) continue;
      const detail = detailEntite(db, entite, row.id);
      const libelle = detail?.libelle ?? `${entite} ${row.id}`;
      // Le libellé de detailEntite embarque "{mot} du {date} : " (pensé pour un
      // rapport en prose) ; ici la date et le type sont déjà des colonnes
      // distinctes de la ligne, donc on ne garde que le reste.
      const resume = libelle.replace(/^\S+ du \d{2}\/\d{2} : /, "");
      lignes.push({
        entite,
        id: row.id,
        date: row.cree_le,
        resume,
        annule: row.annule_le !== null,
        annulationRaison: row.annulation_raison,
      });
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
