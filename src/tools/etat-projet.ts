import { z } from "zod";
import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";
import { trouverProjet } from "../tickets/resolveur.js";

export const nom = "etat_projet";

export const description =
  "Sans paramètre : liste tous les projets avec un résumé (epics, tickets ouverts). Avec 'projet' : " +
  "détail d'un projet — ses epics, leurs tickets, et sa suite de recette (les plans de test liés à " +
  "ses tickets, avec le compte de cas réussis/échoués/à faire).";

export const schemaEntree = {
  projet: z.string().optional().describe("Nom du projet ; omis pour la liste de tous les projets"),
};

const schema = z.object(schemaEntree);
export type EntreeEtatProjet = z.infer<typeof schema>;

interface ProjetResume {
  nom: string;
  statut: string;
  epics: number;
  tickets_ouverts: number;
  tickets_total: number;
}

interface SortieListe {
  projets: ProjetResume[];
}

interface TicketDetail {
  id: string;
  titre: string;
  type: string;
  statut: string;
}

interface EpicDetail {
  nom: string;
  statut: string;
  tickets: TicketDetail[];
}

interface PlanTestResume {
  nom: string;
  cas_total: number;
  reussis: number;
  echoues: number;
  a_faire: number;
}

interface SortieDetail {
  projet: { nom: string; statut: string; description: string | null };
  epics: EpicDetail[];
  suite_recette: PlanTestResume[];
}

export function etatProjet(db: Database.Database, entree: EntreeEtatProjet): Resultat<SortieListe | SortieDetail> {
  if (!entree.projet) {
    const rows = db
      .prepare(
        `SELECT p.nom, p.statut,
                (SELECT COUNT(*) FROM epics e WHERE e.projet_id = p.id) AS epics,
                (SELECT COUNT(*) FROM tickets t JOIN epics e ON e.id = t.epic_id
                  WHERE e.projet_id = p.id) AS tickets_total,
                (SELECT COUNT(*) FROM tickets t JOIN epics e ON e.id = t.epic_id
                  WHERE e.projet_id = p.id AND t.statut != 'termine') AS tickets_ouverts
         FROM projets p ORDER BY p.nom`
      )
      .all() as ProjetResume[];
    return { ok: true, projets: rows };
  }

  const projet = trouverProjet(db, entree.projet);
  if (!projet) {
    return { ok: false, erreur: `Projet introuvable : ${entree.projet}` };
  }

  const projetRow = db.prepare("SELECT nom, statut, description FROM projets WHERE id = ?").get(projet.id) as {
    nom: string;
    statut: string;
    description: string | null;
  };

  const epicRows = db
    .prepare("SELECT id, nom, statut FROM epics WHERE projet_id = ? ORDER BY cree_le")
    .all(projet.id) as { id: string; nom: string; statut: string }[];

  const ticketsParEpic = db.prepare(
    "SELECT id, titre, type, statut FROM tickets WHERE epic_id = ? ORDER BY cree_le"
  );
  const epics: EpicDetail[] = epicRows.map((e) => ({
    nom: e.nom,
    statut: e.statut,
    tickets: ticketsParEpic.all(e.id) as TicketDetail[],
  }));

  const suiteRecette = db
    .prepare(
      `SELECT pt.nom,
              COUNT(ct.id) AS cas_total,
              SUM(CASE WHEN ct.statut = 'reussi' THEN 1 ELSE 0 END) AS reussis,
              SUM(CASE WHEN ct.statut = 'echoue' THEN 1 ELSE 0 END) AS echoues,
              SUM(CASE WHEN ct.statut = 'a_faire' THEN 1 ELSE 0 END) AS a_faire
       FROM plans_test pt
       JOIN ticket_plans_test tpt ON tpt.plan_test_id = pt.id
       JOIN tickets t ON t.id = tpt.ticket_id
       JOIN epics e ON e.id = t.epic_id
       LEFT JOIN cas_test ct ON ct.plan_test_id = pt.id
       WHERE e.projet_id = ?
       GROUP BY pt.id, pt.nom
       ORDER BY pt.nom`
    )
    .all(projet.id) as PlanTestResume[];

  return { ok: true, projet: projetRow, epics, suite_recette: suiteRecette };
}
