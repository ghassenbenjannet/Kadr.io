// Lecture pour l'éditeur de documents. L'écriture directe (sans passage par
// l'agent) vit dans app.ts : elle réutilise les outils creer_document /
// mettre_a_jour_document après validation zod du corps de requête — voir
// le commentaire au-dessus des routes POST/PUT /api/documents.

import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";

export interface DocumentResume {
  id: string;
  titre: string;
  type: string;
  maj_le: string;
}

export function listerDocuments(db: Database.Database, projetId: string): DocumentResume[] {
  return db
    .prepare("SELECT id, titre, type, maj_le FROM documents WHERE projet_id = ? ORDER BY maj_le DESC")
    .all(projetId) as DocumentResume[];
}

/** Pages de la base de connaissances : sans projet, portée globale. */
export function listerConnaissances(db: Database.Database): DocumentResume[] {
  return db
    .prepare("SELECT id, titre, type, maj_le FROM documents WHERE projet_id IS NULL ORDER BY maj_le DESC")
    .all() as DocumentResume[];
}

export interface DocumentDetail {
  id: string;
  titre: string;
  type: string;
  contenu: string;
  cree_le: string;
  maj_le: string;
  projet: { id: string; nom: string } | null;
}

export function detailDocument(db: Database.Database, id: string): DocumentDetail | null {
  const row = db
    .prepare(
      `SELECT d.id, d.titre, d.type, d.contenu, d.cree_le, d.maj_le, p.id AS projet_id, p.nom AS projet_nom
       FROM documents d LEFT JOIN projets p ON p.id = d.projet_id
       WHERE d.id = ?`
    )
    .get(id) as
    | {
        id: string;
        titre: string;
        type: string;
        contenu: string;
        cree_le: string;
        maj_le: string;
        projet_id: string | null;
        projet_nom: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    titre: row.titre,
    type: row.type,
    contenu: row.contenu,
    cree_le: row.cree_le,
    maj_le: row.maj_le,
    projet: row.projet_id ? { id: row.projet_id, nom: row.projet_nom! } : null,
  };
}

// Pas de trigger AFTER DELETE sur documents_fts (schema.sql v7) : le nettoyage
// de l'index plein texte est à la charge de l'appelant, comme pour journal_fts.
export function supprimerDocument(db: Database.Database, id: string): Resultat<{ id: string }> {
  const existant = db.prepare("SELECT rowid AS r FROM documents WHERE id = ?").get(id) as
    | { r: number }
    | undefined;
  if (!existant) return { ok: false, erreur: "Page introuvable." };

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM documents_fts WHERE rowid = ?").run(existant.r);
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  });
  transaction();

  return { ok: true, id };
}
