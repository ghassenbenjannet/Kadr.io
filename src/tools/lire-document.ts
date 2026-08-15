import { z } from "zod";
import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";

export const nom = "lire_document";

export const description =
  "Lit le contenu complet d'une page de documentation — de projet ou de la base de connaissances " +
  "— à partir de son identifiant (obtenu via rechercher_connaissance, etat_projet, ou un appel " +
  "précédent à creer_document).";

export const schemaEntree = {
  id: z.string().min(1),
};

const schema = z.object(schemaEntree);
export type EntreeLireDocument = z.infer<typeof schema>;

interface Sortie {
  titre: string;
  type: string;
  contenu: string;
  projet: string | null;
}

export function lireDocument(db: Database.Database, entree: EntreeLireDocument): Resultat<Sortie> {
  const row = db
    .prepare(
      `SELECT d.titre, d.type, d.contenu, p.nom AS projet_nom
       FROM documents d LEFT JOIN projets p ON p.id = d.projet_id
       WHERE d.id = ?`
    )
    .get(entree.id) as { titre: string; type: string; contenu: string; projet_nom: string | null } | undefined;
  if (!row) {
    return { ok: false, erreur: "Page introuvable." };
  }

  return { ok: true, titre: row.titre, type: row.type, contenu: row.contenu, projet: row.projet_nom };
}
