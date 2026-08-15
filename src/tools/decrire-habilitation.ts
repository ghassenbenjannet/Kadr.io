import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import { resoudreOuCreerChamp } from "../carte/resolveur.js";

export const nom = "decrire_habilitation";

export const description =
  "Décrit les droits d'un profil sur un champ : visible, éditable, et la justification (requise " +
  "en revue si le champ est éditable). Upsert par (profil, champ). Le système, le module et le " +
  "champ sont créés automatiquement s'ils n'existent pas encore (avec avertissement).";

export const schemaEntree = {
  profil: z.string().min(1).describe("'CSM', 'ADV', 'Manager CS', 'Admin'…"),
  systeme: z.string().min(1),
  module: z.string().min(1),
  champ: z.string().min(1),
  visible: z.boolean().optional().describe("Défaut : true"),
  editable: z.boolean().optional().describe("Défaut : false"),
  justification: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeDecrireHabilitation = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function decrireHabilitation(
  db: Database.Database,
  entree: EntreeDecrireHabilitation
): Resultat<Sortie> {
  const maintenant = maintenantIso();
  const champ = resoudreOuCreerChamp(db, entree.systeme, entree.module, entree.champ);
  const avertissements = [...champ.avertissements];

  const existant = db
    .prepare("SELECT id, visible, editable, justification FROM habilitations WHERE profil = ? AND champ_id = ?")
    .get(entree.profil, champ.id) as
    | { id: string; visible: number; editable: number; justification: string | null }
    | undefined;

  const visibleValeur = entree.visible === undefined ? undefined : entree.visible ? 1 : 0;
  const editableValeur = entree.editable === undefined ? undefined : entree.editable ? 1 : 0;

  if (existant) {
    db.prepare(
      `UPDATE habilitations SET visible = ?, editable = ?, justification = ?, maj_le = ? WHERE id = ?`
    ).run(
      visibleValeur ?? existant.visible,
      editableValeur ?? existant.editable,
      entree.justification ?? existant.justification,
      maintenant,
      existant.id
    );
    return {
      ok: true,
      id: existant.id,
      resume: `Habilitation ${entree.profil} × « ${entree.champ} » mise à jour.`,
      avertissements,
    };
  }

  const id = nouvelId();
  db.prepare(
    `INSERT INTO habilitations (id, cree_le, profil, champ_id, visible, editable, justification, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    maintenant,
    entree.profil,
    champ.id,
    visibleValeur ?? 1,
    editableValeur ?? 0,
    entree.justification ?? null,
    maintenant
  );
  return {
    ok: true,
    id,
    resume: `Habilitation ${entree.profil} × « ${entree.champ} » créée.`,
    avertissements,
  };
}
