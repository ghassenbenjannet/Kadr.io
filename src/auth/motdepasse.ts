// Comparaison à temps constant — évite qu'une différence de timing entre
// deux essais laisse deviner combien de caractères sont corrects. Les deux
// valeurs sont d'abord hachées pour que la comparaison porte sur des
// buffers de longueur fixe, quelle que soit la longueur du mot de passe
// saisi.

import { createHash, timingSafeEqual } from "node:crypto";

function hacher(valeur: string): Buffer {
  return createHash("sha256").update(valeur, "utf-8").digest();
}

export function motDePasseValide(saisi: string, attendu: string): boolean {
  if (!saisi) return false;
  return timingSafeEqual(hacher(saisi), hacher(attendu));
}
