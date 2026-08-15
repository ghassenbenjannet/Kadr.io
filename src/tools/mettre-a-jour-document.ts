import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, type Resultat } from "../db/util.js";

export const nom = "mettre_a_jour_document";

export const description = "Complète ou réécrit une page de documentation existante : son titre ou son contenu.";

export const schemaEntree = {
  id: z.string().min(1),
  titre: z.string().optional(),
  contenu: z.string().optional().describe("Remplace le contenu entier de la page"),
};

const schema = z.object(schemaEntree);
export type EntreeMettreAJourDocument = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
}

export function mettreAJourDocument(db: Database.Database, entree: EntreeMettreAJourDocument): Resultat<Sortie> {
  const existant = db.prepare("SELECT id, titre FROM documents WHERE id = ?").get(entree.id) as
    | { id: string; titre: string }
    | undefined;
  if (!existant) {
    return { ok: false, erreur: "Page introuvable." };
  }
  if (entree.titre === undefined && entree.contenu === undefined) {
    return { ok: false, erreur: "Rien à mettre à jour : précise au moins un champ." };
  }

  const maintenant = maintenantIso();
  db.prepare(
    `UPDATE documents SET titre = COALESCE(@titre, titre), contenu = COALESCE(@contenu, contenu), maj_le = @maj_le
     WHERE id = @id`
  ).run({
    id: entree.id,
    titre: entree.titre ?? null,
    contenu: entree.contenu ?? null,
    maj_le: maintenant,
  });

  return { ok: true, id: entree.id, resume: `Page « ${entree.titre ?? existant.titre} » mise à jour.` };
}
