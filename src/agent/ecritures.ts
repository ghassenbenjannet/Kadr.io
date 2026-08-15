import type Database from "better-sqlite3";
import { maintenantIso, nouvelId } from "../db/util.js";
import { enregistrerMessage } from "./messages.js";

export type StatutEcriture = "en_attente" | "validee" | "rejetee" | "modifiee_validee";
export type OrigineEcriture = "app" | "mcp";

export interface EcritureProposee {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  origine: OrigineEcriture;
  tool_use_id: string;
  outil: string;
  parametres: Record<string, unknown>;
  statut: StatutEcriture;
  resultat: unknown | null;
  tranche_le: string | null;
}

export function creerEcritureProposee(
  db: Database.Database,
  args: {
    conversationId?: string | null;
    messageId?: string | null;
    origine?: OrigineEcriture;
    toolUseId: string;
    outil: string;
    parametres: unknown;
  }
): EcritureProposee {
  const id = nouvelId();
  const conversationId = args.conversationId ?? null;
  const messageId = args.messageId ?? null;
  const origine = args.origine ?? "app";
  db.prepare(
    `INSERT INTO ecritures_proposees (id, conversation_id, message_id, origine, tool_use_id, outil, parametres, statut)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')`
  ).run(id, conversationId, messageId, origine, args.toolUseId, args.outil, JSON.stringify(args.parametres));
  return {
    id,
    conversation_id: conversationId,
    message_id: messageId,
    origine,
    tool_use_id: args.toolUseId,
    outil: args.outil,
    parametres: args.parametres as Record<string, unknown>,
    statut: "en_attente",
    resultat: null,
    tranche_le: null,
  };
}

function ligneVersEcriture(row: {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  origine: OrigineEcriture;
  tool_use_id: string;
  outil: string;
  parametres: string;
  statut: StatutEcriture;
  resultat: string | null;
  tranche_le: string | null;
}): EcritureProposee {
  return {
    ...row,
    parametres: JSON.parse(row.parametres) as Record<string, unknown>,
    resultat: row.resultat ? JSON.parse(row.resultat) : null,
  };
}

export function trouverEcriture(db: Database.Database, id: string): EcritureProposee | null {
  const row = db
    .prepare(
      "SELECT id, conversation_id, message_id, origine, tool_use_id, outil, parametres, statut, resultat, tranche_le FROM ecritures_proposees WHERE id = ?"
    )
    .get(id) as
    | {
        id: string;
        conversation_id: string | null;
        message_id: string | null;
        origine: OrigineEcriture;
        tool_use_id: string;
        outil: string;
        parametres: string;
        statut: StatutEcriture;
        resultat: string | null;
        tranche_le: string | null;
      }
    | undefined;
  return row ? ligneVersEcriture(row) : null;
}

export function trancherEcriture(
  db: Database.Database,
  id: string,
  statut: Exclude<StatutEcriture, "en_attente">,
  resultat: unknown
): void {
  db.prepare("UPDATE ecritures_proposees SET statut = ?, resultat = ?, tranche_le = ? WHERE id = ?").run(
    statut,
    JSON.stringify(resultat),
    maintenantIso(),
    id
  );
}

/**
 * Tranche une écriture proposée puis, seulement si elle est née dans une
 * conversation (origine 'app'), enregistre le tool_result correspondant.
 * Une écriture MCP (conversation_id null) n'a pas de conversation où écrire
 * ce message — le tranchage s'arrête à la mise à jour de la ligne.
 */
export function trancherEtNotifier(
  db: Database.Database,
  ecriture: Pick<EcritureProposee, "id" | "conversation_id" | "tool_use_id">,
  statut: Exclude<StatutEcriture, "en_attente">,
  resultat: unknown,
  options: { estErreur?: boolean } = {}
): void {
  trancherEcriture(db, ecriture.id, statut, resultat);
  if (ecriture.conversation_id) {
    enregistrerMessage(db, ecriture.conversation_id, "tool_result", [
      {
        type: "tool_result",
        tool_use_id: ecriture.tool_use_id,
        content: JSON.stringify(resultat),
        ...(options.estErreur ? { is_error: true as const } : {}),
      },
    ]);
  }
}
