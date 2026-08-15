PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Toutes les dates en ISO 8601 UTC (TEXT). Tous les id en TEXT (nanoid 12).

CREATE TABLE demandes (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  demandeur     TEXT NOT NULL,              -- nom de la personne
  equipe        TEXT NOT NULL CHECK (equipe IN
                  ('CS','AE','Marketing','ADV','Produit','Communication','Direction','Autre')),
  expression_brute TEXT NOT NULL,           -- verbatim, jamais modifié après création
  reformulation TEXT,                       -- nullable : peut venir plus tard
  type          TEXT NOT NULL CHECK (type IN
                  ('evolution','correction','question','acces','incident')),
  priorite      TEXT CHECK (priorite IN ('P1','P2','P3')),
  priorite_arbitree_par TEXT,               -- obligatoire si priorite non nulle (contrôle applicatif)
  statut        TEXT NOT NULL DEFAULT 'recue' CHECK (statut IN
                  ('recue','qualifiee','arbitree','realisee','refusee','reportee')),
  maj_le        TEXT NOT NULL
);

CREATE TABLE decisions (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  contexte      TEXT NOT NULL,
  options       TEXT NOT NULL,              -- JSON: [{option, ecartee_car}]
  decision      TEXT NOT NULL,
  decideur      TEXT NOT NULL,              -- 'moi' | 'CEO' | nom
  consequences  TEXT,
  statut        TEXT NOT NULL DEFAULT 'proposee' CHECK (statut IN
                  ('proposee','validee','appliquee','remplacee')),
  remplacee_par TEXT REFERENCES decisions(id),
  maj_le        TEXT NOT NULL
);

CREATE TABLE changements (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  description   TEXT NOT NULL,
  perimetre     TEXT NOT NULL,              -- texte libre jalon 1 ; liens carto au jalon 2
  type          TEXT NOT NULL CHECK (type IN
                  ('parametrage','deluge','sql','javascript','config_api','habilitations','autre')),
  rollback      TEXT,                       -- nullable MAIS contrôlé par la vigie (C1)
  test_effectue TEXT,                       -- nullable MAIS contrôlé (C2)
  communication TEXT,
  demande_id    TEXT REFERENCES demandes(id),
  decision_id   TEXT REFERENCES decisions(id),
  maj_le        TEXT NOT NULL
);

CREATE TABLE incidents (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  symptome      TEXT NOT NULL,
  impact        TEXT NOT NULL,
  cause         TEXT,
  changement_id TEXT REFERENCES changements(id),  -- le changement fautif s'il existe
  resolution    TEXT,
  resolu_le     TEXT,
  action_preventive TEXT,
  prevention_faite  INTEGER NOT NULL DEFAULT 0,   -- booléen 0/1
  maj_le        TEXT NOT NULL
);

-- Recherche plein texte sur tout le journal
CREATE VIRTUAL TABLE journal_fts USING fts5(
  entite, entite_id UNINDEXED, contenu,
  tokenize = 'unicode61 remove_diacritics 2'
);
-- Peuplée par triggers AFTER INSERT/UPDATE sur les 4 tables :
-- contenu = concaténation des champs texte de la ligne.

CREATE TABLE constats (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  controle    TEXT NOT NULL,                -- code C1..C6
  entite      TEXT NOT NULL,                -- 'changement' | 'decision' | 'demande' | 'incident'
  entite_id   TEXT NOT NULL,
  consequence TEXT NOT NULL,                -- rédigée, voir §4
  statut      TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','traite','accepte')),
  traite_le   TEXT,
  UNIQUE (controle, entite, entite_id)      -- un constat par (contrôle, objet) : rejouer ne duplique pas
);

-- Triggers FTS : demandes
CREATE TRIGGER demandes_fts_insert AFTER INSERT ON demandes BEGIN
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('demande', new.id, new.demandeur || ' ' || new.expression_brute || ' ' ||
    coalesce(new.reformulation, '') || ' ' || new.equipe || ' ' || new.type);
END;

CREATE TRIGGER demandes_fts_update AFTER UPDATE ON demandes BEGIN
  DELETE FROM journal_fts WHERE entite = 'demande' AND entite_id = old.id;
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('demande', new.id, new.demandeur || ' ' || new.expression_brute || ' ' ||
    coalesce(new.reformulation, '') || ' ' || new.equipe || ' ' || new.type);
END;

-- Triggers FTS : decisions
CREATE TRIGGER decisions_fts_insert AFTER INSERT ON decisions BEGIN
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('decision', new.id, new.contexte || ' ' || new.decision || ' ' ||
    new.decideur || ' ' || coalesce(new.consequences, ''));
END;

CREATE TRIGGER decisions_fts_update AFTER UPDATE ON decisions BEGIN
  DELETE FROM journal_fts WHERE entite = 'decision' AND entite_id = old.id;
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('decision', new.id, new.contexte || ' ' || new.decision || ' ' ||
    new.decideur || ' ' || coalesce(new.consequences, ''));
END;

-- Triggers FTS : changements
CREATE TRIGGER changements_fts_insert AFTER INSERT ON changements BEGIN
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('changement', new.id, new.description || ' ' || new.perimetre || ' ' ||
    new.type || ' ' || coalesce(new.rollback, '') || ' ' || coalesce(new.communication, ''));
END;

CREATE TRIGGER changements_fts_update AFTER UPDATE ON changements BEGIN
  DELETE FROM journal_fts WHERE entite = 'changement' AND entite_id = old.id;
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('changement', new.id, new.description || ' ' || new.perimetre || ' ' ||
    new.type || ' ' || coalesce(new.rollback, '') || ' ' || coalesce(new.communication, ''));
END;

-- Triggers FTS : incidents
CREATE TRIGGER incidents_fts_insert AFTER INSERT ON incidents BEGIN
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('incident', new.id, new.symptome || ' ' || new.impact || ' ' ||
    coalesce(new.cause, '') || ' ' || coalesce(new.resolution, '') || ' ' ||
    coalesce(new.action_preventive, ''));
END;

CREATE TRIGGER incidents_fts_update AFTER UPDATE ON incidents BEGIN
  DELETE FROM journal_fts WHERE entite = 'incident' AND entite_id = old.id;
  INSERT INTO journal_fts (entite, entite_id, contenu)
  VALUES ('incident', new.id, new.symptome || ' ' || new.impact || ' ' ||
    coalesce(new.cause, '') || ' ' || coalesce(new.resolution, '') || ' ' ||
    coalesce(new.action_preventive, ''));
END;
