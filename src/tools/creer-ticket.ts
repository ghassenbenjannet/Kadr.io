import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import { typeTicketEnum } from "../db/enums.js";
import { resoudreOuCreerEpic } from "../tickets/resolveur.js";

export const nom = "creer_ticket";

export const description =
  "Crée un ticket (analyse, documentation, atelier, bug ou task) dans un epic d'un projet. Chaque " +
  "appel crée un nouveau ticket — pas d'upsert par titre, deux tickets peuvent partager un intitulé. " +
  "Si le projet ou l'epic n'existe pas encore, ils sont créés automatiquement (avec avertissement).";

export const schemaEntree = {
  projet: z.string().min(1),
  epic: z.string().min(1),
  titre: z.string().min(1),
  type: typeTicketEnum,
  description: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeCreerTicket = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function creerTicket(db: Database.Database, entree: EntreeCreerTicket): Resultat<Sortie> {
  const epic = resoudreOuCreerEpic(db, entree.projet, entree.epic);
  const id = nouvelId();
  const maintenant = maintenantIso();

  db.prepare(
    `INSERT INTO tickets (id, cree_le, epic_id, titre, description, type, statut, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, 'a_faire', ?)`
  ).run(id, maintenant, epic.id, entree.titre, entree.description ?? null, entree.type, maintenant);

  return {
    ok: true,
    id,
    resume: `Ticket « ${entree.titre} » (${entree.type}) créé dans ${entree.projet} / ${entree.epic}.`,
    avertissements: epic.avertissements,
  };
}
