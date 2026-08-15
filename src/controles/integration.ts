// Contrôles d'intégration (§6.2 du CDC, §4 "Intégration (I)" de la spec technique
// Jalon 2). Fonctions PURES, adaptées de l'audit d'intégration du projet précédent.

import type { Constat } from "./types.js";

export interface IntegrationRow {
  id: string;
  idempotence: string | null;
  matching: string | null;
  regle_vide: string | null;
  procedure_reprise: string | null;
  nombreMetriques: number;
}

export interface ErreurIntegrationRow {
  id: string;
  nature: string | null;
}

export interface MetriqueRow {
  id: string;
  seuil: string | null;
}

/** I1 : pas de clé d'idempotence déclarée. */
export function controleI1(integrations: IntegrationRow[]): Constat[] {
  return integrations
    .filter((i) => i.idempotence === null)
    .map((i) => ({
      controle: "I1",
      entite: "integration",
      entiteId: i.id,
      consequence: "Pas de clé d'idempotence : un rejeu après incident créera des doublons.",
    }));
}

/** I2 : pas de règle de rapprochement déclarée. */
export function controleI2(integrations: IntegrationRow[]): Constat[] {
  return integrations
    .filter((i) => i.matching === null)
    .map((i) => ({
      controle: "I2",
      entite: "integration",
      entiteId: i.id,
      consequence:
        "Pas de règle de rapprochement : l'upsert ne peut pas savoir si l'objet existe déjà.",
    }));
}

/** I3 : pas de règle de valeur vide déclarée. */
export function controleI3(integrations: IntegrationRow[]): Constat[] {
  return integrations
    .filter((i) => i.regle_vide === null)
    .map((i) => ({
      controle: "I3",
      entite: "integration",
      entiteId: i.id,
      consequence: "Pas de règle de valeur vide : rejet silencieux ou null en cible.",
    }));
}

/** I4 : erreur d'intégration sans nature (fonctionnelle/technique). */
export function controleI4(erreurs: ErreurIntegrationRow[]): Constat[] {
  return erreurs
    .filter((e) => e.nature === null)
    .map((e) => ({
      controle: "I4",
      entite: "erreur_integration",
      entiteId: e.id,
      consequence:
        "Erreur sans nature : on ne sait pas si elle se corrige (fonctionnelle) ou se rejoue (technique).",
    }));
}

/** I5 : pas de procédure de reprise déclarée. */
export function controleI5(integrations: IntegrationRow[]): Constat[] {
  return integrations
    .filter((i) => i.procedure_reprise === null)
    .map((i) => ({
      controle: "I5",
      entite: "integration",
      entiteId: i.id,
      consequence: "Pas de procédure de reprise : la reprise sera improvisée hors heures ouvrées.",
    }));
}

/** I6 : métrique sans seuil déclaré. */
export function controleI6(metriques: MetriqueRow[]): Constat[] {
  return metriques
    .filter((m) => m.seuil === null)
    .map((m) => ({
      controle: "I6",
      entite: "metrique",
      entiteId: m.id,
      consequence: "Métrique sans seuil : elle se regarde, elle n'avertit pas.",
    }));
}

/** I7 : intégration sans aucune métrique. */
export function controleI7(integrations: IntegrationRow[]): Constat[] {
  return integrations
    .filter((i) => i.nombreMetriques === 0)
    .map((i) => ({
      controle: "I7",
      entite: "integration",
      entiteId: i.id,
      consequence: "Aucune supervision : la panne sera signalée par un utilisateur.",
    }));
}

export interface DonneesIntegration {
  integrations: IntegrationRow[];
  erreurs: ErreurIntegrationRow[];
  metriques: MetriqueRow[];
}

export function executerControlesIntegration(donnees: DonneesIntegration): Constat[] {
  return [
    ...controleI1(donnees.integrations),
    ...controleI2(donnees.integrations),
    ...controleI3(donnees.integrations),
    ...controleI4(donnees.erreurs),
    ...controleI5(donnees.integrations),
    ...controleI6(donnees.metriques),
    ...controleI7(donnees.integrations),
  ];
}
