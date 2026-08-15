import type Database from "better-sqlite3";
import { controleM2, type ChampRow } from "../controles/modele.js";

export interface ChampAvecContexte {
  id: string;
  nom: string;
  module: string;
  systeme: string;
  sourceDeVerite: string | null;
  editable: number | null;
}

export function champsAvecContexte(db: Database.Database, moduleFiltre?: string): ChampAvecContexte[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.nom, m.nom AS module, s.nom AS systeme,
              c.source_de_verite AS sourceDeVerite, c.editable
       FROM champs c
       JOIN modules m ON m.id = c.module_id
       JOIN systemes s ON s.id = m.systeme_id
       ${moduleFiltre ? "WHERE m.nom = ?" : ""}
       ORDER BY s.nom, m.nom, c.nom`
    )
    .all(...(moduleFiltre ? [moduleFiltre] : [])) as ChampAvecContexte[];
  return rows;
}

export function modulesDistincts(db: Database.Database): string[] {
  const rows = db.prepare("SELECT DISTINCT nom FROM modules ORDER BY nom").all() as { nom: string }[];
  return rows.map((r) => r.nom);
}

export function profilsDistincts(db: Database.Database): string[] {
  const rows = db.prepare("SELECT DISTINCT profil FROM habilitations ORDER BY profil").all() as {
    profil: string;
  }[];
  return rows.map((r) => r.profil);
}

export type DroitCellule = "editable" | "visible" | "masque" | "non_declare";

export function matriceHabilitations(
  db: Database.Database,
  moduleFiltre?: string
): { champs: ChampAvecContexte[]; profils: string[]; cellules: Map<string, DroitCellule> } {
  const champs = champsAvecContexte(db, moduleFiltre);
  const profils = profilsDistincts(db);
  const rows = db
    .prepare("SELECT champ_id, profil, visible, editable FROM habilitations")
    .all() as { champ_id: string; profil: string; visible: number; editable: number }[];

  const cellules = new Map<string, DroitCellule>();
  for (const r of rows) {
    const droit: DroitCellule = r.editable === 1 ? "editable" : r.visible === 1 ? "visible" : "masque";
    cellules.set(`${r.champ_id}|${r.profil}`, droit);
  }
  return { champs, profils, cellules };
}

/**
 * Champs groupés par source de vérité déclarée (« non déclarée » en dernier),
 * avec un marqueur de contradiction M2 pour les faire remonter en tête de groupe.
 */
export function champsParSourceDeVerite(
  db: Database.Database
): { source: string; champs: (ChampAvecContexte & { contredit: boolean })[] }[] {
  const champs = champsAvecContexte(db);
  const pourM2: ChampRow[] = champs.map((c) => ({
    id: c.id,
    nom: c.nom,
    source_de_verite: c.sourceDeVerite,
    editable: c.editable,
    systeme_module_nom: c.systeme,
  }));
  const contradictions = new Set(controleM2(pourM2).map((c) => c.entiteId));

  const groupes = new Map<string, (ChampAvecContexte & { contredit: boolean })[]>();
  for (const c of champs) {
    const cle = c.sourceDeVerite ?? "__non_declaree__";
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle)!.push({ ...c, contredit: contradictions.has(c.id) });
  }

  const resultat = Array.from(groupes.entries()).map(([source, liste]) => ({
    source: source === "__non_declaree__" ? "Non déclarée" : source,
    champs: liste.sort((a, b) => Number(b.contredit) - Number(a.contredit)),
  }));

  resultat.sort((a, b) => {
    if (a.source === "Non déclarée") return 1;
    if (b.source === "Non déclarée") return -1;
    return a.source.localeCompare(b.source);
  });
  return resultat;
}

export interface IntegrationAvecConstats {
  id: string;
  nom: string;
  source: string;
  cible: string;
  constatsOuverts: number;
}

/**
 * Compte les constats I ouverts rattachés à chaque intégration, y compris ceux
 * portés par ses erreurs (I4) ou métriques (I6) — pas seulement ceux portés
 * directement par l'intégration (I1,I2,I3,I5,I7).
 */
export function integrationsAvecConstats(db: Database.Database): IntegrationAvecConstats[] {
  return db
    .prepare(
      `SELECT i.id, i.nom, so.nom AS source, ci.nom AS cible,
              (SELECT COUNT(*) FROM constats co WHERE co.controle LIKE 'I%' AND co.statut = 'ouvert' AND (
                 (co.entite = 'integration' AND co.entite_id = i.id) OR
                 (co.entite = 'erreur_integration' AND co.entite_id IN (SELECT id FROM erreurs_integration WHERE integration_id = i.id)) OR
                 (co.entite = 'metrique' AND co.entite_id IN (SELECT id FROM metriques WHERE integration_id = i.id))
              )) AS constatsOuverts
       FROM integrations i
       JOIN systemes so ON so.id = i.source_id
       JOIN systemes ci ON ci.id = i.cible_id
       ORDER BY i.nom`
    )
    .all() as IntegrationAvecConstats[];
}
