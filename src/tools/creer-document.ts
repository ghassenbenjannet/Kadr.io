import { z } from "zod";
import type Database from "better-sqlite3";
import { typeDocumentEnum } from "../db/enums.js";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import { trouverProjet } from "../tickets/resolveur.js";
import { patternPourType } from "../documents/templates.js";

export const nom = "creer_document";

export const description =
  "Crée une page de documentation dans un projet : cadrage, compte-rendu, spécification ou note " +
  "libre. Si contenu est omis, la page démarre avec le squelette du type choisi — à compléter " +
  "ensuite, en conversation ou directement dans l'éditeur.";

export const schemaEntree = {
  projet: z.string().min(1),
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
  const projet = trouverProjet(db, entree.projet);
  if (!projet) {
    return { ok: false, erreur: `Projet introuvable : ${entree.projet}` };
  }

  const id = nouvelId();
  const maintenant = maintenantIso();
  const contenu = entree.contenu ?? patternPourType(entree.type);

  db.prepare(
    `INSERT INTO documents (id, cree_le, projet_id, type, titre, contenu, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, maintenant, projet.id, entree.type, entree.titre, contenu, maintenant);

  return { ok: true, id, resume: `Page « ${entree.titre} » (${entree.type}) créée dans ${entree.projet}.` };
}
