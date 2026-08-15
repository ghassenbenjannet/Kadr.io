// Stockage des identifiants Zoho — JAMAIS dans la DB ni dans un commit
// (§2 spec technique Jalon 3). Le dossier ~/.registre-si est dans .gitignore
// dès le scaffold.

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface ZohoCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  api_domain: string;
}

export function cheminCredentials(): string {
  return join(homedir(), ".registre-si", "zoho-credentials.json");
}

export function sauvegarderCredentials(creds: ZohoCredentials): void {
  const chemin = cheminCredentials();
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify(creds, null, 2), "utf-8");
  chmodSync(chemin, 0o600);
}

export function chargerCredentials(): ZohoCredentials | null {
  const chemin = cheminCredentials();
  if (!existsSync(chemin)) return null;
  return JSON.parse(readFileSync(chemin, "utf-8")) as ZohoCredentials;
}
