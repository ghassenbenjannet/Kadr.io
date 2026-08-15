import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

export const nom = "decrire_systeme";

export const description =
  "Décrit ou complète un système du SI (Zoho CRM, App Devis, Zoho Books…) : son rôle, l'éditeur, " +
  "la criticité, le contact support. Upsert par nom : rappeler avec le même nom complète la fiche " +
  "au fil de l'eau sans dupliquer.";

export const schemaEntree = {
  nom: z.string().min(1),
  role: z.string().optional().describe("Le rôle du système en une phrase"),
  editeur: z.string().optional(),
  criticite: z.enum(["haute", "moyenne", "basse"]).optional(),
  contact_support: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeDecrireSysteme = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function decrireSysteme(db: Database.Database, entree: EntreeDecrireSysteme): Resultat<Sortie> {
  const maintenant = maintenantIso();
  const avertissements: string[] = [];

  const existant = db
    .prepare("SELECT id, role, editeur, criticite, contact_support FROM systemes WHERE nom = ?")
    .get(entree.nom) as
    | { id: string; role: string; editeur: string | null; criticite: string; contact_support: string | null }
    | undefined;

  if (existant) {
    db.prepare(
      `UPDATE systemes SET role = ?, editeur = ?, criticite = ?, contact_support = ?, maj_le = ? WHERE id = ?`
    ).run(
      entree.role ?? existant.role,
      entree.editeur ?? existant.editeur,
      entree.criticite ?? existant.criticite,
      entree.contact_support ?? existant.contact_support,
      maintenant,
      existant.id
    );
    return { ok: true, id: existant.id, resume: `Système « ${entree.nom} » mis à jour.`, avertissements };
  }

  const id = nouvelId();
  const role = entree.role ?? "À compléter";
  if (!entree.role) {
    avertissements.push(`Système « ${entree.nom} » créé sans rôle renseigné : complète-le.`);
  }
  db.prepare(
    `INSERT INTO systemes (id, cree_le, nom, role, editeur, criticite, contact_support, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    maintenant,
    entree.nom,
    role,
    entree.editeur ?? null,
    entree.criticite ?? "moyenne",
    entree.contact_support ?? null,
    maintenant
  );
  return { ok: true, id, resume: `Système « ${entree.nom} » créé.`, avertissements };
}
