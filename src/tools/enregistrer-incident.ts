import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

export const nom = "enregistrer_incident";

export const description =
  "Enregistre un incident : symptôme, impact, cause identifiée si connue, le changement fautif " +
  "s'il y en a un, résolution et action préventive. Comme pour un changement, la saisie n'est " +
  "jamais bloquée par un champ manquant.";

export const schemaEntree = {
  symptome: z.string().min(1),
  impact: z.string().min(1),
  cause: z.string().optional(),
  changement_id: z.string().optional().describe("Id du changement fautif, si identifié"),
  resolution: z.string().optional(),
  // JALON1: résolu_le n'est pas dans le vocabulaire naturel de l'entrée conversationnelle ;
  // si une resolution est fournie sans date explicite, resolu_le est déduit = maintenant.
  resolu_le: z.string().optional().describe("Date ISO de résolution (déduite si omise et resolution fournie)"),
  action_preventive: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeEnregistrerIncident = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function enregistrerIncident(
  db: Database.Database,
  entree: EntreeEnregistrerIncident
): Resultat<Sortie> {
  if (entree.changement_id) {
    const changement = db.prepare("SELECT id FROM changements WHERE id = ?").get(entree.changement_id);
    if (!changement) {
      return { ok: false, erreur: `Changement introuvable : ${entree.changement_id}` };
    }
  }

  const id = nouvelId();
  const maintenant = maintenantIso();
  const resoluLe = entree.resolu_le ?? (entree.resolution ? maintenant : null);

  db.prepare(
    `INSERT INTO incidents
      (id, cree_le, symptome, impact, cause, changement_id, resolution, resolu_le, action_preventive, prevention_faite, maj_le)
     VALUES
      (@id, @cree_le, @symptome, @impact, @cause, @changement_id, @resolution, @resolu_le, @action_preventive, 0, @maj_le)`
  ).run({
    id,
    cree_le: maintenant,
    symptome: entree.symptome,
    impact: entree.impact,
    cause: entree.cause ?? null,
    changement_id: entree.changement_id ?? null,
    resolution: entree.resolution ?? null,
    resolu_le: resoluLe,
    action_preventive: entree.action_preventive ?? null,
    maj_le: maintenant,
  });

  const avertissements: string[] = [];
  if (resoluLe && !entree.action_preventive) {
    avertissements.push("Aucune action préventive déclarée. Le contrôle C6 restera ouvert.");
  }

  return {
    ok: true,
    id,
    resume: `Incident « ${entree.symptome} » enregistré.`,
    avertissements,
  };
}
