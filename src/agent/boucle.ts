// La boucle agent (§5.2 spec Jalon 1 bis). Rejouable à travers deux points
// d'entrée HTTP distincts : envoyerMessageUtilisateur (POST /api/chat) et
// reprendreApresDecision (POST /api/confirm) — la boucle elle-même ne vit
// jamais plus longtemps qu'une requête HTTP, tout son état est en DB.
//
// disable_parallel_tool_use (voir agent/client.ts) garantit qu'un tour ne
// contient jamais plus d'un bloc tool_use : la pause sur écriture n'a donc
// jamais à gérer un lot partiel de tool_results.

import type Database from "better-sqlite3";
import type { BlocContenu, ClientAnthropic, GestionnaireTexte } from "./client.js";
import type { ConfigAgent } from "./config.js";
import { outilParNom, schemasAnthropic } from "./outils.js";
import { listerModes } from "./modes.js";
import {
  conversationExiste,
  creerConversation,
  enregistrerMessage,
  genererTitre,
  listerMessages,
  versMessagesAnthropic,
} from "./messages.js";
import { creerEcritureProposee, trancherEcriture, trouverEcriture, type EcritureProposee } from "./ecritures.js";

export const MAX_TOURS_DEFAUT = 8;

export interface RappelsBoucle {
  onTexte?: GestionnaireTexte;
  onOutilLecture?: (nomOutil: string) => void;
  onOutilLectureTermine?: (nomOutil: string, resultat: unknown) => void;
  onValidationRequise?: (ecriture: EcritureProposee) => void;
}

export interface ResultatBoucle {
  conversationId: string;
  /** true si la boucle s'est terminée (réponse finale du modèle, ou arrêt garde-fou). */
  termine: boolean;
  /** true si une écriture attend une décision humaine : la boucle est en pause. */
  enAttenteValidation: boolean;
  ecritureId?: string;
}

interface ContexteBoucle {
  db: Database.Database;
  client: ClientAnthropic;
  config: ConfigAgent;
  promptSysteme: string;
  conversationId: string;
  rappels: RappelsBoucle;
  maxTours: number;
}

function messageLimiteAtteinte(maxTours: number): BlocContenu[] {
  return [
    {
      type: "text",
      text: `Trop d'étapes enchaînées pour cette demande (limite : ${maxTours}). Peux-tu reformuler ou découper ta demande ?`,
    },
  ];
}

function systemeAvecContexte(promptSysteme: string, db: Database.Database): string {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const modes = listerModes(db);
  const annuaireModes =
    modes.length === 0
      ? "Aucun mode disponible pour l'instant."
      : modes.map((m) => `- \`${m.cle}\` = ${m.titre}${m.description ? ` — ${m.description}` : ""}`).join("\n");
  return `${promptSysteme}\n\nDate du jour : ${aujourdhui}.\n\nModes disponibles (charger_mode) :\n${annuaireModes}`;
}

function estBlocToolUse(bloc: BlocContenu): bloc is Extract<BlocContenu, { type: "tool_use" }> {
  return bloc.type === "tool_use";
}

/** Un tour = un appel à l'API + le traitement de sa réponse (au plus un tool_use, cf. en-tête). */
async function unTour(ctx: ContexteBoucle): Promise<ResultatBoucle> {
  const historique = versMessagesAnthropic(listerMessages(ctx.db, ctx.conversationId));

  const reponse = await ctx.client.creerMessage(
    {
      model: ctx.config.model,
      maxTokens: ctx.config.maxTokens,
      system: systemeAvecContexte(ctx.promptSysteme, ctx.db),
      messages: historique,
      tools: schemasAnthropic(),
    },
    ctx.rappels.onTexte
  );

  const messageId = enregistrerMessage(ctx.db, ctx.conversationId, "assistant", reponse.content, {
    tokensEntree: reponse.usage.input_tokens,
    tokensSortie: reponse.usage.output_tokens,
  });

  const blocOutil = reponse.content.find(estBlocToolUse);
  if (!blocOutil) {
    return { conversationId: ctx.conversationId, termine: true, enAttenteValidation: false };
  }

  const definition = outilParNom(blocOutil.name);
  if (!definition) {
    enregistrerMessage(ctx.db, ctx.conversationId, "tool_result", [
      {
        type: "tool_result",
        tool_use_id: blocOutil.id,
        content: JSON.stringify({ ok: false, erreur: `Outil inconnu : ${blocOutil.name}` }),
        is_error: true,
      },
    ]);
    return { conversationId: ctx.conversationId, termine: false, enAttenteValidation: false };
  }

  if (definition.nature === "lecture") {
    ctx.rappels.onOutilLecture?.(definition.nom);
    const resultat = await definition.executer(ctx.db, blocOutil.input);
    ctx.rappels.onOutilLectureTermine?.(definition.nom, resultat);
    enregistrerMessage(ctx.db, ctx.conversationId, "tool_result", [
      { type: "tool_result", tool_use_id: blocOutil.id, content: JSON.stringify(resultat) },
    ]);
    return { conversationId: ctx.conversationId, termine: false, enAttenteValidation: false };
  }

  // Outil d'écriture : on ne l'exécute jamais ici. On pause la boucle.
  const ecriture = creerEcritureProposee(ctx.db, {
    conversationId: ctx.conversationId,
    messageId,
    toolUseId: blocOutil.id,
    outil: definition.nom,
    parametres: blocOutil.input,
  });
  ctx.rappels.onValidationRequise?.(ecriture);
  return { conversationId: ctx.conversationId, termine: false, enAttenteValidation: true, ecritureId: ecriture.id };
}

async function boucler(ctx: ContexteBoucle): Promise<ResultatBoucle> {
  for (let tour = 1; tour <= ctx.maxTours; tour++) {
    const resultat = await unTour(ctx);
    if (resultat.termine || resultat.enAttenteValidation) return resultat;
  }
  enregistrerMessage(ctx.db, ctx.conversationId, "assistant", messageLimiteAtteinte(ctx.maxTours));
  return { conversationId: ctx.conversationId, termine: true, enAttenteValidation: false };
}

export interface EntreeEnvoyerMessage {
  conversationId?: string;
  message: string;
}

/** POST /api/chat : ajoute le message utilisateur et fait tourner la boucle. */
export async function envoyerMessageUtilisateur(
  db: Database.Database,
  client: ClientAnthropic,
  config: ConfigAgent,
  promptSysteme: string,
  entree: EntreeEnvoyerMessage,
  rappels: RappelsBoucle = {},
  maxTours = MAX_TOURS_DEFAUT
): Promise<ResultatBoucle> {
  let conversationId = entree.conversationId;
  if (!conversationId || !conversationExiste(db, conversationId)) {
    conversationId = creerConversation(db, genererTitre(entree.message));
  }
  enregistrerMessage(db, conversationId, "user", [{ type: "text", text: entree.message }]);

  return boucler({ db, client, config, promptSysteme, conversationId, rappels, maxTours });
}

export interface EntreeReprendreApresDecision {
  ecritureId: string;
  decision: "valider" | "rejeter";
  /** Paramètres corrigés par l'opérateur avant validation (sinon, ceux proposés par l'IA). */
  parametres?: unknown;
}

/** POST /api/confirm : tranche une écriture proposée puis reprend la boucle. */
export async function reprendreApresDecision(
  db: Database.Database,
  client: ClientAnthropic,
  config: ConfigAgent,
  promptSysteme: string,
  entree: EntreeReprendreApresDecision,
  rappels: RappelsBoucle = {},
  maxTours = MAX_TOURS_DEFAUT
): Promise<ResultatBoucle> {
  const ecriture = trouverEcriture(db, entree.ecritureId);
  if (!ecriture) {
    throw new Error(`Écriture proposée introuvable : ${entree.ecritureId}`);
  }
  if (ecriture.statut !== "en_attente") {
    throw new Error(`Écriture déjà tranchée (${ecriture.statut}) : ${entree.ecritureId}`);
  }
  const definition = outilParNom(ecriture.outil);
  if (!definition) {
    throw new Error(`Outil inconnu : ${ecriture.outil}`);
  }

  if (entree.decision === "rejeter") {
    const resultatAnnulation = { ok: false, erreur: "Proposition rejetée par l'opérateur." };
    trancherEcriture(db, ecriture.id, "rejetee", resultatAnnulation);
    enregistrerMessage(db, ecriture.conversation_id, "tool_result", [
      {
        type: "tool_result",
        tool_use_id: ecriture.tool_use_id,
        content: JSON.stringify(resultatAnnulation),
        is_error: true,
      },
    ]);
  } else {
    const parametresProposes = ecriture.parametres;
    const parametresFinal = entree.parametres === undefined ? parametresProposes : entree.parametres;
    const corrige = JSON.stringify(parametresFinal) !== JSON.stringify(parametresProposes);

    const resultat = await definition.executer(db, parametresFinal);
    trancherEcriture(db, ecriture.id, corrige ? "modifiee_validee" : "validee", resultat);
    enregistrerMessage(db, ecriture.conversation_id, "tool_result", [
      { type: "tool_result", tool_use_id: ecriture.tool_use_id, content: JSON.stringify(resultat) },
    ]);
  }

  return boucler({
    db,
    client,
    config,
    promptSysteme,
    conversationId: ecriture.conversation_id,
    rappels,
    maxTours,
  });
}
