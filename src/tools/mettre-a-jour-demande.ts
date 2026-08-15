import { z } from "zod";
import type Database from "better-sqlite3";
import { prioriteEnum, statutDemandeEnum } from "../db/enums.js";
import { maintenantIso, type Resultat } from "../db/util.js";

export const nom = "mettre_a_jour_demande";

export const description =
  "Fait avancer une demande déjà enregistrée : change son statut (recue, qualifiee, arbitree, " +
  "realisee, refusee, reportee), précise sa reformulation une fois le besoin compris, ou arbitre " +
  "sa priorité. Ne modifie jamais expression_brute — c'est la source, elle ne bouge pas.";

export const schemaEntree = {
  id: z.string().min(1).describe("Identifiant de la demande à faire avancer"),
  statut: statutDemandeEnum.optional().describe("Nouveau statut"),
  reformulation: z.string().optional().describe("Le besoin tel que compris, après échange"),
  priorite: prioriteEnum.optional().describe("Priorité arbitrée (P1/P2/P3)"),
  priorite_arbitree_par: z.string().optional().describe("Qui a arbitré la priorité"),
};

const schema = z.object(schemaEntree);
export type EntreeMettreAJourDemande = z.infer<typeof schema>;

interface DemandeRow {
  id: string;
  demandeur: string;
  equipe: string;
  statut: string;
  priorite: string | null;
  priorite_arbitree_par: string | null;
}

interface Sortie {
  id: string;
  resume: string;
}

export function mettreAJourDemande(
  db: Database.Database,
  entree: EntreeMettreAJourDemande
): Resultat<Sortie> {
  const existante = db
    .prepare("SELECT id, demandeur, equipe, statut, priorite, priorite_arbitree_par FROM demandes WHERE id = ?")
    .get(entree.id) as DemandeRow | undefined;
  if (!existante) {
    return { ok: false, erreur: "Demande introuvable." };
  }

  if (
    entree.statut === undefined &&
    entree.reformulation === undefined &&
    entree.priorite === undefined &&
    entree.priorite_arbitree_par === undefined
  ) {
    return { ok: false, erreur: "Rien à mettre à jour : précise au moins un champ." };
  }

  const prioriteFinale = entree.priorite ?? existante.priorite;
  const prioriteArbitreeParFinale = entree.priorite_arbitree_par ?? existante.priorite_arbitree_par;
  if (prioriteFinale && !prioriteArbitreeParFinale) {
    return { ok: false, erreur: "Une priorité doit être attribuable : qui l'a arbitrée ?" };
  }

  const maintenant = maintenantIso();
  db.prepare(
    `UPDATE demandes
     SET statut = @statut, reformulation = COALESCE(@reformulation, reformulation),
         priorite = @priorite, priorite_arbitree_par = @priorite_arbitree_par, maj_le = @maj_le
     WHERE id = @id`
  ).run({
    id: entree.id,
    statut: entree.statut ?? existante.statut,
    reformulation: entree.reformulation ?? null,
    priorite: prioriteFinale,
    priorite_arbitree_par: prioriteArbitreeParFinale,
    maj_le: maintenant,
  });

  return {
    ok: true,
    id: entree.id,
    resume: `Demande de ${existante.demandeur} (${existante.equipe}) mise à jour : statut ${entree.statut ?? existante.statut}`,
  };
}
