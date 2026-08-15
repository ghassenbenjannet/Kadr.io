import { z } from "zod";
import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";

export const nom = "lier_projet_demande";

export const description =
  "Lie un projet existant à une demande existante — un projet peut réaliser plusieurs demandes. " +
  "Rappeler avec les mêmes paramètres ne duplique pas.";

export const schemaEntree = {
  projet_id: z.string().min(1),
  demande_id: z.string().min(1),
};

const schema = z.object(schemaEntree);
export type EntreeLierProjetDemande = z.infer<typeof schema>;

interface Sortie {
  resume: string;
}

export function lierProjetDemande(db: Database.Database, entree: EntreeLierProjetDemande): Resultat<Sortie> {
  const projet = db.prepare("SELECT id, nom FROM projets WHERE id = ?").get(entree.projet_id) as
    | { id: string; nom: string }
    | undefined;
  if (!projet) {
    return { ok: false, erreur: `Projet introuvable : ${entree.projet_id}` };
  }

  const demande = db.prepare("SELECT id FROM demandes WHERE id = ?").get(entree.demande_id);
  if (!demande) {
    return { ok: false, erreur: `Demande introuvable : ${entree.demande_id}` };
  }

  db.prepare("INSERT OR IGNORE INTO projet_demandes (projet_id, demande_id) VALUES (?, ?)").run(
    entree.projet_id,
    entree.demande_id
  );

  return { ok: true, resume: `Lien confirmé : projet « ${projet.nom} » ↔ demande.` };
}
