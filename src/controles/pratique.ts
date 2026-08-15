// Contrôles de pratique (§6.3 du CDC, §4 de la spec technique Jalon 1).
// Fonctions PURES : elles prennent des lignes en entrée et retournent des
// constats, sans jamais toucher la DB. Testables sans DB.

export const SEUILS = {
  /** C5 : au-delà de ce nombre de jours en attente, une demande déclenche le contrôle. */
  demandeEnAttenteJours: 14,
} as const;

import type { Constat } from "./types.js";

export interface ChangementRow {
  id: string;
  cree_le: string;
  rollback: string | null;
  test_effectue: string | null;
  demande_id: string | null;
  decision_id: string | null;
}

export interface DecisionRow {
  id: string;
  statut: string;
  decideur: string;
}

export interface DemandeRow {
  id: string;
  cree_le: string;
  statut: string;
  equipe: string;
}

export interface IncidentRow {
  id: string;
  resolu_le: string | null;
  action_preventive: string | null;
}

function ageEnJours(creeLe: string, maintenant: Date): number {
  const debut = new Date(creeLe).getTime();
  const diffMs = maintenant.getTime() - debut;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** C1 : changement sans retour arrière déclaré, âgé d'au moins un jour. */
export function controleC1(changements: ChangementRow[], maintenant = new Date()): Constat[] {
  return changements
    .filter((c) => c.rollback === null && ageEnJours(c.cree_le, maintenant) > 0)
    .map((c) => ({
      controle: "C1",
      entite: "changement",
      entiteId: c.id,
      consequence:
        "Aucun retour arrière déclaré : un incident sur ce changement se traitera en improvisation.",
    }));
}

/** C2 : changement sans test déclaré. */
export function controleC2(changements: ChangementRow[]): Constat[] {
  return changements
    .filter((c) => c.test_effectue === null)
    .map((c) => ({
      controle: "C2",
      entite: "changement",
      entiteId: c.id,
      consequence:
        "Aucun test déclaré : la recette de ce changement, c'est l'utilisateur en production.",
    }));
}

/** C3 : changement sans demande ni décision d'origine. */
export function controleC3(changements: ChangementRow[]): Constat[] {
  return changements
    .filter((c) => c.demande_id === null && c.decision_id === null)
    .map((c) => ({
      controle: "C3",
      entite: "changement",
      entiteId: c.id,
      consequence: "Changement sans origine : le SI dérive sans trace de qui a demandé quoi.",
    }));
}

/**
 * C4 : décision appliquée jamais validée.
 * Simplification jalon 1 : on ne trace pas l'historique de statut (pas de
 * table d'audit des transitions), donc on ne peut pas savoir si une décision
 * "appliquee" est passée par "validee". On approxime par un signal
 * structurel : une décision appliquée ET auto-décidée ("moi") est le cas
 * type d'un engagement pris sans couverture — une décision appliquée par le
 * CEO porte déjà sa validation dans son décideur.
 */
export function controleC4(decisions: DecisionRow[]): Constat[] {
  return decisions
    .filter((d) => d.statut === "appliquee" && d.decideur === "moi")
    .map((d) => ({
      controle: "C4",
      entite: "decision",
      entiteId: d.id,
      consequence:
        "Décision appliquée jamais validée : engagement pris sans couverture du décideur.",
    }));
}

/** C5 : demande en attente depuis plus de SEUILS.demandeEnAttenteJours jours. */
export function controleC5(demandes: DemandeRow[], maintenant = new Date()): Constat[] {
  const resultats: Constat[] = [];
  for (const d of demandes) {
    if (d.statut !== "recue" && d.statut !== "qualifiee") continue;
    const age = ageEnJours(d.cree_le, maintenant);
    if (age > SEUILS.demandeEnAttenteJours) {
      resultats.push({
        controle: "C5",
        entite: "demande",
        entiteId: d.id,
        consequence: `Demande en attente depuis ${age} jours : la confiance de l'équipe ${d.equipe} s'érode en silence.`,
      });
    }
  }
  return resultats;
}

/** C6 : incident résolu sans action préventive. */
export function controleC6(incidents: IncidentRow[]): Constat[] {
  return incidents
    .filter((i) => i.resolu_le !== null && i.action_preventive === null)
    .map((i) => ({
      controle: "C6",
      entite: "incident",
      entiteId: i.id,
      consequence: "Incident résolu sans action préventive : le même incident reviendra.",
    }));
}

export interface DonneesPratique {
  changements: ChangementRow[];
  decisions: DecisionRow[];
  demandes: DemandeRow[];
  incidents: IncidentRow[];
}

export function executerControlesPratique(
  donnees: DonneesPratique,
  maintenant = new Date()
): Constat[] {
  return [
    ...controleC1(donnees.changements, maintenant),
    ...controleC2(donnees.changements),
    ...controleC3(donnees.changements),
    ...controleC4(donnees.decisions),
    ...controleC5(donnees.demandes, maintenant),
    ...controleC6(donnees.incidents),
  ];
}
