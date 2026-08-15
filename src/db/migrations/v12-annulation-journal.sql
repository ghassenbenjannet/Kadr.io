-- Jalon 4 (Prompt L) : les 4 entités du journal (demandes, decisions,
-- changements, incidents) ne se suppriment plus — seule l'annulation reste
-- possible, avec un motif obligatoire, pour que le registre garde une trace
-- de tout ce qui a existé (garde-fou contre le silençage de constats via
-- suppression). ALTER ADD COLUMN suffit : pas de contrainte à retirer, donc
-- pas de reconstruction de table comme v11.

ALTER TABLE demandes ADD COLUMN annule_le TEXT;
ALTER TABLE demandes ADD COLUMN annulation_raison TEXT;

ALTER TABLE decisions ADD COLUMN annule_le TEXT;
ALTER TABLE decisions ADD COLUMN annulation_raison TEXT;

ALTER TABLE changements ADD COLUMN annule_le TEXT;
ALTER TABLE changements ADD COLUMN annulation_raison TEXT;

ALTER TABLE incidents ADD COLUMN annule_le TEXT;
ALTER TABLE incidents ADD COLUMN annulation_raison TEXT;
