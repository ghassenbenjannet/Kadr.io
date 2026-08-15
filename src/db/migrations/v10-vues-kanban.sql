-- Vues sauvegardées du kanban configurable (écran "Kanban") : quelle entité
-- afficher (demande ou ticket) et avec quels filtres (projet, epic), sous
-- un nom qu'on peut recharger ou supprimer — évite de reconfigurer les
-- mêmes filtres à chaque visite.

CREATE TABLE vues_kanban (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  nom           TEXT NOT NULL UNIQUE,
  entite        TEXT NOT NULL CHECK (entite IN ('demande','ticket')),
  filtres       TEXT NOT NULL DEFAULT '{}',
  maj_le        TEXT NOT NULL
);
