import { z } from "zod";
import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";

export const nom = "rechercher_connaissance";

export const description =
  "Recherche en texte libre dans la base de connaissances (pages sans projet : existant de " +
  "l'entreprise, spécifications de référence, conventions). À utiliser avant d'analyser une demande " +
  "ou de proposer une architecture de solution — pour partir de ce qui est déjà documenté plutôt " +
  "que de deviner. Retourne un extrait ; lire_document donne le contenu complet.";

export const schemaEntree = {
  question: z.string().min(1).describe("La question ou les mots-clés à rechercher"),
};

const schema = z.object(schemaEntree);
export type EntreeRechercherConnaissance = z.infer<typeof schema>;

interface ResultatRecherche {
  id: string;
  titre: string;
  type: string;
  extrait: string;
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

export function rechercherConnaissance(
  db: Database.Database,
  entree: EntreeRechercherConnaissance
): Resultat<Sortie> {
  const requeteFts = construireRequeteFts(entree.question);
  if (!requeteFts) {
    return { ok: true, resultats: [] };
  }

  const lignes = db
    .prepare(
      `SELECT d.id, d.titre, d.type, snippet(documents_fts, 1, '', '', '…', 16) AS extrait,
              bm25(documents_fts) AS score
       FROM documents_fts
       JOIN documents d ON d.rowid = documents_fts.rowid
       WHERE documents_fts MATCH ? AND d.projet_id IS NULL
       ORDER BY score
       LIMIT 20`
    )
    .all(requeteFts) as (ResultatRecherche & { score: number })[];

  return { ok: true, resultats: lignes.map(({ score, ...reste }) => reste) };
}
