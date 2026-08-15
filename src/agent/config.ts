// Configuration de l'agent (§3 spec Jalon 1 bis). Jamais de plantage au
// démarrage si la clé API est absente : on retourne apiKey: null, et c'est
// à l'appelant (serveur HTTP) de refuser poliment /api/chat en la gardant.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type FournisseurAgent = "anthropic" | "compatible_openai";

export interface ConfigAgent {
  apiKey: string | null;
  model: string;
  maxTokens: number;
  /** Optionnel : absent = "anthropic", pour ne rien casser des appels existants (tests, etc.). */
  fournisseur?: FournisseurAgent;
  /** Requis seulement pour fournisseur "compatible_openai" (ex: https://integrate.api.nvidia.com/v1). */
  baseUrl?: string | null;
}

// Modèle courant par défaut ; entièrement surchageable (config.json ou
// REGISTRE_MODEL) si Abraxio a besoin d'un autre modèle. N'a de sens que pour
// le fournisseur Anthropic — un fournisseur compatible OpenAI n'a pas de
// modèle par défaut raisonnable (chaque endpoint expose des noms différents).
const MODELE_DEFAUT = "claude-sonnet-5";
const MAX_TOKENS_DEFAUT = 4096;

interface FichierConfig {
  anthropicApiKey?: string;
  apiKey?: string;
  provider?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
}

export function cheminConfig(): string {
  return join(homedir(), ".registre-si", "config.json");
}

function lireFichierConfig(): FichierConfig {
  const chemin = cheminConfig();
  if (!existsSync(chemin)) return {};
  try {
    return JSON.parse(readFileSync(chemin, "utf-8")) as FichierConfig;
  } catch {
    return {};
  }
}

export function chargerConfig(): ConfigAgent {
  const depuisFichier = lireFichierConfig();
  const fournisseurBrut = process.env.REGISTRE_PROVIDER ?? depuisFichier.provider;
  const fournisseur: FournisseurAgent = fournisseurBrut === "compatible_openai" ? "compatible_openai" : "anthropic";

  const apiKey =
    fournisseur === "anthropic"
      ? (process.env.ANTHROPIC_API_KEY ??
        depuisFichier.anthropicApiKey ??
        process.env.REGISTRE_API_KEY ??
        depuisFichier.apiKey ??
        null)
      : (process.env.REGISTRE_API_KEY ?? depuisFichier.apiKey ?? null);

  return {
    fournisseur,
    apiKey,
    baseUrl: process.env.REGISTRE_BASE_URL ?? depuisFichier.baseUrl ?? null,
    model: process.env.REGISTRE_MODEL ?? depuisFichier.model ?? (fournisseur === "anthropic" ? MODELE_DEFAUT : ""),
    maxTokens: depuisFichier.maxTokens ?? MAX_TOKENS_DEFAUT,
  };
}
