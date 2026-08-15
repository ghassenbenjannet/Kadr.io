import { z } from "zod";
import type Database from "better-sqlite3";
import { trouverChamp, trouverModule } from "../carte/resolveur.js";

export const nom = "impact";

export const description =
  "Répond à « si je modifie ce champ/ce module/cette intégration/cette automatisation, qu'est-ce " +
  "qui casse ? » : liste les automatisations et intégrations concernées (avec le sens lecture/" +
  "écriture), les profils habilités, et le dernier changement enregistré. Profondeur 1 (pas de " +
  "propagation transitive).";

const typeCibleEnum = z.enum(["champ", "module", "integration", "automatisation"]);

export const schemaEntree = {
  cible: z.object({
    type: typeCibleEnum,
    systeme: z.string().optional().describe("Requis pour 'champ' et 'module'"),
    module: z.string().optional().describe("Requis pour 'champ'"),
    nom: z.string().min(1),
  }),
};

const schema = z.object(schemaEntree);
export type EntreeImpact = z.infer<typeof schema>;

interface AutomatisationImpact {
  nom: string;
  type: string;
  sens: "lit" | "ecrit";
}

interface IntegrationImpact {
  nom: string;
  sens: "lit" | "ecrit";
}

interface HabilitationImpact {
  profil: string;
  droits: string;
}

interface ChampImpact {
  nom: string;
  module: string;
}

interface HistoriqueLigne {
  changement_id: string;
  date: string;
  description: string;
}

interface Sortie {
  cible: { type: string; nom: string; id: string };
  impacts: {
    automatisations: AutomatisationImpact[];
    integrations: IntegrationImpact[];
    habilitations: HabilitationImpact[];
    champs?: ChampImpact[];
  };
  historique: HistoriqueLigne[];
  resume: string;
}

type ResultatImpact = (Sortie & { ok: true }) | { ok: false; erreur: string; suggestions: string[] };

function libelleDroits(visible: number, editable: number): string {
  if (editable === 1) return "éditable";
  if (visible === 1) return "visible";
  return "masqué";
}

/**
 * Cherche des noms proches par LIKE, sur des préfixes de plus en plus courts du
 * motif recherché (typo en fin de mot : "Statut_Clint" -> "Statut_Cli%" trouve
 * "Statut_Client"). S'arrête au premier préfixe qui donne des résultats.
 */
function suggestionsProches(db: Database.Database, table: string, colonne: string, motif: string): string[] {
  const requete = db.prepare(`SELECT DISTINCT ${colonne} AS v FROM ${table} WHERE ${colonne} LIKE ? COLLATE NOCASE LIMIT 5`);

  const parMotifEntier = requete.all(`%${motif}%`) as { v: string }[];
  if (parMotifEntier.length > 0) return parMotifEntier.map((r) => r.v);

  const LONGUEUR_MINIMALE = 3;
  for (let longueur = motif.length - 1; longueur >= LONGUEUR_MINIMALE; longueur--) {
    const prefixe = motif.slice(0, longueur);
    const rows = requete.all(`%${prefixe}%`) as { v: string }[];
    if (rows.length > 0) return rows.map((r) => r.v);
  }
  return [];
}

function champsDeIds(db: Database.Database, champIds: string[]): ChampImpact[] {
  if (champIds.length === 0) return [];
  const placeholders = champIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT c.nom, m.nom AS module_nom FROM champs c JOIN modules m ON m.id = c.module_id WHERE c.id IN (${placeholders})`
    )
    .all(...champIds) as { nom: string; module_nom: string }[];
  return rows.map((r) => ({ nom: r.nom, module: r.module_nom }));
}

function automatisationsPourChamps(
  db: Database.Database,
  champIds: string[],
  excluAutomatisationId?: string
): AutomatisationImpact[] {
  if (champIds.length === 0) return [];
  const placeholders = champIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT DISTINCT a.id, a.nom, a.type, ac.sens FROM automatisation_champs ac
       JOIN automatisations a ON a.id = ac.automatisation_id
       WHERE ac.champ_id IN (${placeholders})`
    )
    .all(...champIds) as { id: string; nom: string; type: string; sens: "lit" | "ecrit" }[];
  return rows
    .filter((r) => r.id !== excluAutomatisationId)
    .map((r) => ({ nom: r.nom, type: r.type, sens: r.sens }));
}

function integrationsPourChamps(
  db: Database.Database,
  champIds: string[],
  excluIntegrationId?: string
): IntegrationImpact[] {
  if (champIds.length === 0) return [];
  const placeholders = champIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT DISTINCT i.id, i.nom, ic.sens FROM integration_champs ic
       JOIN integrations i ON i.id = ic.integration_id
       WHERE ic.champ_id IN (${placeholders})`
    )
    .all(...champIds) as { id: string; nom: string; sens: "lit" | "ecrit" }[];
  return rows.filter((r) => r.id !== excluIntegrationId).map((r) => ({ nom: r.nom, sens: r.sens }));
}

function habilitationsPourChamps(db: Database.Database, champIds: string[]): HabilitationImpact[] {
  if (champIds.length === 0) return [];
  const placeholders = champIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT DISTINCT profil, visible, editable FROM habilitations WHERE champ_id IN (${placeholders})`)
    .all(...champIds) as { profil: string; visible: number; editable: number }[];
  const vues = new Set<string>();
  const resultats: HabilitationImpact[] = [];
  for (const r of rows) {
    const droits = libelleDroits(r.visible, r.editable);
    const cle = `${r.profil}|${droits}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    resultats.push({ profil: r.profil, droits });
  }
  return resultats;
}

function historiquePour(db: Database.Database, entiteCarte: string, carteId: string): HistoriqueLigne[] {
  const rows = db
    .prepare(
      `SELECT ch.id AS changement_id, ch.cree_le AS date, ch.description
       FROM carte_journal cj JOIN changements ch ON ch.id = cj.changement_id
       WHERE cj.entite_carte = ? AND cj.carte_id = ?
       ORDER BY ch.cree_le DESC`
    )
    .all(entiteCarte, carteId) as HistoriqueLigne[];
  return rows;
}

function construireResume(libelleCible: string, impacts: Sortie["impacts"], historique: HistoriqueLigne[]): string {
  const parties: string[] = [];
  if (impacts.automatisations.length > 0) {
    parties.push(`${impacts.automatisations.length} automatisation(s)`);
  }
  if (impacts.integrations.length > 0) {
    parties.push(`${impacts.integrations.length} intégration(s)`);
  }
  if (impacts.habilitations.length > 0) {
    parties.push(`${impacts.habilitations.length} profil(s)`);
  }
  const debut =
    parties.length > 0
      ? `Modifier « ${libelleCible} » touche ${parties.join(", ")}.`
      : `Modifier « ${libelleCible} » ne touche rien de cartographié pour l'instant.`;

  if (historique.length === 0) return `${debut} Aucun changement enregistré.`;
  const dernier = historique[0]!;
  const date = new Date(dernier.date);
  const dateFr = `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${debut} Dernier changement : ${dateFr} (${dernier.description}).`;
}

export function impact(db: Database.Database, entree: EntreeImpact): ResultatImpact {
  const { cible } = entree;

  if (cible.type === "champ") {
    if (!cible.systeme || !cible.module) {
      return { ok: false, erreur: "Le type 'champ' requiert systeme et module.", suggestions: [] };
    }
    const champ = trouverChamp(db, cible.systeme, cible.module, cible.nom);
    if (!champ) {
      return {
        ok: false,
        erreur: `Champ introuvable : ${cible.nom}`,
        suggestions: suggestionsProches(db, "champs", "nom", cible.nom),
      };
    }
    const impacts = {
      automatisations: automatisationsPourChamps(db, [champ.id]),
      integrations: integrationsPourChamps(db, [champ.id]),
      habilitations: habilitationsPourChamps(db, [champ.id]),
    };
    const historique = historiquePour(db, "champ", champ.id);
    return {
      ok: true,
      cible: { type: "champ", nom: cible.nom, id: champ.id },
      impacts,
      historique,
      resume: construireResume(cible.nom, impacts, historique),
    };
  }

  if (cible.type === "module") {
    if (!cible.systeme) {
      return { ok: false, erreur: "Le type 'module' requiert systeme.", suggestions: [] };
    }
    const module = trouverModule(db, cible.systeme, cible.nom);
    if (!module) {
      return {
        ok: false,
        erreur: `Module introuvable : ${cible.nom}`,
        suggestions: suggestionsProches(db, "modules", "nom", cible.nom),
      };
    }
    const champIds = (
      db.prepare("SELECT id FROM champs WHERE module_id = ?").all(module.id) as { id: string }[]
    ).map((c) => c.id);
    const impacts = {
      automatisations: automatisationsPourChamps(db, champIds),
      integrations: integrationsPourChamps(db, champIds),
      habilitations: habilitationsPourChamps(db, champIds),
      champs: champsDeIds(db, champIds),
    };
    const historique = historiquePour(db, "module", module.id);
    return {
      ok: true,
      cible: { type: "module", nom: cible.nom, id: module.id },
      impacts,
      historique,
      resume: construireResume(cible.nom, impacts, historique),
    };
  }

  if (cible.type === "integration") {
    const integration = db.prepare("SELECT id FROM integrations WHERE nom = ?").get(cible.nom) as
      | { id: string }
      | undefined;
    if (!integration) {
      return {
        ok: false,
        erreur: `Intégration introuvable : ${cible.nom}`,
        suggestions: suggestionsProches(db, "integrations", "nom", cible.nom),
      };
    }
    const champIds = (
      db.prepare("SELECT champ_id FROM integration_champs WHERE integration_id = ?").all(integration.id) as {
        champ_id: string;
      }[]
    ).map((c) => c.champ_id);
    const impacts = {
      automatisations: automatisationsPourChamps(db, champIds),
      integrations: integrationsPourChamps(db, champIds, integration.id),
      habilitations: habilitationsPourChamps(db, champIds),
      champs: champsDeIds(db, champIds),
    };
    const historique = historiquePour(db, "integration", integration.id);
    return {
      ok: true,
      cible: { type: "integration", nom: cible.nom, id: integration.id },
      impacts,
      historique,
      resume: construireResume(cible.nom, impacts, historique),
    };
  }

  // automatisation
  const automatisation = db.prepare("SELECT id FROM automatisations WHERE nom = ?").get(cible.nom) as
    | { id: string }
    | undefined;
  if (!automatisation) {
    return {
      ok: false,
      erreur: `Automatisation introuvable : ${cible.nom}`,
      suggestions: suggestionsProches(db, "automatisations", "nom", cible.nom),
    };
  }
  const champIds = (
    db.prepare("SELECT champ_id FROM automatisation_champs WHERE automatisation_id = ?").all(automatisation.id) as {
      champ_id: string;
    }[]
  ).map((c) => c.champ_id);
  const impacts = {
    automatisations: automatisationsPourChamps(db, champIds, automatisation.id),
    integrations: integrationsPourChamps(db, champIds),
    habilitations: habilitationsPourChamps(db, champIds),
    champs: champsDeIds(db, champIds),
  };
  const historique = historiquePour(db, "automatisation", automatisation.id);
  return {
    ok: true,
    cible: { type: "automatisation", nom: cible.nom, id: automatisation.id },
    impacts,
    historique,
    resume: construireResume(cible.nom, impacts, historique),
  };
}
