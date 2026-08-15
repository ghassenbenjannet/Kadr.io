// Vues sauvegardées du kanban configurable (§ écran Kanban) : quelle entité
// afficher et avec quels filtres, sous un nom rechargeable — voir
// db/migrations/v10-vues-kanban.sql pour la justification.

import type Database from "better-sqlite3";
import { z } from "zod";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

export interface VueKanban {
  id: string;
  cree_le: string;
  nom: string;
  entite: "demande" | "ticket";
  filtres: { projet_id?: string; epic_id?: string };
  maj_le: string;
}

interface LigneVueKanban {
  id: string;
  cree_le: string;
  nom: string;
  entite: string;
  filtres: string;
  maj_le: string;
}

function versVueKanban(ligne: LigneVueKanban): VueKanban {
  return { ...ligne, entite: ligne.entite as "demande" | "ticket", filtres: JSON.parse(ligne.filtres) };
}

export function listerVuesKanban(db: Database.Database): VueKanban[] {
  return (db.prepare("SELECT * FROM vues_kanban ORDER BY nom").all() as LigneVueKanban[]).map(versVueKanban);
}

export const schemaSauvegarderVueKanban = {
  nom: z.string().min(1),
  entite: z.enum(["demande", "ticket"]),
  filtres: z.object({ projet_id: z.string().optional(), epic_id: z.string().optional() }).default({}),
};

/** Upsert par nom : enregistrer une vue sous un nom déjà utilisé remplace ses réglages. */
export function sauvegarderVueKanban(
  db: Database.Database,
  entree: z.infer<ReturnType<typeof z.object<typeof schemaSauvegarderVueKanban>>>
): Resultat<{ id: string }> {
  const existante = db.prepare("SELECT id FROM vues_kanban WHERE nom = ?").get(entree.nom) as
    | { id: string }
    | undefined;
  const maintenant = maintenantIso();
  const filtresJson = JSON.stringify(entree.filtres);

  if (existante) {
    db.prepare("UPDATE vues_kanban SET entite = ?, filtres = ?, maj_le = ? WHERE id = ?").run(
      entree.entite,
      filtresJson,
      maintenant,
      existante.id
    );
    return { ok: true, id: existante.id };
  }

  const id = nouvelId();
  db.prepare(
    `INSERT INTO vues_kanban (id, cree_le, nom, entite, filtres, maj_le) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, maintenant, entree.nom, entree.entite, filtresJson, maintenant);
  return { ok: true, id };
}

export function supprimerVueKanban(db: Database.Database, id: string): Resultat<{ id: string }> {
  const existante = db.prepare("SELECT id FROM vues_kanban WHERE id = ?").get(id);
  if (!existante) return { ok: false, erreur: "Vue introuvable." };
  db.prepare("DELETE FROM vues_kanban WHERE id = ?").run(id);
  return { ok: true, id };
}
