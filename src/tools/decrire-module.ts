import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import { resoudreOuCreerSysteme } from "../carte/resolveur.js";

export const nom = "decrire_module";

export const description =
  "Décrit ou complète un module d'un système (ex : le module Comptes de Zoho CRM) : son rôle " +
  "métier, les équipes utilisatrices. Upsert par nom au sein du système. Si le système n'existe " +
  "pas encore, il est créé automatiquement (avec avertissement).";

export const schemaEntree = {
  systeme: z.string().min(1),
  nom: z.string().min(1),
  api_name: z.string().optional(),
  role_metier: z.string().optional(),
  equipes: z.array(z.string()).optional().describe("Équipes utilisatrices de ce module"),
};

const schema = z.object(schemaEntree);
export type EntreeDecrireModule = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function decrireModule(db: Database.Database, entree: EntreeDecrireModule): Resultat<Sortie> {
  const avertissements: string[] = [];
  const maintenant = maintenantIso();

  const systeme = resoudreOuCreerSysteme(db, entree.systeme);
  if (systeme.cree) {
    avertissements.push(`Système « ${entree.systeme} » créé automatiquement, complète son rôle.`);
  }

  const existant = db
    .prepare("SELECT id, api_name, role_metier, equipes FROM modules WHERE systeme_id = ? AND nom = ?")
    .get(systeme.id, entree.nom) as
    | { id: string; api_name: string | null; role_metier: string | null; equipes: string | null }
    | undefined;

  const equipesJson = entree.equipes ? JSON.stringify(entree.equipes) : undefined;

  if (existant) {
    db.prepare(`UPDATE modules SET api_name = ?, role_metier = ?, equipes = ?, maj_le = ? WHERE id = ?`).run(
      entree.api_name ?? existant.api_name,
      entree.role_metier ?? existant.role_metier,
      equipesJson ?? existant.equipes,
      maintenant,
      existant.id
    );
    return {
      ok: true,
      id: existant.id,
      resume: `Module « ${entree.nom} » (${entree.systeme}) mis à jour.`,
      avertissements,
    };
  }

  const id = nouvelId();
  db.prepare(
    `INSERT INTO modules (id, cree_le, systeme_id, nom, api_name, role_metier, equipes, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, maintenant, systeme.id, entree.nom, entree.api_name ?? null, entree.role_metier ?? null, equipesJson ?? null, maintenant);
  return {
    ok: true,
    id,
    resume: `Module « ${entree.nom} » (${entree.systeme}) créé.`,
    avertissements,
  };
}
