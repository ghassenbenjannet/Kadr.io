// Lecture pour les écrans Projets (GET /api/projets, /api/projets/:id) —
// résolution par id (pas par nom comme le fait l'outil agent etat_projet),
// plus adaptée à une URL.

import type Database from "better-sqlite3";

export interface ProjetResume {
  id: string;
  nom: string;
  statut: string;
  epics: number;
  tickets_total: number;
  tickets_ouverts: number;
}

export function listerProjets(db: Database.Database): ProjetResume[] {
  return db
    .prepare(
      `SELECT p.id, p.nom, p.statut,
              (SELECT COUNT(*) FROM epics e WHERE e.projet_id = p.id) AS epics,
              (SELECT COUNT(*) FROM tickets t JOIN epics e ON e.id = t.epic_id
                WHERE e.projet_id = p.id) AS tickets_total,
              (SELECT COUNT(*) FROM tickets t JOIN epics e ON e.id = t.epic_id
                WHERE e.projet_id = p.id AND t.statut != 'termine') AS tickets_ouverts
       FROM projets p ORDER BY p.nom`
    )
    .all() as ProjetResume[];
}

export interface TicketDetail {
  id: string;
  titre: string;
  type: string;
  statut: string;
}

export interface EpicDetail {
  id: string;
  nom: string;
  statut: string;
  tickets: TicketDetail[];
}

export interface CasTestDetail {
  id: string;
  etape: string;
  resultat_attendu: string;
  statut: string;
  executee_par: string | null;
  executee_le: string | null;
}

export interface PlanTestDetail {
  id: string;
  nom: string;
  cas: CasTestDetail[];
}

export interface ProjetDetail {
  projet: { id: string; nom: string; statut: string; description: string | null };
  epics: EpicDetail[];
  suite_recette: PlanTestDetail[];
}

export function detailProjet(db: Database.Database, id: string): ProjetDetail | null {
  const projet = db.prepare("SELECT id, nom, statut, description FROM projets WHERE id = ?").get(id) as
    | { id: string; nom: string; statut: string; description: string | null }
    | undefined;
  if (!projet) return null;

  const epicRows = db
    .prepare("SELECT id, nom, statut FROM epics WHERE projet_id = ? ORDER BY cree_le")
    .all(id) as { id: string; nom: string; statut: string }[];
  const ticketsParEpic = db.prepare(
    "SELECT id, titre, type, statut FROM tickets WHERE epic_id = ? ORDER BY cree_le"
  );
  const epics: EpicDetail[] = epicRows.map((e) => ({
    ...e,
    tickets: ticketsParEpic.all(e.id) as TicketDetail[],
  }));

  const planRows = db
    .prepare(
      `SELECT DISTINCT pt.id, pt.nom
       FROM plans_test pt
       JOIN ticket_plans_test tpt ON tpt.plan_test_id = pt.id
       JOIN tickets t ON t.id = tpt.ticket_id
       JOIN epics e ON e.id = t.epic_id
       WHERE e.projet_id = ?
       ORDER BY pt.nom`
    )
    .all(id) as { id: string; nom: string }[];
  const casParPlan = db.prepare(
    "SELECT id, etape, resultat_attendu, statut, executee_par, executee_le FROM cas_test WHERE plan_test_id = ? ORDER BY cree_le"
  );
  const suiteRecette: PlanTestDetail[] = planRows.map((p) => ({
    ...p,
    cas: casParPlan.all(p.id) as CasTestDetail[],
  }));

  return { projet, epics, suite_recette: suiteRecette };
}
