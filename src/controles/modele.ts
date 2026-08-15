// Contrôles de modèle (§6.1 du CDC, §4 "Modèle (M)" de la spec technique Jalon 2).
// Fonctions PURES : lignes en entrée (déjà jointes par l'appelant), constats en sortie.

import type { Constat } from "./types.js";

export const SEUILS_MODELE = {
  /** M4 : au-delà de ce nombre de jours sans aucun champ décrit, un module déclenche le contrôle. */
  moduleSansChampJours: 30,
} as const;

export interface ChampRow {
  id: string;
  nom: string;
  source_de_verite: string | null;
  editable: number | null;
  /** Nom du système propriétaire du module parent (pour la comparaison M2). */
  systeme_module_nom: string;
}

export interface HabilitationRow {
  id: string;
  editable: number;
  justification: string | null;
}

export interface ModuleSansChampRow {
  id: string;
  cree_le: string;
  nombreChamps: number;
}

function ageEnJours(creeLe: string, maintenant: Date): number {
  return Math.floor((maintenant.getTime() - new Date(creeLe).getTime()) / 86400000);
}

/** M1 : champ sans source de vérité déclarée. */
export function controleM1(champs: ChampRow[]): Constat[] {
  return champs
    .filter((c) => c.source_de_verite === null)
    .map((c) => ({
      controle: "M1",
      entite: "champ",
      entiteId: c.id,
      consequence:
        "Champ sans source de vérité : aucun arbitrage possible en cas d'écart entre systèmes.",
    }));
}

/**
 * M2 : champ éditable dont la source de vérité déclarée diffère du système du
 * module qui le porte. Comparaison insensible à la casse.
 */
export function controleM2(champs: ChampRow[]): Constat[] {
  return champs
    .filter((c) => {
      if (c.editable !== 1 || c.source_de_verite === null) return false;
      return c.source_de_verite.trim().toLowerCase() !== c.systeme_module_nom.trim().toLowerCase();
    })
    .map((c) => ({
      controle: "M2",
      entite: "champ",
      entiteId: c.id,
      consequence: `Champ éditable alors que sa source de vérité est ${c.source_de_verite} : chaque saisie locale créera un écart silencieux.`,
    }));
}

/** M3 : habilitation éditable sans justification. */
export function controleM3(habilitations: HabilitationRow[]): Constat[] {
  return habilitations
    .filter((h) => h.editable === 1 && !h.justification)
    .map((h) => ({
      controle: "M3",
      entite: "habilitation",
      entiteId: h.id,
      consequence:
        "Droit de modification accordé sans justification : indéfendable en revue d'habilitations.",
    }));
}

/** M4 : module déclaré sans aucun champ décrit depuis plus de SEUILS_MODELE.moduleSansChampJours jours. */
export function controleM4(modules: ModuleSansChampRow[], maintenant = new Date()): Constat[] {
  return modules
    .filter(
      (m) => m.nombreChamps === 0 && ageEnJours(m.cree_le, maintenant) > SEUILS_MODELE.moduleSansChampJours
    )
    .map((m) => ({
      controle: "M4",
      entite: "module",
      entiteId: m.id,
      consequence: "Module déclaré mais jamais cartographié : angle mort du SI.",
    }));
}

export interface DonneesModele {
  champs: ChampRow[];
  habilitations: HabilitationRow[];
  modules: ModuleSansChampRow[];
}

export function executerControlesModele(donnees: DonneesModele, maintenant = new Date()): Constat[] {
  return [
    ...controleM1(donnees.champs),
    ...controleM2(donnees.champs),
    ...controleM3(donnees.habilitations),
    ...controleM4(donnees.modules, maintenant),
  ];
}
