import { z } from "zod";
import type Database from "better-sqlite3";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { genererRapportHebdo, semaineCouranteIso } from "../rapport/hebdo.js";
import { resoudreCheminDb } from "../db/client.js";
import type { Resultat } from "../db/util.js";

export const nom = "generer_rapport";

export const description =
  "Génère un rapport en markdown. 'hebdo' produit la revue de la semaine (demandes, " +
  "changements, incidents, points de vigilance) prête à envoyer au CEO.";

export const schemaEntree = {
  type: z.enum(["hebdo"]),
  semaine: z.string().optional().describe("Semaine ISO, ex 2026-W34 (défaut : semaine courante)"),
};

const schema = z.object(schemaEntree);
export type EntreeGenererRapport = z.infer<typeof schema>;

interface Sortie {
  markdown: string;
  chemin?: string;
}

export function genererRapport(db: Database.Database, entree: EntreeGenererRapport): Resultat<Sortie> {
  if (entree.type === "hebdo") {
    const semaine = entree.semaine ?? semaineCouranteIso();
    const markdown = genererRapportHebdo(db, semaine);

    let chemin: string | undefined;
    try {
      const dossierRapports = join(dirname(resoudreCheminDb()), "rapports");
      mkdirSync(dossierRapports, { recursive: true });
      chemin = join(dossierRapports, `hebdo-${semaine}.md`);
      writeFileSync(chemin, markdown, "utf-8");
    } catch {
      // L'écriture sur disque est un confort (envoi direct du fichier) ; si elle échoue
      // (permissions, environnement de test…), le markdown reste retourné dans la réponse.
      chemin = undefined;
    }

    return { ok: true, markdown, chemin };
  }

  return { ok: false, erreur: `Type de rapport inconnu : ${String(entree.type)}` };
}
