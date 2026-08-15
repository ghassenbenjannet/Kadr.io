-- Suivi de projet : demande -> projet -> epic -> ticket, et une suite de
-- recette (plans de test, chacun une liste de cas à cocher) liée aux
-- tickets. Ajouté suite au retour "il faut un vrai suivi de tickets" —
-- distinct du registre (demandes/décisions/changements/incidents), qui
-- garde son rôle de mémoire : un projet peut naître d'une demande
-- (demande_id), mais ce qui se passe dedans est du travail, pas un constat.

CREATE TABLE projets (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  nom           TEXT NOT NULL UNIQUE,
  description   TEXT,
  demande_id    TEXT REFERENCES demandes(id),
  statut        TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif','clos')),
  maj_le        TEXT NOT NULL
);

CREATE TABLE epics (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  projet_id     TEXT NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  description   TEXT,
  statut        TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire','en_cours','termine')),
  maj_le        TEXT NOT NULL,
  UNIQUE (projet_id, nom)
);

CREATE TABLE tickets (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  epic_id       TEXT NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  titre         TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('analyse','documentation','atelier','bug','task')),
  statut        TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire','en_cours','bloque','termine')),
  maj_le        TEXT NOT NULL
);

CREATE TABLE plans_test (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  nom           TEXT NOT NULL UNIQUE,
  description   TEXT,
  maj_le        TEXT NOT NULL
);

CREATE TABLE cas_test (
  id                TEXT PRIMARY KEY,
  cree_le           TEXT NOT NULL,
  plan_test_id      TEXT NOT NULL REFERENCES plans_test(id) ON DELETE CASCADE,
  etape             TEXT NOT NULL,
  resultat_attendu  TEXT NOT NULL,
  statut            TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire','reussi','echoue')),
  executee_le       TEXT,
  executee_par      TEXT,
  maj_le            TEXT NOT NULL
);

-- Un ticket peut se lier à plusieurs plans de test, un plan de test peut
-- couvrir plusieurs tickets (ex : un plan de non-régression transverse).
CREATE TABLE ticket_plans_test (
  ticket_id     TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  plan_test_id  TEXT NOT NULL REFERENCES plans_test(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, plan_test_id)
);

CREATE INDEX idx_epics_projet ON epics(projet_id);
CREATE INDEX idx_tickets_epic ON tickets(epic_id);
CREATE INDEX idx_cas_test_plan ON cas_test(plan_test_id);
CREATE INDEX idx_ticket_plans_test_plan ON ticket_plans_test(plan_test_id);
