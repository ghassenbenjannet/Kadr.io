import { z } from "zod";
import type Database from "better-sqlite3";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import { resoudreOuCreerChamp, resoudreOuCreerSysteme } from "../carte/resolveur.js";

export const nom = "decrire_integration";

export const description =
  "Décrit une intégration entre deux systèmes (ex : 'Devis → CRM') : authentification, " +
  "stratégie de synchro, clé d'idempotence, règle de rapprochement, règle de valeur vide, " +
  "procédure de reprise, champs mappés, erreurs connues, métriques de supervision. Upsert par " +
  "nom : rappeler avec le même nom complète l'intégration. Les listes fournies (champs, erreurs, " +
  "metriques) REMPLACENT entièrement celles déjà enregistrées, elles ne s'ajoutent pas.";

const sensEnum = z.enum(["lit", "ecrit"]);

export const schemaEntree = {
  nom: z.string().min(1),
  source: z.string().min(1).describe("Système source"),
  cible: z.string().min(1).describe("Système cible"),
  auth: z.string().optional().describe("'OAuth2', 'clé API'…"),
  strategie: z.string().optional().describe("'event', 'batch delta', 'batch complet'…"),
  idempotence: z.string().optional(),
  matching: z.string().optional(),
  regle_vide: z.string().optional(),
  regle_suppression: z.string().optional(),
  procedure_reprise: z.string().optional(),
  champs: z
    .array(
      z.object({ systeme: z.string(), module: z.string(), champ: z.string(), sens: sensEnum })
    )
    .optional()
    .describe("Champs mappés par cette intégration — remplace la liste existante si fourni"),
  erreurs: z
    .array(
      z.object({
        titre: z.string(),
        nature: z.enum(["fonctionnelle", "technique"]).optional(),
        traitement: z.string().optional(),
        rejeu: z.string().optional(),
      })
    )
    .optional()
    .describe("Erreurs connues — remplace la liste existante si fourni"),
  metriques: z
    .array(z.object({ nom: z.string(), seuil: z.string().optional() }))
    .optional()
    .describe("Métriques de supervision — remplace la liste existante si fourni"),
};

const schema = z.object(schemaEntree);
export type EntreeDecrireIntegration = z.infer<typeof schema>;

interface Sortie {
  id: string;
  resume: string;
  avertissements: string[];
}

export function decrireIntegration(
  db: Database.Database,
  entree: EntreeDecrireIntegration
): Resultat<Sortie> {
  const maintenant = maintenantIso();
  const avertissements: string[] = [];

  const source = resoudreOuCreerSysteme(db, entree.source);
  if (source.cree) avertissements.push(`Système « ${entree.source} » créé automatiquement, complète son rôle.`);
  const cible = resoudreOuCreerSysteme(db, entree.cible);
  if (cible.cree) avertissements.push(`Système « ${entree.cible} » créé automatiquement, complète son rôle.`);

  const existante = db
    .prepare(
      `SELECT id, auth, strategie, idempotence, matching, regle_vide, regle_suppression, procedure_reprise
       FROM integrations WHERE nom = ?`
    )
    .get(entree.nom) as
    | {
        id: string;
        auth: string | null;
        strategie: string | null;
        idempotence: string | null;
        matching: string | null;
        regle_vide: string | null;
        regle_suppression: string | null;
        procedure_reprise: string | null;
      }
    | undefined;

  let id: string;
  const changements: string[] = [];

  if (existante) {
    id = existante.id;
    db.prepare(
      `UPDATE integrations SET source_id = ?, cible_id = ?, auth = ?, strategie = ?, idempotence = ?, matching = ?, regle_vide = ?, regle_suppression = ?, procedure_reprise = ?, maj_le = ?
       WHERE id = ?`
    ).run(
      source.id,
      cible.id,
      entree.auth ?? existante.auth,
      entree.strategie ?? existante.strategie,
      entree.idempotence ?? existante.idempotence,
      entree.matching ?? existante.matching,
      entree.regle_vide ?? existante.regle_vide,
      entree.regle_suppression ?? existante.regle_suppression,
      entree.procedure_reprise ?? existante.procedure_reprise,
      maintenant,
      id
    );
    changements.push("mise à jour");
  } else {
    id = nouvelId();
    db.prepare(
      `INSERT INTO integrations (id, cree_le, nom, source_id, cible_id, auth, strategie, idempotence, matching, regle_vide, regle_suppression, procedure_reprise, maj_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      maintenant,
      entree.nom,
      source.id,
      cible.id,
      entree.auth ?? null,
      entree.strategie ?? null,
      entree.idempotence ?? null,
      entree.matching ?? null,
      entree.regle_vide ?? null,
      entree.regle_suppression ?? null,
      entree.procedure_reprise ?? null,
      maintenant
    );
    changements.push("créée");
  }

  if (entree.champs !== undefined) {
    db.prepare("DELETE FROM integration_champs WHERE integration_id = ?").run(id);
    for (const c of entree.champs) {
      const champ = resoudreOuCreerChamp(db, c.systeme, c.module, c.champ);
      avertissements.push(...champ.avertissements);
      db.prepare(
        "INSERT OR IGNORE INTO integration_champs (integration_id, champ_id, sens) VALUES (?, ?, ?)"
      ).run(id, champ.id, c.sens);
    }
    changements.push(`${entree.champs.length} champ(s) mappé(s)`);
  }

  if (entree.erreurs !== undefined) {
    db.prepare("DELETE FROM erreurs_integration WHERE integration_id = ?").run(id);
    for (const e of entree.erreurs) {
      db.prepare(
        `INSERT INTO erreurs_integration (id, integration_id, titre, nature, traitement, rejeu, maj_le)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(nouvelId(), id, e.titre, e.nature ?? null, e.traitement ?? null, e.rejeu ?? null, maintenant);
    }
    changements.push(`${entree.erreurs.length} erreur(s) déclarée(s)`);
  }

  if (entree.metriques !== undefined) {
    db.prepare("DELETE FROM metriques WHERE integration_id = ?").run(id);
    for (const m of entree.metriques) {
      db.prepare(
        `INSERT INTO metriques (id, integration_id, nom, seuil, maj_le) VALUES (?, ?, ?, ?, ?)`
      ).run(nouvelId(), id, m.nom, m.seuil ?? null, maintenant);
    }
    changements.push(`${entree.metriques.length} métrique(s) déclarée(s)`);
  }

  return {
    ok: true,
    id,
    resume: `Intégration « ${entree.nom} » ${changements.join(", ")}.`,
    avertissements,
  };
}
