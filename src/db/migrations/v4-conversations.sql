-- Jalon 1 bis, §4 : persistance des conversations avec l'agent (nommée "v1.5"
-- dans la spec ; portée ici comme la 4e migration séquentielle de la DB).

CREATE TABLE conversations (
  id        TEXT PRIMARY KEY,
  cree_le   TEXT NOT NULL,
  titre     TEXT,                 -- généré depuis le 1er message utilisateur
  maj_le    TEXT NOT NULL
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  cree_le         TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool_result')),
  contenu         TEXT NOT NULL,   -- JSON : blocs Anthropic (text, tool_use, tool_result)
  tokens_entree   INTEGER,
  tokens_sortie   INTEGER
);

CREATE TABLE ecritures_proposees (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  message_id      TEXT NOT NULL REFERENCES messages(id),
  tool_use_id     TEXT NOT NULL,   -- id du bloc tool_use Anthropic
  outil           TEXT NOT NULL,
  parametres      TEXT NOT NULL,   -- JSON, éditable par l'utilisateur avant validation
  statut          TEXT NOT NULL DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente','validee','rejetee','modifiee_validee')),
  resultat        TEXT,            -- JSON du retour après exécution
  tranche_le      TEXT
);
