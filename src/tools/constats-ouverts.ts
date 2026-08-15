import { z } from "zod";
import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";
import { detailEntite } from "../db/libelles.js";

export const nom = "constats_ouverts";

export const description =
  "Liste les constats actuellement ouverts par la vigie, chacun avec sa conséquence rédigée et " +
  "depuis quand il est ouvert.";

export const schemaEntree = {};

const schema = z.object(schemaEntree);
export type EntreeConstatsOuverts = z.infer<typeof schema>;

interface ConstatOuvert {
  controle: string;
  entite: string;
  resume: string;
  consequence: string;
  depuis: string;
}

interface Sortie {
  constats: ConstatOuvert[];
}

export function constatsOuverts(db: Database.Database, _entree: EntreeConstatsOuverts): Resultat<Sortie> {
  const rows = db
    .prepare(
      "SELECT controle, entite, entite_id, consequence, cree_le FROM constats WHERE statut = 'ouvert' ORDER BY cree_le"
    )
    .all() as { controle: string; entite: string; entite_id: string; consequence: string; cree_le: string }[];

  const constats = rows.map((r) => ({
    controle: r.controle,
    entite: r.entite,
    resume: detailEntite(db, r.entite, r.entite_id)?.libelle ?? `${r.entite} ${r.entite_id}`,
    consequence: r.consequence,
    depuis: r.cree_le,
  }));

  return { ok: true, constats };
}
