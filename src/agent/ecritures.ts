import type Database from "better-sqlite3";
import { maintenantIso, nouvelId } from "../db/util.js";

export type StatutEcriture = "en_attente" | "validee" | "rejetee" | "modifiee_validee";

export interface EcritureProposee {
  id: string;
  conversation_id: string;
  message_id: string;
  tool_use_id: string;
  outil: string;
  parametres: Record<string, unknown>;
  statut: StatutEcriture;
  resultat: unknown | null;
  tranche_le: string | null;
}

export function creerEcritureProposee(
  db: Database.Database,
  args: { conversationId: string; messageId: string; toolUseId: string; outil: string; parametres: unknown }
): EcritureProposee {
  const id = nouvelId();
  db.prepare(
    `INSERT INTO ecritures_proposees (id, conversation_id, message_id, tool_use_id, outil, parametres, statut)
     VALUES (?, ?, ?, ?, ?, ?, 'en_attente')`
  ).run(id, args.conversationId, args.messageId, args.toolUseId, args.outil, JSON.stringify(args.parametres));
  return {
    id,
    conversation_id: args.conversationId,
    message_id: args.messageId,
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
  conversation_id: string;
  message_id: string;
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
      "SELECT id, conversation_id, message_id, tool_use_id, outil, parametres, statut, resultat, tranche_le FROM ecritures_proposees WHERE id = ?"
    )
    .get(id) as
    | {
        id: string;
        conversation_id: string;
        message_id: string;
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
