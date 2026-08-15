import { z } from "zod";
import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";

export const nom = "rechercher_journal";

export const description =
  "Recherche en texte libre dans tout le journal (demandes, décisions, changements, incidents) : " +
  "« qu'ai-je changé en octobre sur les devis ? ». Retourne jusqu'à 20 résultats, les plus " +
  "pertinents d'abord, avec un extrait et une phrase repère lisible en conversation.";

export const schemaEntree = {
  question: z.string().min(1).describe("La question ou les mots-clés à rechercher"),
  depuis: z.string().optional().describe("Date ISO 8601, borne basse sur la date de création"),
  jusqu_a: z.string().optional().describe("Date ISO 8601, borne haute sur la date de création"),
  entites: z
    .array(z.enum(["demande", "decision", "changement", "incident"]))
    .optional()
    .describe("Limiter la recherche à ces types d'entité (défaut : toutes)"),
};

const schema = z.object(schemaEntree);
export type EntreeRechercherJournal = z.infer<typeof schema>;

interface ResultatRecherche {
  entite: string;
  id: string;
  date: string;
  extrait: string;
  lien_conversationnel: string;
}

interface Sortie {
  resultats: ResultatRecherche[];
}

function construireRequeteFts(question: string): string {
  const tokens = question
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length > 0);
  return tokens.map((t) => `${t}*`).join(" ");
}

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  const jour = String(d.getUTCDate()).padStart(2, "0");
  const mois = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}`;
}

interface Detail {
  date: string;
  lien: string;
}

function recupererDetail(db: Database.Database, entite: string, id: string): Detail | null {
  switch (entite) {
    case "demande": {
      const row = db
        .prepare("SELECT cree_le, demandeur, equipe FROM demandes WHERE id = ?")
        .get(id) as { cree_le: string; demandeur: string; equipe: string } | undefined;
      if (!row) return null;
      return { date: row.cree_le, lien: `demande du ${formatDateFr(row.cree_le)} : ${row.demandeur} (${row.equipe})` };
    }
    case "decision": {
      const row = db.prepare("SELECT cree_le, decision FROM decisions WHERE id = ?").get(id) as
        | { cree_le: string; decision: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, lien: `décision du ${formatDateFr(row.cree_le)} : ${row.decision}` };
    }
    case "changement": {
      const row = db.prepare("SELECT cree_le, description FROM changements WHERE id = ?").get(id) as
        | { cree_le: string; description: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, lien: `changement du ${formatDateFr(row.cree_le)} : ${row.description}` };
    }
    case "incident": {
      const row = db.prepare("SELECT cree_le, symptome FROM incidents WHERE id = ?").get(id) as
        | { cree_le: string; symptome: string }
        | undefined;
      if (!row) return null;
      return { date: row.cree_le, lien: `incident du ${formatDateFr(row.cree_le)} : ${row.symptome}` };
    }
    default:
      return null;
  }
}

export function rechercherJournal(
  db: Database.Database,
  entree: EntreeRechercherJournal
): Resultat<Sortie> {
  const requeteFts = construireRequeteFts(entree.question);
  if (!requeteFts) {
    return { ok: true, resultats: [] };
  }

  const lignesFts = db
    .prepare(
      `SELECT entite, entite_id, snippet(journal_fts, 2, '', '', '…', 12) AS extrait, bm25(journal_fts) AS score
       FROM journal_fts
       WHERE journal_fts MATCH ?
       ORDER BY score`
    )
    .all(requeteFts) as { entite: string; entite_id: string; extrait: string; score: number }[];

  interface Candidat extends ResultatRecherche {
    score: number;
  }

  const candidats: Candidat[] = [];

  for (const ligne of lignesFts) {
    if (entree.entites && !entree.entites.includes(ligne.entite as never)) continue;
    const detail = recupererDetail(db, ligne.entite, ligne.entite_id);
    if (!detail) continue;
    if (entree.depuis && detail.date < entree.depuis) continue;
    if (entree.jusqu_a && detail.date > entree.jusqu_a) continue;
    candidats.push({
      entite: ligne.entite,
      id: ligne.entite_id,
      date: detail.date,
      extrait: ligne.extrait,
      lien_conversationnel: detail.lien,
      score: ligne.score,
    });
  }

  candidats.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.date.localeCompare(a.date);
  });

  const resultats = candidats.slice(0, 20).map(({ score, ...reste }) => reste);

  return { ok: true, resultats };
}
