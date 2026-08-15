// Registre des modes de travail spécialisés ("Agents", § moteur de routage).
// Chaque mode est un texte d'instructions chargé à la demande par l'outil
// charger_mode plutôt qu'injecté en permanence dans le prompt système —
// garde le prompt de base petit, et laisse l'agent décider, via la table
// de routage qu'il contient, quand charger quoi.
//
// Vit en DB (table agents_modes) plutôt que dans agent/modes/*.md : ces
// fichiers sont copiés dans l'image Docker au build et le conteneur tourne
// en lecture seule sous /app (voir Dockerfile) — les éditer à l'exécution
// ne persisterait pas et échouerait même en écriture. La DB, elle, vit dans
// /data, le volume monté. Les 4 fichiers .md d'origine ne servent plus
// qu'à amorcer la table au premier démarrage (seedModesDefaut), une seule
// fois : après ça, agents_modes est la seule source de vérité.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { z } from "zod";
import { maintenantIso, nouvelId, type Resultat } from "../db/util.js";

const iciDir = dirname(fileURLToPath(import.meta.url));

export interface Mode {
  id: string;
  cree_le: string;
  cle: string;
  titre: string;
  description: string | null;
  contenu: string;
  maj_le: string;
}

interface AmorceMode {
  cle: string;
  titre: string;
  fichier: string;
}

const MODES_AMORCE: AmorceMode[] = [
  { cle: "analyse", titre: "Analyse de demande", fichier: "analyse.md" },
  { cle: "architecture", titre: "Architecture de solution", fichier: "architecture.md" },
  { cle: "revue", titre: "Revue SI", fichier: "revue.md" },
  { cle: "livrable", titre: "Préparation de livrable", fichier: "livrable.md" },
];

/** Idempotent : n'amorce que si la table est vide (première migration ou nouvelle install). */
export function seedModesDefaut(db: Database.Database): void {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM agents_modes").get() as { n: number };
  if (n > 0) return;
  const maintenant = maintenantIso();
  const inserer = db.prepare(
    `INSERT INTO agents_modes (id, cree_le, cle, titre, description, contenu, maj_le)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`
  );
  for (const amorce of MODES_AMORCE) {
    const chemin = join(iciDir, "modes", amorce.fichier);
    if (!existsSync(chemin)) continue;
    const contenu = readFileSync(chemin, "utf-8");
    inserer.run(nouvelId(), maintenant, amorce.cle, amorce.titre, contenu, maintenant);
  }
}

export function listerModes(db: Database.Database): Mode[] {
  return db.prepare("SELECT * FROM agents_modes ORDER BY titre").all() as Mode[];
}

export function obtenirModeParCle(db: Database.Database, cle: string): Mode | undefined {
  return db.prepare("SELECT * FROM agents_modes WHERE cle = ?").get(cle) as Mode | undefined;
}

export function obtenirMode(db: Database.Database, id: string): Mode | undefined {
  return db.prepare("SELECT * FROM agents_modes WHERE id = ?").get(id) as Mode | undefined;
}

/** Lu par l'outil charger_mode : le texte d'instructions d'un mode, ou null s'il n'existe pas. */
export function chargerMode(db: Database.Database, cle: string): string | null {
  return obtenirModeParCle(db, cle)?.contenu ?? null;
}

const cleMode = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9_-]+$/, "la clé ne peut contenir que des minuscules, chiffres, tirets et underscores");

export const schemaCreerMode = {
  cle: cleMode,
  titre: z.string().min(1),
  description: z.string().optional(),
  contenu: z.string().min(1),
};

export const schemaMettreAJourMode = {
  id: z.string().min(1),
  cle: cleMode.optional(),
  titre: z.string().min(1).optional(),
  description: z.string().optional(),
  contenu: z.string().min(1).optional(),
};

export function creerMode(
  db: Database.Database,
  entree: z.infer<ReturnType<typeof z.object<typeof schemaCreerMode>>>
): Resultat<{ id: string }> {
  const existant = obtenirModeParCle(db, entree.cle);
  if (existant) {
    return { ok: false, erreur: `Un agent avec la clé « ${entree.cle} » existe déjà.` };
  }
  const id = nouvelId();
  const maintenant = maintenantIso();
  db.prepare(
    `INSERT INTO agents_modes (id, cree_le, cle, titre, description, contenu, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, maintenant, entree.cle, entree.titre, entree.description ?? null, entree.contenu, maintenant);
  return { ok: true, id };
}

export function mettreAJourMode(
  db: Database.Database,
  entree: z.infer<ReturnType<typeof z.object<typeof schemaMettreAJourMode>>>
): Resultat<{ id: string }> {
  const existant = obtenirMode(db, entree.id);
  if (!existant) {
    return { ok: false, erreur: "Agent introuvable." };
  }
  if (entree.cle && entree.cle !== existant.cle) {
    const conflit = obtenirModeParCle(db, entree.cle);
    if (conflit) {
      return { ok: false, erreur: `Un agent avec la clé « ${entree.cle} » existe déjà.` };
    }
  }
  db.prepare(
    `UPDATE agents_modes SET cle = @cle, titre = @titre, description = @description,
       contenu = @contenu, maj_le = @maj_le WHERE id = @id`
  ).run({
    id: entree.id,
    cle: entree.cle ?? existant.cle,
    titre: entree.titre ?? existant.titre,
    description: entree.description ?? existant.description,
    contenu: entree.contenu ?? existant.contenu,
    maj_le: maintenantIso(),
  });
  return { ok: true, id: entree.id };
}

export function supprimerMode(db: Database.Database, id: string): Resultat<{ id: string }> {
  const existant = obtenirMode(db, id);
  if (!existant) {
    return { ok: false, erreur: "Agent introuvable." };
  }
  db.prepare("DELETE FROM agents_modes WHERE id = ?").run(id);
  return { ok: true, id };
}
