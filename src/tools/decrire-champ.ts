import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import { resoudreOuCreerModule } from "../carte/resolveur.js";

export const nom = "decrire_champ";

export const description =
  "Décrit ou complète un champ d'un module : type, source de vérité, éditabilité, règle métier, " +
  "fraîcheur. Upsert par nom au sein du module. Le système et le module sont créés " +
  "automatiquement s'ils n'existent pas encore (avec avertissement) : « le champ Statut_Client " +
  "est alimenté par l'app Devis, lecture seule partout sauf Admin » suffit.";

const typeChampEnum = z.enum([
  "texte",
  "liste",
  "devise",
  "nombre",
  "date",
  "booleen",
  "lookup",
  "formule",
  "autre",
]);

export const schemaEntree = {
  systeme: z.string().min(1),
  module: z.string().min(1),
  nom: z.string().min(1),
  type: typeChampEnum.optional(),
  source_de_verite: z.string().optional().describe("Nom du système qui fait foi pour ce champ"),
  editable: z.boolean().optional(),
  regle_metier: z.string().optional(),
  fraicheur: z.string().optional().describe("'temps réel', 'J+1', 'manuelle'…"),
};

const schema = z.object(schemaEntree);
export type EntreeDecrireChamp = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function decrireChamp(db: Database.Database, entree: EntreeDecrireChamp): Resultat<Sortie> {
  const maintenant = maintenantIso();
  const module = resoudreOuCreerModule(db, entree.systeme, entree.module);
  const avertissements = [...module.avertissements];

  const existant = db
    .prepare(
      "SELECT id, type, source_de_verite, editable, regle_metier, fraicheur FROM champs WHERE module_id = ? AND nom = ?"
    )
    .get(module.id, entree.nom) as
    | {
        id: string;
        type: string | null;
        source_de_verite: string | null;
        editable: number | null;
        regle_metier: string | null;
        fraicheur: string | null;
      }
    | undefined;

  const editableValeur = entree.editable === undefined ? undefined : entree.editable ? 1 : 0;

  if (existant) {
    db.prepare(
      `UPDATE champs SET type = ?, source_de_verite = ?, editable = ?, regle_metier = ?, fraicheur = ?, maj_le = ? WHERE id = ?`
    ).run(
      entree.type ?? existant.type,
      entree.source_de_verite ?? existant.source_de_verite,
      editableValeur ?? existant.editable,
      entree.regle_metier ?? existant.regle_metier,
      entree.fraicheur ?? existant.fraicheur,
      maintenant,
      existant.id
    );
    return {
      ok: true,
      id: existant.id,
      resume: `Champ « ${entree.nom} » (${entree.module}) mis à jour.`,
      avertissements,
    };
  }

  const id = nouvelId();
  db.prepare(
    `INSERT INTO champs (id, cree_le, module_id, nom, type, source_de_verite, editable, regle_metier, fraicheur, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    maintenant,
    module.id,
    entree.nom,
    entree.type ?? null,
    entree.source_de_verite ?? null,
    editableValeur ?? null,
    entree.regle_metier ?? null,
    entree.fraicheur ?? null,
    maintenant
  );
  return {
    ok: true,
    id,
    resume: `Champ « ${entree.nom} » (${entree.module}) créé.`,
    avertissements,
  };
}
