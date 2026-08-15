// Configuration de l'agent (§3 spec Jalon 1 bis). Jamais de plantage au
// démarrage si la clé API est absente : on retourne apiKey: null, et c'est
// à l'appelant (serveur HTTP) de refuser poliment /api/chat en la gardant.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ConfigAgent {
  apiKey: string | null;
  model: string;
  maxTokens: number;
}

// Modèle courant par défaut ; entièrement surchageable (config.json ou
// REGISTRE_MODEL) si Abraxio a besoin d'un autre modèle.
const MODELE_DEFAUT = "claude-sonnet-5";
const MAX_TOKENS_DEFAUT = 4096;

interface FichierConfig {
  anthropicApiKey?: string;
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
  return {
    apiKey: process.env.ANTHROPIC_API_KEY ?? depuisFichier.anthropicApiKey ?? null,
    model: process.env.REGISTRE_MODEL ?? depuisFichier.model ?? MODELE_DEFAUT,
    maxTokens: depuisFichier.maxTokens ?? MAX_TOKENS_DEFAUT,
  };
}
