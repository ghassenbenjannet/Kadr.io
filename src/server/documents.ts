// Lecture pour l'éditeur de documents. L'écriture directe (sans passage par
// l'agent) vit dans app.ts : elle réutilise les outils creer_document /
// mettre_a_jour_document après validation zod du corps de requête — voir
// le commentaire au-dessus des routes POST/PUT /api/documents.

import type Database from "better-sqlite3";

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

export interface DocumentDetail {
  id: string;
  titre: string;
  type: string;
  contenu: string;
  cree_le: string;
  maj_le: string;
  projet: { id: string; nom: string };
}

export function detailDocument(db: Database.Database, id: string): DocumentDetail | null {
  const row = db
    .prepare(
      `SELECT d.id, d.titre, d.type, d.contenu, d.cree_le, d.maj_le, p.id AS projet_id, p.nom AS projet_nom
       FROM documents d JOIN projets p ON p.id = d.projet_id
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
        projet_id: string;
        projet_nom: string;
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
    projet: { id: row.projet_id, nom: row.projet_nom },
  };
}
