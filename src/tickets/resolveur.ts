// Résolution du suivi de projet par noms, avec création à la volée des
// parents manquants (projet -> epic), toujours signalée par un
// avertissement — même pattern que carte/resolveur.ts.

import type Database from "better-sqlite3";
import { maintenantIso, nouvelId } from "../db/util.js";

export interface ResolutionProjet {
  id: string;
  cree: boolean;
}

export function resoudreOuCreerProjet(db: Database.Database, nom: string): ResolutionProjet {
  const existant = db.prepare("SELECT id FROM projets WHERE nom = ?").get(nom) as
    | { id: string }
    | undefined;
  if (existant) return { id: existant.id, cree: false };

  const id = nouvelId();
  const maintenant = maintenantIso();
  db.prepare(
    `INSERT INTO projets (id, cree_le, nom, statut, maj_le) VALUES (?, ?, ?, 'actif', ?)`
  ).run(id, maintenant, nom, maintenant);
  return { id, cree: true };
}

export interface ResolutionEpic {
  id: string;
  cree: boolean;
  avertissements: string[];
}

export function resoudreOuCreerEpic(
  db: Database.Database,
  projetNom: string,
  epicNom: string
): ResolutionEpic {
  const avertissements: string[] = [];
  const projet = resoudreOuCreerProjet(db, projetNom);
  if (projet.cree) {
    avertissements.push(`Projet « ${projetNom} » créé automatiquement.`);
  }

  const existant = db
    .prepare("SELECT id FROM epics WHERE projet_id = ? AND nom = ?")
    .get(projet.id, epicNom) as { id: string } | undefined;
  if (existant) return { id: existant.id, cree: false, avertissements };

  const id = nouvelId();
  const maintenant = maintenantIso();
  db.prepare(
    `INSERT INTO epics (id, cree_le, projet_id, nom, statut, maj_le) VALUES (?, ?, ?, ?, 'a_faire', ?)`
  ).run(id, maintenant, projet.id, epicNom, maintenant);
  return { id, cree: true, avertissements };
}

/** Résout un projet par nom sans rien créer. */
export function trouverProjet(db: Database.Database, nom: string): { id: string } | null {
  const row = db.prepare("SELECT id FROM projets WHERE nom = ?").get(nom) as { id: string } | undefined;
  return row ?? null;
}

/** Résout un epic par noms (projet + epic) sans rien créer. */
export function trouverEpic(
  db: Database.Database,
  projetNom: string,
  epicNom: string
): { id: string } | null {
  const projet = trouverProjet(db, projetNom);
  if (!projet) return null;
  const row = db
    .prepare("SELECT id FROM epics WHERE projet_id = ? AND nom = ?")
    .get(projet.id, epicNom) as { id: string } | undefined;
  return row ?? null;
}

/** Résout un plan de test par nom sans rien créer. */
export function trouverPlanTest(db: Database.Database, nom: string): { id: string } | null {
  const row = db.prepare("SELECT id FROM plans_test WHERE nom = ?").get(nom) as
    | { id: string }
    | undefined;
  return row ?? null;
}
