import { z } from "zod";
import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";
import { chargerMode, listerModes } from "../agent/modes.js";

export const nom = "charger_mode";

export const description =
  "Charge les instructions détaillées d'un mode de travail spécialisé (analyse d'une demande, " +
  "architecture de solution, revue SI, préparation d'un livrable, ou tout autre mode ajouté depuis " +
  "l'écran « Agents ») avant de répondre en profondeur à ce type de demande — voir la liste des " +
  "modes disponibles, avec leur clé exacte, dans les instructions système. Ne sert pas pour un " +
  "échange bref ou une capture rapide au fil de l'eau.";

export const schemaEntree = {
  mode: z.string().min(1).describe("Clé exacte du mode à charger (voir la liste des modes disponibles)."),
};

const schema = z.object(schemaEntree);
export type EntreeChargerMode = z.infer<typeof schema>;

interface Sortie {
  mode: string;
  instructions: string;
}

export function chargerModeOutil(db: Database.Database, entree: EntreeChargerMode): Resultat<Sortie> {
  const instructions = chargerMode(db, entree.mode);
  if (!instructions) {
    const disponibles = listerModes(db)
      .map((m) => m.cle)
      .join(", ");
    return {
      ok: false,
      erreur: `Mode introuvable : ${entree.mode}. Modes disponibles : ${disponibles || "aucun"}.`,
    };
  }
  return { ok: true, mode: entree.mode, instructions };
}
