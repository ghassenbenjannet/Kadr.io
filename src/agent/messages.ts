// Persistance des conversations (§4, migration v1.5). Chaque ligne de
// `messages` porte un tableau JSON de blocs Anthropic ; `role` distingue
// 'user' / 'assistant' / 'tool_result' (ce dernier redevient 'user' quand on
// reconstruit l'historique pour l'API — les tool_results y voyagent côté
// utilisateur).

import type Database from "better-sqlite3";
import { maintenantIso, nouvelId } from "../db/util.js";
import type { BlocContenu, MessageParamAnthropic } from "./client.js";

export type RoleMessage = "user" | "assistant" | "tool_result";

export interface MessageRow {
  id: string;
  conversation_id: string;
  cree_le: string;
  role: RoleMessage;
  contenu: BlocContenu[];
  tokens_entree: number | null;
  tokens_sortie: number | null;
}

export function creerConversation(db: Database.Database, titre?: string): string {
  const id = nouvelId();
  const maintenant = maintenantIso();
  db.prepare("INSERT INTO conversations (id, cree_le, titre, maj_le) VALUES (?, ?, ?, ?)").run(
    id,
    maintenant,
    titre ?? null,
    maintenant
  );
  return id;
}

export function conversationExiste(db: Database.Database, conversationId: string): boolean {
  return !!db.prepare("SELECT 1 FROM conversations WHERE id = ?").get(conversationId);
}

function toucherConversation(db: Database.Database, conversationId: string): void {
  db.prepare("UPDATE conversations SET maj_le = ? WHERE id = ?").run(maintenantIso(), conversationId);
}

/** Titre généré depuis le premier message utilisateur (troncature à 80 caractères). */
export function genererTitre(texte: string): string {
  const nettoye = texte.trim().replace(/\s+/g, " ");
  return nettoye.length > 80 ? `${nettoye.slice(0, 79)}…` : nettoye;
}

export interface OptionsEnregistrerMessage {
  tokensEntree?: number;
  tokensSortie?: number;
}

export function enregistrerMessage(
  db: Database.Database,
  conversationId: string,
  role: RoleMessage,
  contenu: BlocContenu[],
  options: OptionsEnregistrerMessage = {}
): string {
  const id = nouvelId();
  const maintenant = maintenantIso();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, cree_le, role, contenu, tokens_entree, tokens_sortie)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    conversationId,
    maintenant,
    role,
    JSON.stringify(contenu),
    options.tokensEntree ?? null,
    options.tokensSortie ?? null
  );
  toucherConversation(db, conversationId);
  return id;
}

export function listerMessages(db: Database.Database, conversationId: string): MessageRow[] {
  // Tri par rowid (ordre d'insertion) : cree_le seul ne suffit pas, deux messages
  // insérés dans le même appel synchrone peuvent partager le même horodatage.
  const rows = db
    .prepare(
      "SELECT id, conversation_id, cree_le, role, contenu, tokens_entree, tokens_sortie FROM messages WHERE conversation_id = ? ORDER BY rowid"
    )
    .all(conversationId) as {
    id: string;
    conversation_id: string;
    cree_le: string;
    role: RoleMessage;
    contenu: string;
    tokens_entree: number | null;
    tokens_sortie: number | null;
  }[];
  return rows.map((r) => ({ ...r, contenu: JSON.parse(r.contenu) as BlocContenu[] }));
}

/** Reconstruit l'historique au format attendu par l'API Anthropic : les lignes
 * 'tool_result' redeviennent des messages de rôle 'user' (contrat de l'API). */
export function versMessagesAnthropic(messages: MessageRow[]): MessageParamAnthropic[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.contenu,
  }));
}
