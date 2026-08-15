import { z } from "zod";
import type Database from "better-sqlite3";
import { statutCasTestEnum } from "../db/enums.js";
import { maintenantIso, type Resultat } from "../db/util.js";

export const nom = "executer_cas_test";

export const description =
  "Enregistre le résultat d'un cas de test : réussi, échoué, ou remis à 'a_faire'. Précise qui l'a " +
  "exécuté si ce n'est pas toi — un cas de recette est souvent joué par l'équipe qui a demandé la " +
  "fonctionnalité, pas par l'opérateur SI.";

export const schemaEntree = {
  id: z.string().min(1).describe("Identifiant du cas de test"),
  statut: statutCasTestEnum,
  executee_par: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeExecuterCasTest = z.infer<typeof schema>;

interface CasRow {
  id: string;
  etape: string;
}

interface Sortie {
  id: string;
  resume: string;
}

export function executerCasTest(db: Database.Database, entree: EntreeExecuterCasTest): Resultat<Sortie> {
  const existant = db.prepare("SELECT id, etape FROM cas_test WHERE id = ?").get(entree.id) as
    | CasRow
    | undefined;
  if (!existant) {
    return { ok: false, erreur: "Cas de test introuvable." };
  }

  const maintenant = maintenantIso();
  const executeeLe = entree.statut === "a_faire" ? null : maintenant;

  db.prepare(
    `UPDATE cas_test SET statut = @statut, executee_le = @executee_le,
       executee_par = COALESCE(@executee_par, executee_par), maj_le = @maj_le
     WHERE id = @id`
  ).run({
    id: entree.id,
    statut: entree.statut,
    executee_le: executeeLe,
    executee_par: entree.executee_par ?? null,
    maj_le: maintenant,
  });

  return {
    ok: true,
    id: entree.id,
    resume: `Cas « ${existant.etape} » : ${entree.statut}.`,
  };
}
