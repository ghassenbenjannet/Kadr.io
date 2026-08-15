import type Database from "better-sqlite3";
import {
  executerControlesPratique,
  type ChangementRow,
  type Constat,
  type DecisionRow,
  type DemandeRow,
  type IncidentRow,
} from "./pratique.js";

export interface FamilleControle {
  /** Nom exposé dans lancer_controles.perimetre. */
  nom: string;
  /** Codes de contrôle appartenant à cette famille (ex: C1..C6). */
  codes: string[];
  calculer: (db: Database.Database) => Constat[];
}

const FAMILLE_PRATIQUE: FamilleControle = {
  nom: "pratique",
  codes: ["C1", "C2", "C3", "C4", "C5", "C6"],
  calculer: (db) => {
    const changements = db
      .prepare("SELECT id, cree_le, rollback, test_effectue, demande_id, decision_id FROM changements")
      .all() as ChangementRow[];
    const decisions = db.prepare("SELECT id, statut, decideur FROM decisions").all() as DecisionRow[];
    const demandes = db
      .prepare("SELECT id, cree_le, statut, equipe FROM demandes")
      .all() as DemandeRow[];
    const incidents = db
      .prepare("SELECT id, resolu_le, action_preventive FROM incidents")
      .all() as IncidentRow[];
    return executerControlesPratique({ changements, decisions, demandes, incidents });
  },
};

// Jalon 2 ajoutera FAMILLE_MODELE ('modele', M1-M4) et FAMILLE_INTEGRATION
// ('integration', I1-I7) ici.
const FAMILLES: FamilleControle[] = [FAMILLE_PRATIQUE];

export function toutesLesFamilles(): FamilleControle[] {
  return FAMILLES;
}

export function famillesPour(perimetre: string): FamilleControle[] {
  if (perimetre === "tous") return FAMILLES;
  return FAMILLES.filter((f) => f.nom === perimetre);
}

export function enregistrerFamille(famille: FamilleControle): void {
  if (FAMILLES.some((f) => f.nom === famille.nom)) return;
  FAMILLES.push(famille);
}
