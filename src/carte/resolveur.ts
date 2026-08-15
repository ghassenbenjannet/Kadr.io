// Résolution de la carte par noms, avec création à la volée des parents
// manquants (système -> module -> champ), toujours signalée par un
// avertissement. Utilisé par les outils decrire_* et par impact().

import type Database from "better-sqlite3";
import { maintenantIso, nouvelId } from "../db/util.js";

export interface ResolutionSysteme {
  id: string;
  cree: boolean;
}

export function resoudreOuCreerSysteme(db: Database.Database, nom: string): ResolutionSysteme {
  const existant = db.prepare("SELECT id FROM systemes WHERE nom = ?").get(nom) as
    | { id: string }
    | undefined;
  if (existant) return { id: existant.id, cree: false };

  const id = nouvelId();
  const maintenant = maintenantIso();
  db.prepare(
    `INSERT INTO systemes (id, cree_le, nom, role, criticite, maj_le)
     VALUES (?, ?, ?, 'À compléter', 'moyenne', ?)`
  ).run(id, maintenant, nom, maintenant);
  return { id, cree: true };
}

export interface ResolutionModule {
  id: string;
  cree: boolean;
  avertissements: string[];
}

export function resoudreOuCreerModule(
  db: Database.Database,
  systemeNom: string,
  moduleNom: string
): ResolutionModule {
  const avertissements: string[] = [];
  const systeme = resoudreOuCreerSysteme(db, systemeNom);
  if (systeme.cree) {
    avertissements.push(`Système « ${systemeNom} » créé automatiquement, complète son rôle.`);
  }

  const existant = db
    .prepare("SELECT id FROM modules WHERE systeme_id = ? AND nom = ?")
    .get(systeme.id, moduleNom) as { id: string } | undefined;
  if (existant) return { id: existant.id, cree: false, avertissements };

  const id = nouvelId();
  const maintenant = maintenantIso();
  db.prepare(
    `INSERT INTO modules (id, cree_le, systeme_id, nom, maj_le) VALUES (?, ?, ?, ?, ?)`
  ).run(id, maintenant, systeme.id, moduleNom, maintenant);
  avertissements.push(`Module « ${moduleNom} » créé automatiquement, complète son rôle métier.`);
  return { id, cree: true, avertissements };
}

export interface ResolutionChamp {
  id: string;
  cree: boolean;
  avertissements: string[];
}

export function resoudreOuCreerChamp(
  db: Database.Database,
  systemeNom: string,
  moduleNom: string,
  champNom: string
): ResolutionChamp {
  const module = resoudreOuCreerModule(db, systemeNom, moduleNom);

  const existant = db
    .prepare("SELECT id FROM champs WHERE module_id = ? AND nom = ?")
    .get(module.id, champNom) as { id: string } | undefined;
  if (existant) return { id: existant.id, cree: false, avertissements: module.avertissements };

  const id = nouvelId();
  const maintenant = maintenantIso();
  db.prepare(
    `INSERT INTO champs (id, cree_le, module_id, nom, maj_le) VALUES (?, ?, ?, ?, ?)`
  ).run(id, maintenant, module.id, champNom, maintenant);
  return {
    id,
    cree: true,
    avertissements: [
      ...module.avertissements,
      `Champ « ${champNom} » créé automatiquement (source de vérité non déclarée).`,
    ],
  };
}

/** Résout un champ par noms sans rien créer. Retourne null si un des trois maillons manque. */
export function trouverChamp(
  db: Database.Database,
  systemeNom: string,
  moduleNom: string,
  champNom: string
): { id: string } | null {
  const systeme = db.prepare("SELECT id FROM systemes WHERE nom = ?").get(systemeNom) as
    | { id: string }
    | undefined;
  if (!systeme) return null;
  const module = db
    .prepare("SELECT id FROM modules WHERE systeme_id = ? AND nom = ?")
    .get(systeme.id, moduleNom) as { id: string } | undefined;
  if (!module) return null;
  const champ = db
    .prepare("SELECT id FROM champs WHERE module_id = ? AND nom = ?")
    .get(module.id, champNom) as { id: string } | undefined;
  if (!champ) return null;
  return { id: champ.id };
}

/** Résout un module par noms sans rien créer. */
export function trouverModule(
  db: Database.Database,
  systemeNom: string,
  moduleNom: string
): { id: string } | null {
  const systeme = db.prepare("SELECT id FROM systemes WHERE nom = ?").get(systemeNom) as
    | { id: string }
    | undefined;
  if (!systeme) return null;
  const module = db
    .prepare("SELECT id FROM modules WHERE systeme_id = ? AND nom = ?")
    .get(systeme.id, moduleNom) as { id: string } | undefined;
  if (!module) return null;
  return { id: module.id };
}
