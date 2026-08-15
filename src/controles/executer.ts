import type Database from "better-sqlite3";
import {
  executerControlesPratique,
  type ChangementRow,
  type DecisionRow,
  type DemandeRow,
  type IncidentRow,
} from "./pratique.js";
import {
  executerControlesModele,
  type ChampRow,
  type HabilitationRow,
  type ModuleSansChampRow,
} from "./modele.js";
import {
  executerControlesIntegration,
  type ErreurIntegrationRow,
  type IntegrationRow,
  type MetriqueRow,
} from "./integration.js";
import type { Constat } from "./types.js";

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
  // annule_le IS NULL sur les 4 requêtes : une entrée annulée (Prompt L)
  // sort ainsi automatiquement de la vigie — lancer_controles étant
  // idempotent, un constat déjà ouvert sur une entrée annulée passe en
  // 'traité' au prochain passage (voir la boucle existants/clesActives
  // plus bas, inchangée).
  calculer: (db) => {
    const changements = db
      .prepare("SELECT id, cree_le, rollback, test_effectue, demande_id, decision_id FROM changements WHERE annule_le IS NULL")
      .all() as ChangementRow[];
    const decisions = db
      .prepare("SELECT id, statut, decideur FROM decisions WHERE annule_le IS NULL")
      .all() as DecisionRow[];
    const demandes = db
      .prepare("SELECT id, cree_le, statut, equipe FROM demandes WHERE annule_le IS NULL")
      .all() as DemandeRow[];
    const incidents = db
      .prepare("SELECT id, resolu_le, action_preventive FROM incidents WHERE annule_le IS NULL")
      .all() as IncidentRow[];
    return executerControlesPratique({ changements, decisions, demandes, incidents });
  },
};

const FAMILLE_MODELE: FamilleControle = {
  nom: "modele",
  codes: ["M1", "M2", "M3", "M4"],
  calculer: (db) => {
    const champs = db
      .prepare(
        `SELECT c.id, c.nom, c.source_de_verite, c.editable, s.nom AS systeme_module_nom
         FROM champs c
         JOIN modules m ON m.id = c.module_id
         JOIN systemes s ON s.id = m.systeme_id`
      )
      .all() as ChampRow[];
    const habilitations = db
      .prepare("SELECT id, editable, justification FROM habilitations")
      .all() as HabilitationRow[];
    const modules = db
      .prepare(
        `SELECT m.id, m.cree_le, (SELECT COUNT(*) FROM champs c WHERE c.module_id = m.id) AS nombreChamps
         FROM modules m`
      )
      .all() as ModuleSansChampRow[];
    return executerControlesModele({ champs, habilitations, modules });
  },
};

const FAMILLE_INTEGRATION: FamilleControle = {
  nom: "integration",
  codes: ["I1", "I2", "I3", "I4", "I5", "I6", "I7"],
  calculer: (db) => {
    const integrations = db
      .prepare(
        `SELECT i.id, i.idempotence, i.matching, i.regle_vide, i.procedure_reprise,
                (SELECT COUNT(*) FROM metriques me WHERE me.integration_id = i.id) AS nombreMetriques
         FROM integrations i`
      )
      .all() as IntegrationRow[];
    const erreurs = db
      .prepare("SELECT id, nature FROM erreurs_integration")
      .all() as ErreurIntegrationRow[];
    const metriques = db.prepare("SELECT id, seuil FROM metriques").all() as MetriqueRow[];
    return executerControlesIntegration({ integrations, erreurs, metriques });
  },
};

const FAMILLES: FamilleControle[] = [FAMILLE_PRATIQUE, FAMILLE_MODELE, FAMILLE_INTEGRATION];

export function famillesPour(perimetre: string): FamilleControle[] {
  if (perimetre === "tous") return FAMILLES;
  return FAMILLES.filter((f) => f.nom === perimetre);
}
