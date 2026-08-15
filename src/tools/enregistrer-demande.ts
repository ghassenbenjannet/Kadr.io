import { z } from "zod";
import type Database from "better-sqlite3";
import { equipeEnum, prioriteEnum, typeDemandeEnum } from "../db/enums.js";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

export const nom = "enregistrer_demande";

export const description =
  "Enregistre une sollicitation reçue d'un utilisateur ou d'une équipe (CS, AE, Marketing, ADV, " +
  "Produit, Communication, Direction). Conserve les mots exacts du demandeur (expression_brute) " +
  "et, si déjà comprise, une reformulation. Si une priorité est donnée, qui l'a arbitrée doit " +
  "aussi être précisé.";

export const schemaEntree = {
  demandeur: z.string().min(1).describe("Nom de la personne à l'origine de la demande"),
  equipe: equipeEnum.describe("Équipe du demandeur"),
  expression_brute: z.string().min(1).describe("Les mots exacts du demandeur, jamais reformulés"),
  reformulation: z.string().optional().describe("Le besoin tel que compris, après échange"),
  type: typeDemandeEnum.describe("Nature de la demande"),
  priorite: prioriteEnum.optional().describe("Priorité arbitrée (P1/P2/P3), si déjà arbitrée"),
  priorite_arbitree_par: z.string().optional().describe("Qui a arbitré la priorité"),
};

const schema = z.object(schemaEntree);
export type EntreeEnregistrerDemande = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
}

export function enregistrerDemande(
  db: Database.Database,
  entree: EntreeEnregistrerDemande
): Resultat<Sortie> {
  if (entree.priorite && !entree.priorite_arbitree_par) {
    return { ok: false, erreur: "Une priorité doit être attribuable : qui l'a arbitrée ?" };
  }

  const id = nouvelId();
  const maintenant = maintenantIso();

  db.prepare(
    `INSERT INTO demandes
      (id, cree_le, demandeur, equipe, expression_brute, reformulation, type, priorite, priorite_arbitree_par, statut, maj_le)
     VALUES
      (@id, @cree_le, @demandeur, @equipe, @expression_brute, @reformulation, @type, @priorite, @priorite_arbitree_par, 'recue', @maj_le)`
  ).run({
    id,
    cree_le: maintenant,
    demandeur: entree.demandeur,
    equipe: entree.equipe,
    expression_brute: entree.expression_brute,
    reformulation: entree.reformulation ?? null,
    type: entree.type,
    priorite: entree.priorite ?? null,
    priorite_arbitree_par: entree.priorite_arbitree_par ?? null,
    maj_le: maintenant,
  });

  return {
    ok: true,
    id,
    resume: `Demande de ${entree.demandeur} (${entree.equipe}) enregistrée : ${entree.expression_brute}`,
  };
}
