import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

export const nom = "creer_projet";

export const description =
  "Crée (ou met à jour) un projet — le conteneur des epics et tickets qui réalisent une demande. " +
  "Upsert par nom. Si le projet répond à une demande déjà enregistrée, lie-la via demande_id : un " +
  "projet sans origine traçable est aussi suspect qu'un changement sans demande d'origine.";

export const schemaEntree = {
  nom: z.string().min(1).describe("Nom du projet, ex : « CS-Vue360 »"),
  description: z.string().optional(),
  demande_id: z.string().optional().describe("Demande à l'origine du projet, si applicable"),
};

const schema = z.object(schemaEntree);
export type EntreeCreerProjet = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
}

export function creerProjet(db: Database.Database, entree: EntreeCreerProjet): Resultat<Sortie> {
  if (entree.demande_id) {
    const demande = db.prepare("SELECT id FROM demandes WHERE id = ?").get(entree.demande_id);
    if (!demande) {
      return { ok: false, erreur: `Demande introuvable : ${entree.demande_id}` };
    }
  }

  const maintenant = maintenantIso();
  const existant = db
    .prepare("SELECT id, description, demande_id FROM projets WHERE nom = ?")
    .get(entree.nom) as { id: string; description: string | null; demande_id: string | null } | undefined;

  if (existant) {
    db.prepare(`UPDATE projets SET description = ?, demande_id = ?, maj_le = ? WHERE id = ?`).run(
      entree.description ?? existant.description,
      entree.demande_id ?? existant.demande_id,
      maintenant,
      existant.id
    );
    return { ok: true, id: existant.id, resume: `Projet « ${entree.nom} » mis à jour.` };
  }

  const id = nouvelId();
  db.prepare(
    `INSERT INTO projets (id, cree_le, nom, description, demande_id, statut, maj_le)
     VALUES (?, ?, ?, ?, ?, 'actif', ?)`
  ).run(id, maintenant, entree.nom, entree.description ?? null, entree.demande_id ?? null, maintenant);
  return { ok: true, id, resume: `Projet « ${entree.nom} » créé.` };
}
