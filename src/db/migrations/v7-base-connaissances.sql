-- Base de connaissances : les pages de documentation ne sont plus
-- obligatoirement rattachées à un projet. projet_id NULL = portée globale
-- (l'existant de l'entreprise, des spécifications de référence) — utile à
-- l'agent pour analyser une demande ou construire une architecture de
-- solution, indépendamment de tout projet en cours.
--
-- SQLite ne permet pas d'altérer une contrainte NOT NULL : on recrée la
-- table. Ajoute au passage le type 'architecture_existante' et la
-- recherche plein texte (même pattern que journal_fts).

CREATE TABLE documents_v7 (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  projet_id     TEXT REFERENCES projets(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN
                  ('cadrage', 'compte_rendu', 'specification', 'architecture_existante', 'note', 'autre')),
  titre         TEXT NOT NULL,
  contenu       TEXT NOT NULL DEFAULT '',
  maj_le        TEXT NOT NULL
);

INSERT INTO documents_v7 (id, cree_le, projet_id, type, titre, contenu, maj_le)
  SELECT id, cree_le, projet_id, type, titre, contenu, maj_le FROM documents;

DROP TABLE documents;
ALTER TABLE documents_v7 RENAME TO documents;

CREATE INDEX idx_documents_projet ON documents(projet_id);

CREATE VIRTUAL TABLE documents_fts USING fts5(
  titre, contenu,
  tokenize = 'unicode61 remove_diacritics 2'
);
INSERT INTO documents_fts (rowid, titre, contenu) SELECT rowid, titre, contenu FROM documents;

CREATE TRIGGER documents_fts_insert AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts (rowid, titre, contenu) VALUES (new.rowid, new.titre, new.contenu);
END;

CREATE TRIGGER documents_fts_update AFTER UPDATE ON documents BEGIN
  DELETE FROM documents_fts WHERE rowid = old.rowid;
  INSERT INTO documents_fts (rowid, titre, contenu) VALUES (new.rowid, new.titre, new.contenu);
END;
