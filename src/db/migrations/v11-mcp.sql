-- Jalon 4 (transport MCP) : ecritures_proposees exigeait conversation_id et
-- message_id NOT NULL — une écriture née hors conversation (serveur MCP,
-- appelé depuis Claude Desktop) n'a ni l'un ni l'autre. SQLite ne sait pas
-- retirer un NOT NULL par ALTER : reconstruction de table (même pattern que
-- les migrations v2-v10). Le schéma de départ (colonnes id/conversation_id/
-- message_id/tool_use_id/outil/parametres/statut/resultat/tranche_le) est
-- celui de v4-conversations.sql, jamais modifié depuis — vérifié avant
-- d'écrire cette migration, voir tests/migration-v11.test.ts qui compare les
-- colonnes avant/après pour empêcher toute perte silencieuse si ça change.

CREATE TABLE ecritures_proposees_v11 (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  message_id      TEXT REFERENCES messages(id),
  origine         TEXT NOT NULL DEFAULT 'app' CHECK (origine IN ('app','mcp')),
  tool_use_id     TEXT NOT NULL,
  outil           TEXT NOT NULL,
  parametres      TEXT NOT NULL,
  statut          TEXT NOT NULL DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente','validee','rejetee','modifiee_validee')),
  resultat        TEXT,
  tranche_le      TEXT
);

INSERT INTO ecritures_proposees_v11
  SELECT id, conversation_id, message_id, 'app', tool_use_id, outil, parametres,
         statut, resultat, tranche_le
  FROM ecritures_proposees;

DROP TABLE ecritures_proposees;
ALTER TABLE ecritures_proposees_v11 RENAME TO ecritures_proposees;
