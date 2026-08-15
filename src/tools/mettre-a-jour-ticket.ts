import { z } from "zod";
import type Database from "better-sqlite3";
import { statutTicketEnum } from "../db/enums.js";
import { maintenantIso, type Resultat } from "../db/util.js";

export const nom = "mettre_a_jour_ticket";

export const description =
  "Fait avancer un ticket : change son statut (a_faire, en_cours, bloque, termine) ou précise sa " +
  "description.";

export const schemaEntree = {
  id: z.string().min(1),
  statut: statutTicketEnum.optional(),
  description: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeMettreAJourTicket = z.infer<typeof schema>;

interface TicketRow {
  id: string;
  titre: string;
  statut: string;
}

interface Sortie {
  id: string;
  resume: string;
}

export function mettreAJourTicket(db: Database.Database, entree: EntreeMettreAJourTicket): Resultat<Sortie> {
  const existant = db.prepare("SELECT id, titre, statut FROM tickets WHERE id = ?").get(entree.id) as
    | TicketRow
    | undefined;
  if (!existant) {
    return { ok: false, erreur: "Ticket introuvable." };
  }

  if (entree.statut === undefined && entree.description === undefined) {
    return { ok: false, erreur: "Rien à mettre à jour : précise au moins un champ." };
  }

  const maintenant = maintenantIso();
  db.prepare(
    `UPDATE tickets SET statut = COALESCE(@statut, statut),
       description = COALESCE(@description, description), maj_le = @maj_le
     WHERE id = @id`
  ).run({
    id: entree.id,
    statut: entree.statut ?? null,
    description: entree.description ?? null,
    maj_le: maintenant,
  });

  return {
    ok: true,
    id: entree.id,
    resume: `Ticket « ${existant.titre} » mis à jour : statut ${entree.statut ?? existant.statut}.`,
  };
}
