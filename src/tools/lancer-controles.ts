import { z } from "zod";
import type Database from "better-sqlite3";
import { famillesPour } from "../controles/executer.js";
import type { Constat } from "../controles/types.js";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";
import { detailEntite } from "../db/libelles.js";

export const nom = "lancer_controles";

export const description =
  "Exécute la vigie : relit le journal et la carte, et met à jour les constats (pratique : " +
  "retours arrière, tests, origines ; modèle : sources de vérité, habilitations ; intégration : " +
  "idempotence, supervision). Idempotent : rejouer ne crée jamais de doublon, et un constat dont " +
  "la cause a disparu passe automatiquement en 'traité'.";

export const schemaEntree = {
  perimetre: z
    .enum(["tous", "pratique", "modele", "integration"])
    .optional()
    .describe("Sous-ensemble de contrôles à exécuter (défaut : tous)"),
};

const schema = z.object(schemaEntree);
export type EntreeLancerControles = z.infer<typeof schema>;

interface ConstatSortie {
  controle: string;
  entite: string;
  resume: string;
  consequence: string;
}

interface Sortie {
  nouveaux: number;
  resolus: number;
  ouverts: ConstatSortie[];
}

function cle(controle: string, entite: string, entiteId: string): string {
  return `${controle}|${entite}|${entiteId}`;
}

export function lancerControles(
  db: Database.Database,
  entree: EntreeLancerControles
): Resultat<Sortie> {
  const perimetre = entree.perimetre ?? "tous";
  const familles = famillesPour(perimetre);
  const maintenant = maintenantIso();

  let nouveaux = 0;
  let resolus = 0;

  const executer = db.transaction(() => {
    for (const famille of familles) {
      const constatsCalcules: Constat[] = famille.calculer(db);
      const clesActives = new Set(
        constatsCalcules.map((c) => cle(c.controle, c.entite, c.entiteId))
      );

      for (const c of constatsCalcules) {
        const existant = db
          .prepare("SELECT id, statut FROM constats WHERE controle = ? AND entite = ? AND entite_id = ?")
          .get(c.controle, c.entite, c.entiteId) as { id: string; statut: string } | undefined;

        if (!existant) {
          db.prepare(
            `INSERT INTO constats (id, cree_le, controle, entite, entite_id, consequence, statut)
             VALUES (?, ?, ?, ?, ?, ?, 'ouvert')`
          ).run(nouvelId(), maintenant, c.controle, c.entite, c.entiteId, c.consequence);
          nouveaux++;
        } else if (existant.statut === "accepte") {
          // Un risque explicitement accepté par l'opérateur ne se rouvre pas tout seul.
          db.prepare("UPDATE constats SET consequence = ? WHERE id = ?").run(c.consequence, existant.id);
        } else {
          db.prepare("UPDATE constats SET consequence = ?, statut = 'ouvert', traite_le = NULL WHERE id = ?").run(
            c.consequence,
            existant.id
          );
        }
      }

      const placeholders = famille.codes.map(() => "?").join(",");
      const existants = db
        .prepare(
          `SELECT id, controle, entite, entite_id FROM constats
           WHERE controle IN (${placeholders}) AND statut != 'traite'`
        )
        .all(...famille.codes) as { id: string; controle: string; entite: string; entite_id: string }[];

      for (const e of existants) {
        if (!clesActives.has(cle(e.controle, e.entite, e.entite_id))) {
          db.prepare("UPDATE constats SET statut = 'traite', traite_le = ? WHERE id = ?").run(
            maintenant,
            e.id
          );
          resolus++;
        }
      }
    }
  });
  executer();

  const ouverts = db
    .prepare("SELECT controle, entite, entite_id, consequence FROM constats WHERE statut = 'ouvert' ORDER BY cree_le")
    .all() as { controle: string; entite: string; entite_id: string; consequence: string }[];

  return {
    ok: true,
    nouveaux,
    resolus,
    ouverts: ouverts.map((o) => ({
      controle: o.controle,
      entite: o.entite,
      resume: detailEntite(db, o.entite, o.entite_id)?.libelle ?? `${o.entite} ${o.entite_id}`,
      consequence: o.consequence,
    })),
  };
}
