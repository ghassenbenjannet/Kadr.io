import { z } from "zod";
import type Database from "better-sqlite3";
import { statutDecisionEnum } from "../db/enums.js";
import { maintenantIso, type Resultat } from "../db/util.js";

export const nom = "mettre_a_jour_decision";

export const description =
  "Fait évoluer une décision déjà enregistrée : son statut (proposee, validee, appliquee, " +
  "remplacee), ses conséquences constatées, ou la décision qui la remplace.";

export const schemaEntree = {
  id: z.string().min(1),
  statut: statutDecisionEnum.optional(),
  consequences: z.string().optional(),
  remplacee_par: z.string().optional().describe("Id de la décision qui la remplace"),
};

const schema = z.object(schemaEntree);
export type EntreeMettreAJourDecision = z.infer<typeof schema>;

interface DecisionRow {
  id: string;
  decision: string;
  statut: string;
  remplacee_par: string | null;
}

interface Sortie {
  id: string;
  resume: string;
}

export function mettreAJourDecision(db: Database.Database, entree: EntreeMettreAJourDecision): Resultat<Sortie> {
  const existant = db
    .prepare("SELECT id, decision, statut, remplacee_par FROM decisions WHERE id = ?")
    .get(entree.id) as DecisionRow | undefined;
  if (!existant) {
    return { ok: false, erreur: "Décision introuvable." };
  }
  if (entree.statut === undefined && entree.consequences === undefined && entree.remplacee_par === undefined) {
    return { ok: false, erreur: "Rien à mettre à jour : précise au moins un champ." };
  }

  if (entree.remplacee_par) {
    const remplacante = db.prepare("SELECT id FROM decisions WHERE id = ?").get(entree.remplacee_par);
    if (!remplacante) {
      return { ok: false, erreur: `Décision de remplacement introuvable : ${entree.remplacee_par}` };
    }
  }

  const statutFinal = entree.statut ?? existant.statut;
  const remplaceeParFinal = entree.remplacee_par ?? existant.remplacee_par;
  if (statutFinal === "remplacee" && !remplaceeParFinal) {
    return { ok: false, erreur: "Une décision remplacée doit préciser remplacee_par." };
  }

  const maintenant = maintenantIso();
  db.prepare(
    `UPDATE decisions SET statut = @statut, consequences = COALESCE(@consequences, consequences),
       remplacee_par = @remplacee_par, maj_le = @maj_le
     WHERE id = @id`
  ).run({
    id: entree.id,
    statut: statutFinal,
    consequences: entree.consequences ?? null,
    remplacee_par: remplaceeParFinal,
    maj_le: maintenant,
  });

  return {
    ok: true,
    id: entree.id,
    resume: `Décision « ${existant.decision} » mise à jour : statut ${statutFinal}.`,
  };
}
