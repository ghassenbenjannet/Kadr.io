import { z } from "zod";
import type { Resultat } from "../db/util.js";
import { MODES, chargerMode } from "../agent/modes.js";

export const nom = "charger_mode";

const clesMode = MODES.map((m) => m.cle) as [string, ...string[]];

export const description =
  "Charge les instructions détaillées d'un mode de travail spécialisé (analyse d'une demande, " +
  "architecture de solution, revue SI, préparation d'un livrable) avant de répondre en profondeur " +
  "à ce type de demande. Ne sert pas pour un échange bref ou une capture rapide au fil de l'eau.";

export const schemaEntree = {
  mode: z.enum(clesMode).describe(MODES.map((m) => `${m.cle} = ${m.titre}`).join(" ; ")),
};

const schema = z.object(schemaEntree);
export type EntreeChargerMode = z.infer<typeof schema>;

interface Sortie {
  mode: string;
  instructions: string;
}

export function chargerModeOutil(entree: EntreeChargerMode): Resultat<Sortie> {
  const instructions = chargerMode(entree.mode);
  if (!instructions) {
    return { ok: false, erreur: `Mode introuvable : ${entree.mode}` };
  }
  return { ok: true, mode: entree.mode, instructions };
}
