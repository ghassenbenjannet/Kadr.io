// Serveur MCP (Jalon 4, §5 de la spec) : expose le catalogue d'outils à
// Claude Desktop en transport stdio. Le raisonnement (quel outil appeler,
// quand) reste entièrement du côté de Claude Desktop, couvert par
// l'abonnement de l'utilisateur — ce fichier ne fait jamais d'appel à un
// modèle. « L'IA propose, l'humain valide » reste vrai ici : les outils
// d'écriture ne font que créer une ecriture_proposee ; confirmer_ecriture /
// rejeter_ecriture sont les seuls chemins d'exécution.
//
// Frontière d'imports stricte (§2 de la spec, gardée par tests/mcp-import-boundary.test.ts) :
// src/mcp/** ne peut importer que agent/outils.ts, agent/ecritures.ts,
// agent/avertissements.ts et db/** — jamais src/tools/* directement, jamais
// @anthropic-ai/sdk, agent/client.ts, agent/boucle.ts ni agent/prompt.ts.
// Conséquence voulue : la liste d'outils MCP se dérive de catalogueOutils(),
// jamais d'une liste maintenue à la main — un outil tenu hors du catalogue
// (ex. supprimer_entite, jamais ajouté à agent/outils.ts) reste
// automatiquement hors MCP, sans code à écrire ici pour l'exclure.

import { z } from "zod";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type Database from "better-sqlite3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { ouvrirDb } from "../db/client.js";
import { migrer } from "../db/migrate.js";
import { catalogueOutils, outilParNom, type DefinitionOutil } from "../agent/outils.js";
import {
  creerEcritureProposee,
  listerEcrituresEnAttente,
  trancherEtNotifier,
  trouverEcriture,
  type EcritureProposee,
  type StatutEcriture,
} from "../agent/ecritures.js";
import { avertissementsPourProposition } from "../agent/avertissements.js";

export const NOM_SERVEUR = "registre-si";

/** Outils du catalogue jamais exposés au MCP : internes au fonctionnement de l'agent intégré. */
const OUTILS_EXCLUS_MCP = new Set(["charger_mode"]);

/**
 * Outils du catalogue exposés au MCP — dérivés de catalogueOutils(), jamais
 * d'une liste écrite à la main. Un outil futur non ajouté au catalogue (ou
 * ajouté à OUTILS_EXCLUS_MCP) reste hors MCP sans autre changement ici.
 */
export function outilsDuCatalogueExposesMcp(): DefinitionOutil[] {
  return catalogueOutils().filter((d) => !OUTILS_EXCLUS_MCP.has(d.nom));
}

export const NOMS_OUTILS_TRANSPORT = ["confirmer_ecriture", "rejeter_ecriture", "ecritures_en_attente"] as const;

/** Noms de tous les outils que le serveur MCP enregistre — pour les tests (§7.8bis). */
export function nomsOutilsExposesMcp(): string[] {
  return [...outilsDuCatalogueExposesMcp().map((d) => d.nom), ...NOMS_OUTILS_TRANSPORT];
}

function texteErreur(erreur: string): CallToolResult {
  return { content: [{ type: "text", text: erreur }], isError: true };
}

function texte(contenu: string): CallToolResult {
  return { content: [{ type: "text", text: contenu }] };
}

// --- Lecture -----------------------------------------------------------

function resumerPourMcp(resultat: unknown): string {
  if (typeof resultat !== "object" || resultat === null) return "terminé";
  const objet = resultat as Record<string, unknown>;
  for (const valeur of Object.values(objet)) {
    if (Array.isArray(valeur)) return `${valeur.length} résultat${valeur.length === 1 ? "" : "s"}`;
  }
  return "terminé";
}

/** §5.4 : le resume, puis les données utiles — rechercher_journal liste ses extraits plutôt qu'un JSON brut. */
export function formaterReponseLecture(nomOutil: string, resultat: unknown): CallToolResult {
  if (typeof resultat === "object" && resultat !== null && (resultat as { ok?: unknown }).ok === false) {
    const erreur = (resultat as { erreur?: unknown }).erreur;
    return texteErreur(typeof erreur === "string" ? erreur : "Échec.");
  }

  const resume = resumerPourMcp(resultat);
  if (
    nomOutil === "rechercher_journal" &&
    resultat &&
    typeof resultat === "object" &&
    Array.isArray((resultat as { resultats?: unknown }).resultats)
  ) {
    const resultats = (resultat as { resultats: Record<string, unknown>[] }).resultats;
    const lignes = resultats.map(
      (r) => `- [${r.entite}] ${r.lien_conversationnel} (${r.date}) — ${r.extrait}`
    );
    return texte([resume, ...lignes].join("\n"));
  }

  return texte(`${resume}\n\n${JSON.stringify(resultat, null, 2)}`);
}

// --- Proposition d'écriture ---------------------------------------------

export function proposerEcritureMcp(
  db: Database.Database,
  definition: DefinitionOutil,
  parametres: unknown
): { ecriture: EcritureProposee; avertissements: string[] } {
  const ecriture = creerEcritureProposee(db, {
    origine: "mcp",
    toolUseId: `mcp-${crypto.randomUUID()}`,
    outil: definition.nom,
    parametres,
  });
  const avertissements = avertissementsPourProposition(definition.nom, parametres as Record<string, unknown>);
  return { ecriture, avertissements };
}

/** §5.4 : « Écriture proposée #id (outil) », paramètres en JSON indenté, avertissements, attente de validation. */
export function formaterPropositionEcriture(ecriture: EcritureProposee, avertissements: string[]): CallToolResult {
  const lignes = [
    `Écriture proposée \`#${ecriture.id}\` (${ecriture.outil})`,
    "",
    JSON.stringify(ecriture.parametres, null, 2),
  ];
  if (avertissements.length > 0) {
    lignes.push("", ...avertissements.map((a) => `⚠️ ${a}`));
  }
  lignes.push("", "En attente de ta validation — utilise confirmer_ecriture ou rejeter_ecriture.");
  return texte(lignes.join("\n"));
}

// --- confirmer_ecriture / rejeter_ecriture / ecritures_en_attente ------

export const SCHEMA_CONFIRMER_ECRITURE = {
  ecriture_id: z.string().min(1),
  parametres: z.record(z.string(), z.unknown()).optional(),
};

export const SCHEMA_REJETER_ECRITURE = {
  ecriture_id: z.string().min(1),
  raison: z.string().optional(),
};

export const SCHEMA_ECRITURES_EN_ATTENTE = {};

export interface ResultatConfirmerEcriture {
  ok: boolean;
  statut?: StatutEcriture;
  resultat?: unknown;
  erreur?: string;
}

/** §5.1. */
export async function confirmerEcriture(
  db: Database.Database,
  args: { ecriture_id: string; parametres?: unknown }
): Promise<ResultatConfirmerEcriture> {
  const ecriture = trouverEcriture(db, args.ecriture_id);
  if (!ecriture) return { ok: false, erreur: "Écriture introuvable." };
  if (ecriture.statut !== "en_attente") {
    return { ok: false, erreur: `Écriture déjà tranchée (${ecriture.statut}).` };
  }
  const definition = outilParNom(ecriture.outil);
  if (!definition) return { ok: false, erreur: `Outil inconnu : ${ecriture.outil}` };

  let parametresFinal: unknown = ecriture.parametres;
  let corrige = false;
  if (args.parametres !== undefined) {
    const validation = z.object(definition.schemaEntree).safeParse(args.parametres);
    if (!validation.success) {
      const erreurs = validation.error.issues
        .map((i) => `${i.path.length > 0 ? i.path.join(".") : "(racine)"} : ${i.message}`)
        .join(" ; ");
      return { ok: false, erreur: erreurs };
    }
    parametresFinal = validation.data;
    corrige = JSON.stringify(parametresFinal) !== JSON.stringify(ecriture.parametres);
  }

  const resultat = await definition.executer(db, parametresFinal);
  const statut: StatutEcriture = corrige ? "modifiee_validee" : "validee";
  trancherEtNotifier(db, ecriture, statut, resultat);
  return { ok: true, statut, resultat };
}

/** §5.2. */
export function rejeterEcriture(
  db: Database.Database,
  args: { ecriture_id: string; raison?: string }
): ResultatConfirmerEcriture {
  const ecriture = trouverEcriture(db, args.ecriture_id);
  if (!ecriture) return { ok: false, erreur: "Écriture introuvable." };
  if (ecriture.statut !== "en_attente") {
    return { ok: false, erreur: `Écriture déjà tranchée (${ecriture.statut}).` };
  }
  const resultatRejet = { ok: false, erreur: args.raison ?? "Proposition rejetée par l'opérateur." };
  trancherEtNotifier(db, ecriture, "rejetee", resultatRejet, { estErreur: true });
  return { ok: true, statut: "rejetee" };
}

export interface EcritureEnAttenteMcp {
  id: string;
  outil: string;
  parametres: Record<string, unknown>;
  origine: string;
  avertissements: string[];
}

/** §5.3. */
export function ecrituresEnAttenteMcp(db: Database.Database): { ok: true; ecritures: EcritureEnAttenteMcp[] } {
  const ecritures = listerEcrituresEnAttente(db).map((e) => ({
    id: e.id,
    outil: e.outil,
    parametres: e.parametres,
    origine: e.origine,
    avertissements: avertissementsPourProposition(e.outil, e.parametres),
  }));
  return { ok: true, ecritures };
}

function formaterConfirmation(res: ResultatConfirmerEcriture): CallToolResult {
  if (!res.ok) return texteErreur(res.erreur ?? "Échec.");
  return texte(`Écriture ${res.statut}.\n\n${JSON.stringify(res.resultat, null, 2)}`);
}

function formaterRejet(res: ResultatConfirmerEcriture): CallToolResult {
  if (!res.ok) return texteErreur(res.erreur ?? "Échec.");
  return texte("Écriture rejetée.");
}

function formaterEcrituresEnAttente(res: { ok: true; ecritures: EcritureEnAttenteMcp[] }): CallToolResult {
  if (res.ecritures.length === 0) return texte("Aucune écriture en attente.");
  const blocs = res.ecritures.map((e) => {
    const lignes = [
      `\`#${e.id}\` ${e.outil} (origine : ${e.origine})`,
      JSON.stringify(e.parametres, null, 2),
    ];
    if (e.avertissements.length > 0) lignes.push(...e.avertissements.map((a) => `⚠️ ${a}`));
    return lignes.join("\n");
  });
  return texte(blocs.join("\n\n"));
}

// --- Assemblage du serveur ----------------------------------------------

export function creerServeurMcp(db: Database.Database): McpServer {
  const server = new McpServer({ name: NOM_SERVEUR, version: "1.0.0" });

  for (const definition of outilsDuCatalogueExposesMcp()) {
    server.registerTool(
      definition.nom,
      { description: definition.description, inputSchema: definition.schemaEntree },
      async (parametres): Promise<CallToolResult> => {
        if (definition.nature === "lecture") {
          const resultat = await definition.executer(db, parametres);
          return formaterReponseLecture(definition.nom, resultat);
        }
        const { ecriture, avertissements } = proposerEcritureMcp(db, definition, parametres);
        return formaterPropositionEcriture(ecriture, avertissements);
      }
    );
  }

  server.registerTool(
    "confirmer_ecriture",
    {
      description:
        "Valide une écriture proposée (avec d'éventuelles corrections de paramètres) : exécute l'outil et enregistre le résultat.",
      inputSchema: SCHEMA_CONFIRMER_ECRITURE,
    },
    async (args): Promise<CallToolResult> => formaterConfirmation(await confirmerEcriture(db, args))
  );

  server.registerTool(
    "rejeter_ecriture",
    { description: "Rejette une écriture proposée : rien n'est exécuté.", inputSchema: SCHEMA_REJETER_ECRITURE },
    async (args): Promise<CallToolResult> => formaterRejet(rejeterEcriture(db, args))
  );

  server.registerTool(
    "ecritures_en_attente",
    { description: "Liste les écritures proposées en attente de validation.", inputSchema: SCHEMA_ECRITURES_EN_ATTENTE },
    async (): Promise<CallToolResult> => formaterEcrituresEnAttente(ecrituresEnAttenteMcp(db))
  );

  return server;
}

async function demarrerServeurMcp(): Promise<void> {
  const db = ouvrirDb();
  migrer(db);
  const server = creerServeurMcp(db);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const cheminScriptAppele = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (cheminScriptAppele && import.meta.url === cheminScriptAppele) {
  demarrerServeurMcp().catch((erreur: unknown) => {
    console.error(erreur);
    process.exit(1);
  });
}
