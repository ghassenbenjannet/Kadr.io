import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, type Resultat } from "../db/util.js";

export const nom = "mettre_a_jour_changement";

export const description =
  "Complète un changement déjà enregistré : son plan de retour arrière, la preuve de test, ou la " +
  "communication faite. Utile quand ces informations n'étaient pas connues au moment de la saisie " +
  "— tant qu'elles manquent, les contrôles C1/C2 restent ouverts.";

export const schemaEntree = {
  id: z.string().min(1),
  rollback: z.string().optional(),
  test_effectue: z.string().optional(),
  communication: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeMettreAJourChangement = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
}

export function mettreAJourChangement(
  db: Database.Database,
  entree: EntreeMettreAJourChangement
): Resultat<Sortie> {
  const existant = db.prepare("SELECT id, description FROM changements WHERE id = ?").get(entree.id) as
    | { id: string; description: string }
    | undefined;
  if (!existant) {
    return { ok: false, erreur: "Changement introuvable." };
  }
  if (entree.rollback === undefined && entree.test_effectue === undefined && entree.communication === undefined) {
    return { ok: false, erreur: "Rien à mettre à jour : précise au moins un champ." };
  }

  const maintenant = maintenantIso();
  db.prepare(
    `UPDATE changements SET rollback = COALESCE(@rollback, rollback),
       test_effectue = COALESCE(@test_effectue, test_effectue),
       communication = COALESCE(@communication, communication), maj_le = @maj_le
     WHERE id = @id`
  ).run({
    id: entree.id,
    rollback: entree.rollback ?? null,
    test_effectue: entree.test_effectue ?? null,
    communication: entree.communication ?? null,
    maj_le: maintenant,
  });

  return { ok: true, id: entree.id, resume: `Changement « ${existant.description} » mis à jour.` };
}
