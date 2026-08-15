// Listing complet des demandes pour l'écran Tickets (GET /api/demandes) —
// contrairement à listerJournal (résumé d'une ligne), ici on a besoin de
// chaque champ pour afficher un vrai kanban par statut.

import type Database from "better-sqlite3";

export interface DemandeComplete {
  id: string;
  cree_le: string;
  demandeur: string;
  equipe: string;
  expression_brute: string;
  reformulation: string | null;
  type: string;
  priorite: string | null;
  priorite_arbitree_par: string | null;
  statut: string;
  maj_le: string;
}

export function listerDemandes(db: Database.Database): DemandeComplete[] {
  return db
    .prepare(
      `SELECT id, cree_le, demandeur, equipe, expression_brute, reformulation, type,
              priorite, priorite_arbitree_par, statut, maj_le
       FROM demandes
       ORDER BY cree_le DESC`
    )
    .all() as DemandeComplete[];
}
