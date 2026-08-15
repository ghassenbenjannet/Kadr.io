CREATE TABLE systemes (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  nom         TEXT NOT NULL UNIQUE,          -- 'Zoho CRM', 'App Devis', 'Zoho Books'…
  role        TEXT NOT NULL,                 -- une phrase
  editeur     TEXT,
  criticite   TEXT NOT NULL DEFAULT 'moyenne' CHECK (criticite IN ('haute','moyenne','basse')),
  contact_support TEXT,
  maj_le      TEXT NOT NULL
);

CREATE TABLE modules (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  systeme_id  TEXT NOT NULL REFERENCES systemes(id),
  nom         TEXT NOT NULL,
  api_name    TEXT,                          -- rempli par l'import Zoho au jalon 3
  role_metier TEXT,
  equipes     TEXT,                          -- JSON: ["CS","ADV"]
  maj_le      TEXT NOT NULL,
  UNIQUE (systeme_id, nom)
);

CREATE TABLE champs (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  module_id     TEXT NOT NULL REFERENCES modules(id),
  nom           TEXT NOT NULL,
  api_name      TEXT,
  type          TEXT,                        -- 'texte','liste','devise','nombre','date','booleen','lookup','formule','autre'
  source_de_verite TEXT,                     -- nom de système, texte libre. NULL = non déclaré (contrôlé M1)
  editable      INTEGER,                     -- 0/1, NULL = non déclaré
  regle_metier  TEXT,
  fraicheur     TEXT,                        -- 'temps réel','J+1','manuelle'…
  maj_le        TEXT NOT NULL,
  UNIQUE (module_id, nom)
);

CREATE TABLE habilitations (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  profil      TEXT NOT NULL,                 -- 'CSM','ADV','Manager CS','Admin'…
  champ_id    TEXT NOT NULL REFERENCES champs(id),
  visible     INTEGER NOT NULL DEFAULT 1,
  editable    INTEGER NOT NULL DEFAULT 0,
  justification TEXT,                        -- contrôlé M3 si absente sur un champ sensible
  maj_le      TEXT NOT NULL,
  UNIQUE (profil, champ_id)
);

CREATE TABLE integrations (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  nom           TEXT NOT NULL UNIQUE,        -- 'Devis → CRM'
  source_id     TEXT NOT NULL REFERENCES systemes(id),
  cible_id      TEXT NOT NULL REFERENCES systemes(id),
  auth          TEXT,                        -- 'OAuth2','clé API'…
  strategie     TEXT,                        -- 'event','batch delta','batch complet'
  idempotence   TEXT,                        -- clé/règle. NULL contrôlé I1
  matching      TEXT,                        -- règle de rapprochement. NULL contrôlé I2
  regle_vide    TEXT,                        -- NULL contrôlé I3
  regle_suppression TEXT,
  procedure_reprise TEXT,                    -- NULL contrôlé I5
  maj_le        TEXT NOT NULL
);

CREATE TABLE integration_champs (             -- mapping N-N intégration ↔ champs
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  champ_id       TEXT NOT NULL REFERENCES champs(id),
  sens           TEXT NOT NULL CHECK (sens IN ('lit','ecrit')),
  PRIMARY KEY (integration_id, champ_id, sens)
);

CREATE TABLE erreurs_integration (
  id             TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  titre          TEXT NOT NULL,
  nature         TEXT CHECK (nature IN ('fonctionnelle','technique')),  -- NULL contrôlé I4
  traitement     TEXT,
  rejeu          TEXT,
  maj_le         TEXT NOT NULL
);

CREATE TABLE metriques (
  id             TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  nom            TEXT NOT NULL,
  seuil          TEXT,                       -- NULL contrôlé I6
  maj_le         TEXT NOT NULL
);

CREATE TABLE automatisations (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  module_id   TEXT REFERENCES modules(id),
  nom         TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('workflow','deluge','blueprint','regle_validation','planifie','autre')),
  declencheur TEXT,
  maj_le      TEXT NOT NULL
);

CREATE TABLE automatisation_champs (          -- quels champs une automatisation touche
  automatisation_id TEXT NOT NULL REFERENCES automatisations(id),
  champ_id          TEXT NOT NULL REFERENCES champs(id),
  sens              TEXT NOT NULL CHECK (sens IN ('lit','ecrit')),
  PRIMARY KEY (automatisation_id, champ_id, sens)
);

-- Lien générique carte ↔ journal : quel changement a touché quel élément
CREATE TABLE carte_journal (
  entite_carte  TEXT NOT NULL,               -- 'champ','module','integration','automatisation','habilitation'
  carte_id      TEXT NOT NULL,
  changement_id TEXT NOT NULL REFERENCES changements(id),
  PRIMARY KEY (entite_carte, carte_id, changement_id)
);

-- Extension du FTS aux entités de la carte : systemes, modules, champs, integrations, automatisations.

CREATE TRIGGER systemes_fts_insert AFTER INSERT ON systemes BEGIN
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('systeme', new.id, new.nom || ' ' || new.role || ' ' || coalesce(new.editeur, ''));
END;

CREATE TRIGGER systemes_fts_update AFTER UPDATE ON systemes BEGIN
  DELETE FROM journal_fts WHERE entite = 'systeme' AND entite_id = old.id;
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('systeme', new.id, new.nom || ' ' || new.role || ' ' || coalesce(new.editeur, ''));
END;

CREATE TRIGGER modules_fts_insert AFTER INSERT ON modules BEGIN
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('module', new.id, new.nom || ' ' || coalesce(new.role_metier, ''));
END;

CREATE TRIGGER modules_fts_update AFTER UPDATE ON modules BEGIN
  DELETE FROM journal_fts WHERE entite = 'module' AND entite_id = old.id;
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('module', new.id, new.nom || ' ' || coalesce(new.role_metier, ''));
END;

CREATE TRIGGER champs_fts_insert AFTER INSERT ON champs BEGIN
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('champ', new.id, new.nom || ' ' || coalesce(new.source_de_verite, '') || ' ' || coalesce(new.regle_metier, ''));
END;

CREATE TRIGGER champs_fts_update AFTER UPDATE ON champs BEGIN
  DELETE FROM journal_fts WHERE entite = 'champ' AND entite_id = old.id;
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('champ', new.id, new.nom || ' ' || coalesce(new.source_de_verite, '') || ' ' || coalesce(new.regle_metier, ''));
END;

CREATE TRIGGER integrations_fts_insert AFTER INSERT ON integrations BEGIN
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('integration', new.id, new.nom || ' ' || coalesce(new.strategie, ''));
END;

CREATE TRIGGER integrations_fts_update AFTER UPDATE ON integrations BEGIN
  DELETE FROM journal_fts WHERE entite = 'integration' AND entite_id = old.id;
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('integration', new.id, new.nom || ' ' || coalesce(new.strategie, ''));
END;

CREATE TRIGGER automatisations_fts_insert AFTER INSERT ON automatisations BEGIN
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('automatisation', new.id, new.nom || ' ' || coalesce(new.declencheur, ''));
END;

CREATE TRIGGER automatisations_fts_update AFTER UPDATE ON automatisations BEGIN
  DELETE FROM journal_fts WHERE entite = 'automatisation' AND entite_id = old.id;
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('automatisation', new.id, new.nom || ' ' || coalesce(new.declencheur, ''));
END;
