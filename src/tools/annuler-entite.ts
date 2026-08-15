// Annulation d'une fiche du journal (demande/décision/changement/incident) —
// remplace la suppression physique (migration v12) : le registre garde la
// trace de tout ce qui a existé, y compris ce qui s'avère erroné ou obsolète.
// L'entrée annulée reste en base et dans journal_fts (pas de purge) ; elle
// est exclue par filtrage applicatif des vues et calculs normaux
// (rechercher_journal, contrôles, sections normales du rapport hebdo), qui
// listent chacun à leur façon ce qui a été annulé plutôt que de le faire
// disparaître silencieusement.

import type Database from "better-sqlite3";
import { maintenantIso, type Resultat } from "../db/util.js";

export const TABLE_PAR_ENTITE: Record<string, string> = {
  demande: "demandes",
  decision: "decisions",
  changement: "changements",
  incident: "incidents",
};

export function annulerEntiteJournal(
  db: Database.Database,
  entite: string,
  id: string,
  raison: string
): Resultat<{ id: string }> {
  const table = TABLE_PAR_ENTITE[entite];
  if (!table) return { ok: false, erreur: `Entité inconnue : ${entite}` };

  const existant = db.prepare(`SELECT id, annule_le FROM ${table} WHERE id = ?`).get(id) as
    | { id: string; annule_le: string | null }
    | undefined;
  if (!existant) return { ok: false, erreur: "Entrée introuvable." };
  if (existant.annule_le) return { ok: false, erreur: "Entrée déjà annulée." };

  db.prepare(`UPDATE ${table} SET annule_le = ?, annulation_raison = ? WHERE id = ?`).run(
    maintenantIso(),
    raison,
    id
  );

  return { ok: true, id };
}
