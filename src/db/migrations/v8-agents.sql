-- Modes de travail spécialisés ("Agents"), jusqu'ici codés en dur dans
-- agent/modes.ts + fichiers agent/modes/*.md — impossible à personnaliser
-- sans rebuild de l'image Docker (montée en lecture seule sous /app). Passe
-- en DB pour vivre dans /data (le volume persistant) et devenir éditable
-- depuis l'écran "Agents". Le seed des 4 modes existants se fait en code
-- (src/agent/modes.ts), pas ici, pour ne pas dupliquer leur contenu dans un
-- fichier de migration.

CREATE TABLE agents_modes (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  cle           TEXT NOT NULL UNIQUE,
  titre         TEXT NOT NULL,
  description   TEXT,
  contenu       TEXT NOT NULL,
  maj_le        TEXT NOT NULL
);
