import { nanoid } from "nanoid";

export function nouvelId(): string {
  return nanoid(12);
}

export function maintenantIso(): string {
  return new Date().toISOString();
}

export interface Erreur {
  ok: false;
  erreur: string;
}

export type Resultat<T extends object> = (T & { ok: true }) | Erreur;
