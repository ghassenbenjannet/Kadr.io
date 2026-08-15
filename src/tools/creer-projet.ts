import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

export const nom = "creer_projet";

export const description =
  "Crée (ou met à jour) un projet — le conteneur des epics et tickets qui réalisent une ou plusieurs " +
  "demandes. Upsert par nom. Si le projet répond à des demandes déjà enregistrées, lie-les via " +
  "demande_ids : un projet sans origine traçable est aussi suspect qu'un changement sans demande " +
  "d'origine. Un projet peut regrouper plusieurs demandes ; rappeler avec de nouveaux demande_ids " +
  "sur un projet existant ajoute les liens sans retirer les précédents.";

export const schemaEntree = {
  nom: z.string().min(1).describe("Nom du projet, ex : « CS-Vue360 »"),
  description: z.string().optional(),
  demande_ids: z.array(z.string()).optional().describe("Demandes à l'origine du projet, si applicable"),
};

const schema = z.object(schemaEntree);
export type EntreeCreerProjet = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
}

export function creerProjet(db: Database.Database, entree: EntreeCreerProjet): Resultat<Sortie> {
  for (const demandeId of entree.demande_ids ?? []) {
    const demande = db.prepare("SELECT id FROM demandes WHERE id = ?").get(demandeId);
    if (!demande) {
      return { ok: false, erreur: `Demande introuvable : ${demandeId}` };
    }
  }

  const maintenant = maintenantIso();
  const existant = db.prepare("SELECT id, description FROM projets WHERE nom = ?").get(entree.nom) as
    | { id: string; description: string | null }
    | undefined;

  const lierDemandes = (projetId: string) => {
    const inserer = db.prepare("INSERT OR IGNORE INTO projet_demandes (projet_id, demande_id) VALUES (?, ?)");
    for (const demandeId of entree.demande_ids ?? []) {
      inserer.run(projetId, demandeId);
    }
  };

  if (existant) {
    db.prepare(`UPDATE projets SET description = ?, maj_le = ? WHERE id = ?`).run(
      entree.description ?? existant.description,
      maintenant,
      existant.id
    );
    lierDemandes(existant.id);
    return { ok: true, id: existant.id, resume: `Projet « ${entree.nom} » mis à jour.` };
  }

  const id = nouvelId();
  db.prepare(
    `INSERT INTO projets (id, cree_le, nom, description, statut, maj_le)
     VALUES (?, ?, ?, ?, 'actif', ?)`
  ).run(id, maintenant, entree.nom, entree.description ?? null, maintenant);
  lierDemandes(id);
  return { ok: true, id, resume: `Projet « ${entree.nom} » créé.` };
}
