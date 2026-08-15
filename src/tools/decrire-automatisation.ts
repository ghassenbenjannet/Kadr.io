import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import { resoudreOuCreerChamp, resoudreOuCreerModule } from "../carte/resolveur.js";

export const nom = "decrire_automatisation";

export const description =
  "Décrit un workflow, une fonction Deluge, un blueprint ou une règle de validation : son " +
  "déclencheur et les champs qu'il touche (lecture/écriture). Upsert par nom au sein du module " +
  "(le module est optionnel : une automatisation transverse peut ne pas en avoir). La liste des " +
  "champs, si fournie, REMPLACE entièrement celle déjà enregistrée.";

const sensEnum = z.enum(["lit", "ecrit"]);

export const schemaEntree = {
  nom: z.string().min(1),
  type: z.enum(["workflow", "deluge", "blueprint", "regle_validation", "planifie", "autre"]),
  systeme: z.string().optional().describe("Système du module concerné, si applicable"),
  module: z.string().optional().describe("Module concerné, si applicable"),
  declencheur: z.string().optional(),
  champs: z
    .array(
      z.object({ systeme: z.string(), module: z.string(), champ: z.string(), sens: sensEnum })
    )
    .optional()
    .describe("Champs lus/écrits par cette automatisation — remplace la liste existante si fourni"),
};

const schema = z.object(schemaEntree);
export type EntreeDecrireAutomatisation = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function decrireAutomatisation(
  db: Database.Database,
  entree: EntreeDecrireAutomatisation
): Resultat<Sortie> {
  if ((entree.systeme && !entree.module) || (!entree.systeme && entree.module)) {
    return { ok: false, erreur: "systeme et module doivent être fournis ensemble, ou omis tous les deux." };
  }

  const maintenant = maintenantIso();
  const avertissements: string[] = [];

  let moduleId: string | null = null;
  if (entree.systeme && entree.module) {
    const module = resoudreOuCreerModule(db, entree.systeme, entree.module);
    avertissements.push(...module.avertissements);
    moduleId = module.id;
  }

  const existante = db
    .prepare("SELECT id, declencheur FROM automatisations WHERE module_id IS ? AND nom = ?")
    .get(moduleId, entree.nom) as { id: string; declencheur: string | null } | undefined;

  let id: string;
  const changements: string[] = [];

  if (existante) {
    id = existante.id;
    db.prepare("UPDATE automatisations SET type = ?, declencheur = ?, maj_le = ? WHERE id = ?").run(
      entree.type,
      entree.declencheur ?? existante.declencheur,
      maintenant,
      id
    );
    changements.push("mise à jour");
  } else {
    id = nouvelId();
    db.prepare(
      `INSERT INTO automatisations (id, cree_le, module_id, nom, type, declencheur, maj_le)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, maintenant, moduleId, entree.nom, entree.type, entree.declencheur ?? null, maintenant);
    changements.push("créée");
  }

  if (entree.champs !== undefined) {
    db.prepare("DELETE FROM automatisation_champs WHERE automatisation_id = ?").run(id);
    for (const c of entree.champs) {
      const champ = resoudreOuCreerChamp(db, c.systeme, c.module, c.champ);
      avertissements.push(...champ.avertissements);
      db.prepare(
        "INSERT OR IGNORE INTO automatisation_champs (automatisation_id, champ_id, sens) VALUES (?, ?, ?)"
      ).run(id, champ.id, c.sens);
    }
    changements.push(`${entree.champs.length} champ(s) référencé(s)`);
  }

  return {
    ok: true,
    id,
    resume: `Automatisation « ${entree.nom} » ${changements.join(", ")}.`,
    avertissements,
  };
}
