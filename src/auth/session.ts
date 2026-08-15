// Jeton de session : signé (HMAC-SHA256), pas de stockage côté serveur —
// l'app est mono-opérateur, une table de sessions serait une couche pour
// rien. Le secret est généré au démarrage du process (genererSecret) et
// jamais persisté : redémarrer le serveur invalide les sessions en cours,
// un compromis raisonnable pour un outil perso (pas de secret statique à
// protéger dans l'image ou le volume).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export function genererSecret(): Buffer {
  return randomBytes(32);
}

function signer(secret: Buffer, charge: string): string {
  return createHmac("sha256", secret).update(charge).digest("hex");
}

export function creerJetonSession(secret: Buffer, maintenant = Date.now(), dureeMs = DUREE_SESSION_MS): string {
  const charge = String(maintenant + dureeMs);
  return `${charge}.${signer(secret, charge)}`;
}

export function jetonValide(jeton: string | undefined | null, secret: Buffer, maintenant = Date.now()): boolean {
  if (!jeton) return false;
  const [charge, signature] = jeton.split(".");
  if (!charge || !signature) return false;

  const attendu = signer(secret, charge);
  const bufAttendu = Buffer.from(attendu, "hex");
  const bufRecu = Buffer.from(signature, "hex");
  if (bufAttendu.length !== bufRecu.length) return false;
  if (!timingSafeEqual(bufAttendu, bufRecu)) return false;

  const expire = Number(charge);
  if (!Number.isFinite(expire)) return false;
  return maintenant < expire;
}
