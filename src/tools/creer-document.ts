import { z } from "zod";
import type Database from "better-sqlite3";
import { typeDocumentEnum } from "../db/enums.js";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import { trouverProjet } from "../tickets/resolveur.js";
import { patternPourType } from "../documents/templates.js";

export const nom = "creer_document";

export const description =
  "Crée une page de documentation : cadrage, compte-rendu, spécification, note d'architecture " +
  "existante, ou note libre. Avec projet, la page appartient à ce projet. Sans projet, elle rejoint " +
  "la base de connaissances globale — l'existant de l'entreprise, des spécifications de référence, " +
  "utile pour analyser une demande ou construire une architecture de solution, indépendamment de " +
  "tout projet en cours. Si contenu est omis, la page démarre avec le squelette du type choisi.";

export const schemaEntree = {
  projet: z.string().optional().describe("Omis = page de la base de connaissances globale, pas liée à un projet"),
  type: typeDocumentEnum,
  titre: z.string().min(1),
  contenu: z.string().optional().describe("Markdown ; si omis, utilise le squelette du type"),
};

const schema = z.object(schemaEntree);
export type EntreeCreerDocument = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
}

export function creerDocument(db: Database.Database, entree: EntreeCreerDocument): Resultat<Sortie> {
  let projetId: string | null = null;
  if (entree.projet) {
    const projet = trouverProjet(db, entree.projet);
    if (!projet) {
      return { ok: false, erreur: `Projet introuvable : ${entree.projet}` };
    }
    projetId = projet.id;
  }

  const id = nouvelId();
  const maintenant = maintenantIso();
  const contenu = entree.contenu ?? patternPourType(entree.type);

  db.prepare(
    `INSERT INTO documents (id, cree_le, projet_id, type, titre, contenu, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, maintenant, projetId, entree.type, entree.titre, contenu, maintenant);

  return {
    ok: true,
    id,
    resume: entree.projet
      ? `Page « ${entree.titre} » (${entree.type}) créée dans ${entree.projet}.`
      : `Page « ${entree.titre} » (${entree.type}) créée dans la base de connaissances.`,
  };
}
