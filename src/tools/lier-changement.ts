import { z } from "zod";
import type Database from "better-sqlite3";
import type { Resultat } from "../db/util.js";
import { trouverChamp, trouverModule } from "../carte/resolveur.js";
import { detailEntite } from "../db/libelles.js";

export const nom = "lier_changement";

export const description =
  "Confirme le lien entre un élément de la carte (champ, module, intégration, automatisation) et " +
  "un changement du journal, dans carte_journal. C'est la seule voie d'écriture pour ce lien : les " +
  "propositions faites par enregistrer_changement ne créent rien tant que ce n'est pas confirmé " +
  "ici. Rappeler avec les mêmes paramètres ne duplique pas.";

const entiteCarteEnum = z.enum(["champ", "module", "integration", "automatisation"]);

export const schemaEntree = {
  entite_carte: entiteCarteEnum,
  systeme: z.string().optional().describe("Requis pour 'champ' et 'module'"),
  module: z.string().optional().describe("Requis pour 'champ'"),
  nom: z.string().min(1),
  changement_id: z.string().min(1),
};

const schema = z.object(schemaEntree);
export type EntreeLierChangement = z.infer<typeof schema>;

interface Sortie {
  resume: string;
}

export function lierChangement(db: Database.Database, entree: EntreeLierChangement): Resultat<Sortie> {
  const changement = db.prepare("SELECT id FROM changements WHERE id = ?").get(entree.changement_id);
  if (!changement) {
    return { ok: false, erreur: `Changement introuvable : ${entree.changement_id}` };
  }

  let carteId: string | null = null;

  if (entree.entite_carte === "champ") {
    if (!entree.systeme || !entree.module) {
      return { ok: false, erreur: "Le type 'champ' requiert systeme et module." };
    }
    carteId = trouverChamp(db, entree.systeme, entree.module, entree.nom)?.id ?? null;
  } else if (entree.entite_carte === "module") {
    if (!entree.systeme) {
      return { ok: false, erreur: "Le type 'module' requiert systeme." };
    }
    carteId = trouverModule(db, entree.systeme, entree.nom)?.id ?? null;
  } else if (entree.entite_carte === "integration") {
    const row = db.prepare("SELECT id FROM integrations WHERE nom = ?").get(entree.nom) as
      | { id: string }
      | undefined;
    carteId = row?.id ?? null;
  } else {
    const row = db.prepare("SELECT id FROM automatisations WHERE nom = ?").get(entree.nom) as
      | { id: string }
      | undefined;
    carteId = row?.id ?? null;
  }

  if (!carteId) {
    return { ok: false, erreur: `Élément de carte introuvable (${entree.entite_carte}) : ${entree.nom}` };
  }

  db.prepare(
    "INSERT OR IGNORE INTO carte_journal (entite_carte, carte_id, changement_id) VALUES (?, ?, ?)"
  ).run(entree.entite_carte, carteId, entree.changement_id);

  const libelleChangement = detailEntite(db, "changement", entree.changement_id)?.libelle ?? entree.changement_id;
  return {
    ok: true,
    resume: `Lien confirmé : ${entree.entite_carte} « ${entree.nom} » ↔ ${libelleChangement}.`,
  };
}
