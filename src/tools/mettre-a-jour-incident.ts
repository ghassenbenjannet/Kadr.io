import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, type Resultat } from "../db/util.js";

export const nom = "mettre_a_jour_incident";

export const description =
  "Complète un incident déjà enregistré : la cause identifiée après coup, sa résolution, ou son " +
  "action préventive. Un incident se déclare souvent avant d'être compris — c'est ici qu'on referme " +
  "la boucle.";

export const schemaEntree = {
  id: z.string().min(1),
  cause: z.string().optional(),
  resolution: z.string().optional(),
  resolu_le: z.string().optional().describe("Date ISO de résolution (déduite si omise et resolution fournie)"),
  action_preventive: z.string().optional(),
};

const schema = z.object(schemaEntree);
export type EntreeMettreAJourIncident = z.infer<typeof schema>;

interface IncidentRow {
  id: string;
  symptome: string;
  resolu_le: string | null;
  action_preventive: string | null;
}

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function mettreAJourIncident(db: Database.Database, entree: EntreeMettreAJourIncident): Resultat<Sortie> {
  const existant = db
    .prepare("SELECT id, symptome, resolu_le, action_preventive FROM incidents WHERE id = ?")
    .get(entree.id) as IncidentRow | undefined;
  if (!existant) {
    return { ok: false, erreur: "Incident introuvable." };
  }
  if (
    entree.cause === undefined &&
    entree.resolution === undefined &&
    entree.resolu_le === undefined &&
    entree.action_preventive === undefined
  ) {
    return { ok: false, erreur: "Rien à mettre à jour : précise au moins un champ." };
  }

  const maintenant = maintenantIso();
  const resoluLe = entree.resolu_le ?? (entree.resolution && !existant.resolu_le ? maintenant : undefined);

  db.prepare(
    `UPDATE incidents SET cause = COALESCE(@cause, cause), resolution = COALESCE(@resolution, resolution),
       resolu_le = COALESCE(@resolu_le, resolu_le),
       action_preventive = COALESCE(@action_preventive, action_preventive), maj_le = @maj_le
     WHERE id = @id`
  ).run({
    id: entree.id,
    cause: entree.cause ?? null,
    resolution: entree.resolution ?? null,
    resolu_le: resoluLe ?? null,
    action_preventive: entree.action_preventive ?? null,
    maj_le: maintenant,
  });

  const avertissements: string[] = [];
  const resoluFinal = resoluLe ?? existant.resolu_le;
  const actionFinale = entree.action_preventive ?? existant.action_preventive;
  if (resoluFinal && !actionFinale) {
    avertissements.push("Aucune action préventive déclarée. Le contrôle C6 restera ouvert.");
  }

  return { ok: true, id: entree.id, resume: `Incident « ${existant.symptome} » mis à jour.`, avertissements };
}
