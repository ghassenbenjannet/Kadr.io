import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerConversation, enregistrerMessage } from "../src/agent/messages.js";
import { creerEcritureProposee, trancherEtNotifier, trouverEcriture } from "../src/agent/ecritures.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("agent/ecritures — trancherEtNotifier", () => {
  it("écriture app (conversation_id non nul) : tranche et insère le tool_result (compat app)", () => {
    contexte = creerDbTemp();
    const conversationId = creerConversation(contexte.db, "Titre");
    const messageId = enregistrerMessage(contexte.db, conversationId, "assistant", [
      { type: "tool_use", id: "tu1", name: "enregistrer_demande", input: {} },
    ]);
    const ecriture = creerEcritureProposee(contexte.db, {
      conversationId,
      messageId,
      toolUseId: "tu1",
      outil: "enregistrer_demande",
      parametres: {},
    });

    trancherEtNotifier(contexte.db, ecriture, "validee", { ok: true });

    const relue = trouverEcriture(contexte.db, ecriture.id)!;
    expect(relue.statut).toBe("validee");

    const messages = contexte.db
      .prepare("SELECT role FROM messages WHERE conversation_id = ? ORDER BY rowid")
      .all(conversationId) as { role: string }[];
    expect(messages.map((m) => m.role)).toEqual(["assistant", "tool_result"]);
  });

  it("écriture MCP (conversation_id nul) : tranche mais n'insère aucune ligne dans messages", () => {
    contexte = creerDbTemp();
    const ecriture = creerEcritureProposee(contexte.db, {
      origine: "mcp",
      toolUseId: "mcp-tu2",
      outil: "enregistrer_changement",
      parametres: {},
    });
    expect(ecriture.conversation_id).toBeNull();
    expect(ecriture.origine).toBe("mcp");

    trancherEtNotifier(contexte.db, ecriture, "validee", { ok: true });

    const relue = trouverEcriture(contexte.db, ecriture.id)!;
    expect(relue.statut).toBe("validee");

    const nbMessages = contexte.db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number };
    expect(nbMessages.n).toBe(0);
  });

  it("écriture MCP rejetée : statut rejetee, aucune ligne dans messages", () => {
    contexte = creerDbTemp();
    const ecriture = creerEcritureProposee(contexte.db, {
      origine: "mcp",
      toolUseId: "mcp-tu3",
      outil: "enregistrer_changement",
      parametres: {},
    });

    trancherEtNotifier(
      contexte.db,
      ecriture,
      "rejetee",
      { ok: false, erreur: "Proposition rejetée par l'opérateur." },
      { estErreur: true }
    );

    const relue = trouverEcriture(contexte.db, ecriture.id)!;
    expect(relue.statut).toBe("rejetee");

    const nbMessages = contexte.db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number };
    expect(nbMessages.n).toBe(0);
  });
});
