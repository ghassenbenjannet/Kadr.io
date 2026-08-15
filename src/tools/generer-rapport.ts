import { z } from "zod";
import type Database from "better-sqlite3";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { genererRapportHebdo, semaineCouranteIso } from "../rapport/hebdo.js";
import { genererRapportEtatSi } from "../rapport/etat-si.js";
import { rendreImpactMarkdown, type SortieImpact } from "../rapport/impact.js";
import { impact } from "./impact.js";
import { resoudreCheminDb } from "../db/client.js";
import type { Resultat } from "../db/util.js";

export const nom = "generer_rapport";

export const description =
  "Génère un rapport en markdown. 'hebdo' produit la revue de la semaine (demandes, " +
  "changements, incidents, points de vigilance, éléments de carte décrits). 'etat_si' produit la " +
  "synthèse de la carte et des constats ouverts (document de passation). 'impact' produit la " +
  "sortie d'impact() en markdown, à joindre à une demande de validation avant changement.";

const typeCibleEnum = z.enum(["champ", "module", "integration", "automatisation"]);

export const schemaEntree = {
  type: z.enum(["hebdo", "etat_si", "impact"]),
  semaine: z.string().optional().describe("Semaine ISO, ex 2026-W34 (défaut : semaine courante) — pour 'hebdo'"),
  cible: z
    .object({
      type: typeCibleEnum,
      systeme: z.string().optional(),
      module: z.string().optional(),
      nom: z.string().min(1),
    })
    .optional()
    .describe("Requis pour 'impact' : la cible à analyser"),
};

const schema = z.object(schemaEntree);
export type EntreeGenererRapport = z.infer<typeof schema>;

interface Sortie {
  markdown: string;
  chemin?: string;
}

function ecrireSurDisque(nomFichier: string, markdown: string): string | undefined {
  try {
    const dossierRapports = join(dirname(resoudreCheminDb()), "rapports");
    mkdirSync(dossierRapports, { recursive: true });
    const chemin = join(dossierRapports, nomFichier);
    writeFileSync(chemin, markdown, "utf-8");
    return chemin;
  } catch {
    // L'écriture sur disque est un confort (envoi/archivage direct du fichier) ; si elle
    // échoue (permissions, environnement de test…), le markdown reste retourné dans la réponse.
    return undefined;
  }
}

export function genererRapport(db: Database.Database, entree: EntreeGenererRapport): Resultat<Sortie> {
  if (entree.type === "hebdo") {
    const semaine = entree.semaine ?? semaineCouranteIso();
    const markdown = genererRapportHebdo(db, semaine);
    const chemin = ecrireSurDisque(`hebdo-${semaine}.md`, markdown);
    return { ok: true, markdown, chemin };
  }

  if (entree.type === "etat_si") {
    const markdown = genererRapportEtatSi(db);
    const chemin = ecrireSurDisque(`etat_si-${new Date().toISOString().slice(0, 10)}.md`, markdown);
    return { ok: true, markdown, chemin };
  }

  // impact
  if (!entree.cible) {
    return { ok: false, erreur: "Le rapport 'impact' requiert une cible." };
  }
  const resultatImpact = impact(db, { cible: entree.cible });
  if (!resultatImpact.ok) {
    return { ok: false, erreur: resultatImpact.erreur };
  }
  const sortieImpact: SortieImpact = resultatImpact;
  const markdown = rendreImpactMarkdown(sortieImpact);
  const chemin = ecrireSurDisque(`impact-${entree.cible.nom}-${new Date().toISOString().slice(0, 10)}.md`, markdown);
  return { ok: true, markdown, chemin };
}
