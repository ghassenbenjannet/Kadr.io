import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, type Resultat } from "../db/util.js";
import { resoudreOuCreerEpic } from "../tickets/resolveur.js";

export const nom = "creer_epic";

export const description =
  "Crée (ou met à jour) un epic au sein d'un projet — un lot de tickets qui partagent un objectif " +
  "(ex : Discovery, Build, Recette). Upsert par nom au sein du projet. Si le projet n'existe pas " +
  "encore, il est créé automatiquement (avec avertissement).";

export const schemaEntree = {
  projet: z.string().min(1),
  nom: z.string().min(1).describe("Nom de l'epic, ex : « Discovery »"),
  description: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeCreerEpic = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function creerEpic(db: Database.Database, entree: EntreeCreerEpic): Resultat<Sortie> {
  const resolution = resoudreOuCreerEpic(db, entree.projet, entree.nom);
  const maintenant = maintenantIso();

  if (entree.description !== undefined) {
    db.prepare("UPDATE epics SET description = ?, maj_le = ? WHERE id = ?").run(
      entree.description,
      maintenant,
      resolution.id
    );
  }

  return {
    ok: true,
    id: resolution.id,
    resume: resolution.cree
      ? `Epic « ${entree.nom} » créé dans ${entree.projet}.`
      : `Epic « ${entree.nom} » (${entree.projet}) mis à jour.`,
    avertissements: resolution.avertissements,
  };
}
