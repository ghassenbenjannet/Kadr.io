// Suppression directe d'une fiche du journal (demande/décision/changement/
// incident). Contrairement aux triggers d'INSERT/UPDATE de journal_fts
// (schema.sql), il n'existe pas de trigger AFTER DELETE — l'index plein
// texte doit être nettoyé à la main ici, sinon rechercher_journal continue
// de renvoyer des lignes fantômes pour une fiche supprimée.

import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";

export const TABLE_PAR_ENTITE: Record<string, string> = {
  demande: "demandes",
  decision: "decisions",
  changement: "changements",
  incident: "incidents",
};

export function supprimerEntiteJournal(
  db: Database.Database,
  entite: string,
  id: string
): Resultat<{ id: string }> {
  const table = TABLE_PAR_ENTITE[entite];
  if (!table) return { ok: false, erreur: `Entité inconnue : ${entite}` };

  const existant = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  if (!existant) return { ok: false, erreur: "Entrée introuvable." };

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM journal_fts WHERE entite = ? AND entite_id = ?").run(entite, id);
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  });
  transaction();

  return { ok: true, id };
}
