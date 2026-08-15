import { z } from "zod";
import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";
import { trouverPlanTest } from "../tickets/resolveur.js";

export const nom = "lier_ticket_plan_test";

export const description =
  "Lie un ticket à un plan de test — c'est ce lien qui fait entrer le plan dans la suite de recette " +
  "du projet du ticket. Rappeler avec les mêmes paramètres ne duplique pas.";

export const schemaEntree = {
  ticket_id: z.string().min(1),
  plan_test: z.string().min(1).describe("Nom du plan de test"),
};

const schema = z.object(schemaEntree);
export type EntreeLierTicketPlanTest = z.infer<typeof schema>;

interface Sortie {
  resume: string;
}

export function lierTicketPlanTest(db: Database.Database, entree: EntreeLierTicketPlanTest): Resultat<Sortie> {
  const ticket = db.prepare("SELECT id, titre FROM tickets WHERE id = ?").get(entree.ticket_id) as
    | { id: string; titre: string }
    | undefined;
  if (!ticket) {
    return { ok: false, erreur: `Ticket introuvable : ${entree.ticket_id}` };
  }

  const planTest = trouverPlanTest(db, entree.plan_test);
  if (!planTest) {
    return { ok: false, erreur: `Plan de test introuvable : ${entree.plan_test}` };
  }

  db.prepare("INSERT OR IGNORE INTO ticket_plans_test (ticket_id, plan_test_id) VALUES (?, ?)").run(
    ticket.id,
    planTest.id
  );

  return { ok: true, resume: `Lien confirmé : ticket « ${ticket.titre} » ↔ plan de test « ${entree.plan_test} ».` };
}
