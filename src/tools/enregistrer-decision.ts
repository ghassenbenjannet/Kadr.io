import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

export const nom = "enregistrer_decision";

export const description =
  "Enregistre un arbitrage qui engage la structure du SI : le contexte, les options considérées " +
  "(y compris celles écartées et pourquoi), la décision retenue et qui l'a prise (soi-même, le " +
  "CEO, ou une équipe). Critique en solo : le décideur doit toujours être attribuable.";

export const schemaEntree = {
  contexte: z.string().min(1).describe("Le problème posé"),
  options: z
    .array(
      z.object({
        option: z.string().min(1),
        ecartee_car: z.string().optional().describe("Raison pour laquelle cette option a été écartée"),
      })
    )
    .min(1)
    .describe("Options considérées, y compris celles écartées"),
  decision: z.string().min(1).describe("La décision retenue"),
  decideur: z.string().min(1).describe("Qui a décidé : 'moi', 'CEO', ou un nom"),
  consequences: z.string().optional().describe("Conséquences attendues"),
  statut: z.enum(["proposee", "validee"]).optional().describe("Statut initial (défaut : proposee)"),
};

const schema = z.object(schemaEntree);
export type EntreeEnregistrerDecision = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
}

export function enregistrerDecision(
  db: Database.Database,
  entree: EntreeEnregistrerDecision
): Resultat<Sortie> {
  const id = nouvelId();
  const maintenant = maintenantIso();
  const statut = entree.statut ?? "proposee";

  db.prepare(
    `INSERT INTO decisions
      (id, cree_le, contexte, options, decision, decideur, consequences, statut, maj_le)
     VALUES
      (@id, @cree_le, @contexte, @options, @decision, @decideur, @consequences, @statut, @maj_le)`
  ).run({
    id,
    cree_le: maintenant,
    contexte: entree.contexte,
    options: JSON.stringify(entree.options),
    decision: entree.decision,
    decideur: entree.decideur,
    consequences: entree.consequences ?? null,
    statut,
    maj_le: maintenant,
  });

  return {
    ok: true,
    id,
    resume: `Décision « ${entree.decision} » (${statut}) par ${entree.decideur}.`,
  };
}
