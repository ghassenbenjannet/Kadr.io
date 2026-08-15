-- Documentation libre par projet — pages markdown typées (cadrage,
-- compte-rendu, spécification, note). Distinct du registre : c'est de la
-- prose que Ghassen écrit lui-même, pas un fait structuré à valider.

CREATE TABLE documents (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  projet_id     TEXT NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('cadrage', 'compte_rendu', 'specification', 'note', 'autre')),
  titre         TEXT NOT NULL,
  contenu       TEXT NOT NULL DEFAULT '',
  maj_le        TEXT NOT NULL
);

CREATE INDEX idx_documents_projet ON documents(projet_id);
