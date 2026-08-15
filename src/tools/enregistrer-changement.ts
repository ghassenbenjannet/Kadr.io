import { z } from "zod";
import type Database from "better-sqlite3";
import { typeChangementEnum } from "../db/enums.js";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

export const nom = "enregistrer_changement";

export const description =
  "Enregistre une modification mise en production : description, périmètre touché, type " +
  "(paramétrage, Deluge, SQL, JS, config API, habilitations), procédure de retour arrière, test " +
  "effectué, communication faite. La saisie n'est jamais bloquée : un changement sans retour " +
  "arrière est quand même enregistré, avec un avertissement.";

export const schemaEntree = {
  description: z.string().min(1),
  perimetre: z.string().min(1).describe("Modules, champs, workflows, intégrations touchés"),
  type: typeChangementEnum,
  rollback: z.string().optional().describe("Procédure de retour arrière"),
  test_effectue: z.string().optional().describe("Quoi, avec qui"),
  communication: z.string().optional().describe("Qui a été prévenu"),
  demande_id: z.string().optional().describe("Id de la demande d'origine, si applicable"),
  decision_id: z.string().optional().describe("Id de la décision d'origine, si applicable"),
};

const schema = z.object(schemaEntree);
export type EntreeEnregistrerChangement = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function enregistrerChangement(
  db: Database.Database,
  entree: EntreeEnregistrerChangement
): Resultat<Sortie> {
  if (entree.demande_id) {
    const demande = db.prepare("SELECT id FROM demandes WHERE id = ?").get(entree.demande_id);
    if (!demande) {
      return { ok: false, erreur: `Demande introuvable : ${entree.demande_id}` };
    }
  }
  if (entree.decision_id) {
    const decision = db.prepare("SELECT id FROM decisions WHERE id = ?").get(entree.decision_id);
    if (!decision) {
      return { ok: false, erreur: `Décision introuvable : ${entree.decision_id}` };
    }
  }

  const id = nouvelId();
  const maintenant = maintenantIso();

  db.prepare(
    `INSERT INTO changements
      (id, cree_le, description, perimetre, type, rollback, test_effectue, communication, demande_id, decision_id, maj_le)
     VALUES
      (@id, @cree_le, @description, @perimetre, @type, @rollback, @test_effectue, @communication, @demande_id, @decision_id, @maj_le)`
  ).run({
    id,
    cree_le: maintenant,
    description: entree.description,
    perimetre: entree.perimetre,
    type: entree.type,
    rollback: entree.rollback ?? null,
    test_effectue: entree.test_effectue ?? null,
    communication: entree.communication ?? null,
    demande_id: entree.demande_id ?? null,
    decision_id: entree.decision_id ?? null,
    maj_le: maintenant,
  });

  const avertissements: string[] = [];
  if (!entree.rollback) {
    avertissements.push("Aucun retour arrière déclaré. Le contrôle C1 restera ouvert.");
  }

  return {
    ok: true,
    id,
    resume: `Changement « ${entree.description} » (${entree.type}) enregistré.`,
    avertissements,
  };
}
