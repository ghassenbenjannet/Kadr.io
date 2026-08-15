-- Un projet peut réaliser plusieurs demandes (un chantier qui regroupe
-- plusieurs besoins clients), et une demande peut être reprise dans
-- plusieurs projets si elle est redécoupée — projets.demande_id (v5, un
-- seul lien) ne pouvait représenter que le premier cas. Passe en table de
-- liaison, comme ticket_plans_test.

CREATE TABLE projet_demandes (
  projet_id     TEXT NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
  demande_id    TEXT NOT NULL REFERENCES demandes(id) ON DELETE CASCADE,
  PRIMARY KEY (projet_id, demande_id)
);

INSERT INTO projet_demandes (projet_id, demande_id)
  SELECT id, demande_id FROM projets WHERE demande_id IS NOT NULL;

ALTER TABLE projets DROP COLUMN demande_id;

CREATE INDEX idx_projet_demandes_demande ON projet_demandes(demande_id);
