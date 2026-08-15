// Lecture + écriture directe pour l'écran "Plans de test" (GET/POST/DELETE
// /api/plans-test, POST /api/plans-test/:id/cas, DELETE /api/cas-test/:id,
// et le lien plan <-> ticket depuis la fiche ticket) — jusqu'ici les plans
// de test n'étaient créables, liables et exécutables que par l'agent IA
// (creer_plan_test / lier_ticket_plan_test / executer_cas_test), donc
// invisibles et inutilisables sans clé de modèle configurée.

import type Database from "better-sqlite3";
import { z } from "zod";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import type { CasTestDetail, PlanTestDetail } from "./projets.js";

export interface PlanTestResume {
  id: string;
  nom: string;
  description: string | null;
  cree_le: string;
  cas_total: number;
  cas_reussis: number;
  cas_echoues: number;
}

export function listerPlansTest(db: Database.Database): PlanTestResume[] {
  return db
    .prepare(
      `SELECT pt.id, pt.nom, pt.description, pt.cree_le,
              (SELECT COUNT(*) FROM cas_test c WHERE c.plan_test_id = pt.id) AS cas_total,
              (SELECT COUNT(*) FROM cas_test c WHERE c.plan_test_id = pt.id AND c.statut = 'reussi') AS cas_reussis,
              (SELECT COUNT(*) FROM cas_test c WHERE c.plan_test_id = pt.id AND c.statut = 'echoue') AS cas_echoues
       FROM plans_test pt ORDER BY pt.nom`
    )
    .all() as PlanTestResume[];
}

export interface PlanTestComplet extends PlanTestDetail {
  description: string | null;
  cree_le: string;
  tickets: { id: string; titre: string; epic_nom: string; projet_id: string; projet_nom: string }[];
}

export function detailPlanTest(db: Database.Database, id: string): PlanTestComplet | null {
  const plan = db.prepare("SELECT id, nom, description, cree_le FROM plans_test WHERE id = ?").get(id) as
    | { id: string; nom: string; description: string | null; cree_le: string }
    | undefined;
  if (!plan) return null;

  const cas = db
    .prepare(
      "SELECT id, etape, resultat_attendu, statut, executee_par, executee_le FROM cas_test WHERE plan_test_id = ? ORDER BY cree_le"
    )
    .all(id) as CasTestDetail[];

  const tickets = db
    .prepare(
      `SELECT t.id, t.titre, e.nom AS epic_nom, p.id AS projet_id, p.nom AS projet_nom
       FROM tickets t
       JOIN ticket_plans_test tpt ON tpt.ticket_id = t.id
       JOIN epics e ON e.id = t.epic_id
       JOIN projets p ON p.id = e.projet_id
       WHERE tpt.plan_test_id = ?
       ORDER BY t.titre`
    )
    .all(id) as { id: string; titre: string; epic_nom: string; projet_id: string; projet_nom: string }[];

  return { ...plan, cas, tickets };
}

export function supprimerPlanTest(db: Database.Database, id: string): Resultat<{ id: string }> {
  const existant = db.prepare("SELECT id FROM plans_test WHERE id = ?").get(id);
  if (!existant) return { ok: false, erreur: "Plan de test introuvable." };
  db.prepare("DELETE FROM plans_test WHERE id = ?").run(id);
  return { ok: true, id };
}

export const schemaAjouterCasTest = {
  plan_test_id: z.string().min(1),
  etape: z.string().min(1),
  resultat_attendu: z.string().min(1),
};

export function ajouterCasTest(
  db: Database.Database,
  entree: z.infer<ReturnType<typeof z.object<typeof schemaAjouterCasTest>>>
): Resultat<{ id: string }> {
  const plan = db.prepare("SELECT id FROM plans_test WHERE id = ?").get(entree.plan_test_id);
  if (!plan) return { ok: false, erreur: "Plan de test introuvable." };
  const id = nouvelId();
  const maintenant = maintenantIso();
  db.prepare(
    `INSERT INTO cas_test (id, cree_le, plan_test_id, etape, resultat_attendu, statut, maj_le)
     VALUES (?, ?, ?, ?, ?, 'a_faire', ?)`
  ).run(id, maintenant, entree.plan_test_id, entree.etape, entree.resultat_attendu, maintenant);
  return { ok: true, id };
}

export function supprimerCasTest(db: Database.Database, id: string): Resultat<{ id: string }> {
  const existant = db.prepare("SELECT id FROM cas_test WHERE id = ?").get(id);
  if (!existant) return { ok: false, erreur: "Cas de test introuvable." };
  db.prepare("DELETE FROM cas_test WHERE id = ?").run(id);
  return { ok: true, id };
}

export function lierTicketPlanTestParId(
  db: Database.Database,
  ticketId: string,
  planTestId: string
): Resultat<{ ticket_id: string; plan_test_id: string }> {
  const ticket = db.prepare("SELECT id FROM tickets WHERE id = ?").get(ticketId);
  if (!ticket) return { ok: false, erreur: "Ticket introuvable." };
  const plan = db.prepare("SELECT id FROM plans_test WHERE id = ?").get(planTestId);
  if (!plan) return { ok: false, erreur: "Plan de test introuvable." };
  db.prepare("INSERT OR IGNORE INTO ticket_plans_test (ticket_id, plan_test_id) VALUES (?, ?)").run(
    ticketId,
    planTestId
  );
  return { ok: true, ticket_id: ticketId, plan_test_id: planTestId };
}

export function delierTicketPlanTest(db: Database.Database, ticketId: string, planTestId: string): Resultat<object> {
  db.prepare("DELETE FROM ticket_plans_test WHERE ticket_id = ? AND plan_test_id = ?").run(ticketId, planTestId);
  return { ok: true };
}
