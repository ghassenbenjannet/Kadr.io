// Mot de passe partagé (l'app est mono-opérateur, pas de comptes). Même
// double chemin que la clé Anthropic : variable d'environnement d'abord,
// puis ~/.registre-si/config.json, jamais d'échec au démarrage si absent —
// c'est à l'appelant (le serveur) de décider quoi faire de l'absence.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface FichierConfig {
  password?: string;
}

function cheminConfig(): string {
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

export function chargerMotDePasse(): string | null {
  const depuisFichier = lireFichierConfig();
  return process.env.REGISTRE_PASSWORD ?? depuisFichier.password ?? null;
}

/** REGISTRE_COOKIE_SECURE=true une fois un reverse proxy TLS devant l'app. */
export function cookieSecurise(): boolean {
  return process.env.REGISTRE_COOKIE_SECURE === "true";
}
