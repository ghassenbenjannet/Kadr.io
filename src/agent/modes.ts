// Registre des modes de travail spécialisés (§ moteur de routage). Chaque
// mode est un fichier markdown autonome dans agent/modes/, chargé à la
// demande par l'outil charger_mode plutôt qu'injecté en permanence dans le
// prompt système — garde le prompt de base petit, et laisse l'agent
// décider, via la table de routage qu'il contient, quand charger quoi.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const iciDir = dirname(fileURLToPath(import.meta.url));

export interface DefinitionMode {
  cle: string;
  titre: string;
  fichier: string;
}

export const MODES: DefinitionMode[] = [
  { cle: "analyse", titre: "Analyse de demande", fichier: "analyse.md" },
  { cle: "architecture", titre: "Architecture de solution", fichier: "architecture.md" },
  { cle: "revue", titre: "Revue SI", fichier: "revue.md" },
  { cle: "livrable", titre: "Préparation de livrable", fichier: "livrable.md" },
];

export function chargerMode(cle: string): string | null {
  const mode = MODES.find((m) => m.cle === cle);
  if (!mode) return null;
  const chemin = join(iciDir, "modes", mode.fichier);
  if (!existsSync(chemin)) return null;
  return readFileSync(chemin, "utf-8");
}
