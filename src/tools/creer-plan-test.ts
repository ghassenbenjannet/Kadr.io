import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

export const nom = "creer_plan_test";

export const description =
  "Crée un plan de test : un nom et sa liste de cas (étape, résultat attendu). Chaque cas démarre " +
  "à 'a_faire' — c'est executer_cas_test qui le fait passer à réussi ou échoué. Lie ensuite le plan " +
  "à un ou plusieurs tickets avec lier_ticket_plan_test : l'ensemble des plans liés aux tickets " +
  "d'un projet constitue sa suite de recette.";

export const schemaEntree = {
  nom: z.string().min(1).describe("Nom du plan de test, doit être unique"),
  description: z.string().optional(),
  cas: z
    .array(
      z.object({
        etape: z.string().min(1),
        resultat_attendu: z.string().min(1),
      })
    )
    .min(1)
    .describe("Les cas de test du plan, au moins un"),
};

const schema = z.object(schemaEntree);
export type EntreeCreerPlanTest = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  cas_ids: string[];
}

export function creerPlanTest(db: Database.Database, entree: EntreeCreerPlanTest): Resultat<Sortie> {
  const existant = db.prepare("SELECT id FROM plans_test WHERE nom = ?").get(entree.nom);
  if (existant) {
    return { ok: false, erreur: `Un plan de test « ${entree.nom} » existe déjà.` };
  }

  const id = nouvelId();
  const maintenant = maintenantIso();

  db.prepare(
    `INSERT INTO plans_test (id, cree_le, nom, description, maj_le) VALUES (?, ?, ?, ?, ?)`
  ).run(id, maintenant, entree.nom, entree.description ?? null, maintenant);

  const casIds: string[] = [];
  const inserer = db.prepare(
    `INSERT INTO cas_test (id, cree_le, plan_test_id, etape, resultat_attendu, statut, maj_le)
     VALUES (?, ?, ?, ?, ?, 'a_faire', ?)`
  );
  for (const cas of entree.cas) {
    const casId = nouvelId();
    inserer.run(casId, maintenant, id, cas.etape, cas.resultat_attendu, maintenant);
    casIds.push(casId);
  }

  return {
    ok: true,
    id,
    resume: `Plan de test « ${entree.nom} » créé avec ${entree.cas.length} cas.`,
    cas_ids: casIds,
  };
}
