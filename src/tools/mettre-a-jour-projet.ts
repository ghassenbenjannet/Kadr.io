import { z } from "zod";
import type Database from "better-sqlite3";
import { statutProjetEnum } from "../db/enums.js";
import { maintenantIso, type Resultat } from "../db/util.js";

export const nom = "mettre_a_jour_projet";

export const description = "Fait avancer un projet : le clôture (statut) ou précise sa description.";

export const schemaEntree = {
  id: z.string().min(1),
  statut: statutProjetEnum.optional(),
  description: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeMettreAJourProjet = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
}

export function mettreAJourProjet(db: Database.Database, entree: EntreeMettreAJourProjet): Resultat<Sortie> {
  const existant = db.prepare("SELECT id, nom, statut FROM projets WHERE id = ?").get(entree.id) as
    | { id: string; nom: string; statut: string }
    | undefined;
  if (!existant) {
    return { ok: false, erreur: "Projet introuvable." };
  }
  if (entree.statut === undefined && entree.description === undefined) {
    return { ok: false, erreur: "Rien à mettre à jour : précise au moins un champ." };
  }

  const maintenant = maintenantIso();
  db.prepare(
    `UPDATE projets SET statut = COALESCE(@statut, statut),
       description = COALESCE(@description, description), maj_le = @maj_le
     WHERE id = @id`
  ).run({
    id: entree.id,
    statut: entree.statut ?? null,
    description: entree.description ?? null,
    maj_le: maintenant,
  });

  return {
    ok: true,
    id: entree.id,
    resume: `Projet « ${existant.nom} » mis à jour : statut ${entree.statut ?? existant.statut}.`,
  };
}
