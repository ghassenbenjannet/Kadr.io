import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import {
  envoyerMessageUtilisateur,
  reprendreApresDecision,
  MAX_TOURS_DEFAUT,
} from "../src/agent/boucle.js";
import { listerMessages } from "../src/agent/messages.js";
import type { ClientAnthropic, ParametresCreationMessage, ResultatMessageAnthropic } from "../src/agent/client.js";
import type { ConfigAgent } from "../src/agent/config.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const CONFIG: ConfigAgent = { apiKey: "sk-ant-test", model: "claude-test", maxTokens: 1024 };
const PROMPT = "Tu es l'assistant du Registre SI.";

function clientSimule(reponses: ResultatMessageAnthropic[]) {
  const appels: ParametresCreationMessage[] = [];
  let i = 0;
  const client: ClientAnthropic = {
    async creerMessage(params, onTexte) {
      appels.push(params);
      const reponse = reponses[Math.min(i, reponses.length - 1)]!;
      i++;
      if (onTexte) {
        for (const bloc of reponse.content) {
          if (bloc.type === "text") onTexte(bloc.text);
        }
      }
      return reponse;
    },
  };
  return { client, appels, nombreAppels: () => i };
}

const USAGE = { input_tokens: 10, output_tokens: 5 };

describe("agent/boucle — outil de lecture", () => {
  it("exécute l'outil, relance la boucle, et se termine sur la réponse finale", async () => {
    contexte = creerDbTemp();
    const { client, nombreAppels } = clientSimule([
      {
        content: [{ type: "tool_use", id: "tu1", name: "rechercher_journal", input: { question: "devis" } }],
        stop_reason: "tool_use",
        usage: USAGE,
      },
      { content: [{ type: "text", text: "Rien trouvé sur les devis." }], stop_reason: "end_turn", usage: USAGE },
    ]);

    const r = await envoyerMessageUtilisateur(contexte.db, client, CONFIG, PROMPT, {
      message: "Qu'a-t-on sur les devis ?",
    });

    expect(r.termine).toBe(true);
    expect(r.enAttenteValidation).toBe(false);
    expect(nombreAppels()).toBe(2);

    const messages = listerMessages(contexte.db, r.conversationId);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "tool_result", "assistant"]);
  });
});

describe("agent/boucle — outil d'écriture", () => {
  it("crée une ecriture_proposee et ARRÊTE la boucle sans exécuter l'outil", async () => {
    contexte = creerDbTemp();
    const { client, nombreAppels } = clientSimule([
      {
        content: [
          {
            type: "tool_use",
            id: "tu2",
            name: "enregistrer_demande",
            input: { demandeur: "Sophie", equipe: "CS", expression_brute: "voir les factures", type: "evolution" },
          },
        ],
        stop_reason: "tool_use",
        usage: USAGE,
      },
    ]);

    const r = await envoyerMessageUtilisateur(contexte.db, client, CONFIG, PROMPT, {
      message: "Sophie du CS veut voir les factures",
    });

    expect(r.enAttenteValidation).toBe(true);
    expect(r.termine).toBe(false);
    expect(r.ecritureId).toBeTruthy();
    expect(nombreAppels()).toBe(1);

    const demandes = contexte.db.prepare("SELECT COUNT(*) AS n FROM demandes").get() as { n: number };
    expect(demandes.n).toBe(0); // pas exécuté

    const ecriture = contexte.db
      .prepare("SELECT statut, outil FROM ecritures_proposees WHERE id = ?")
      .get(r.ecritureId) as { statut: string; outil: string };
    expect(ecriture.statut).toBe("en_attente");
    expect(ecriture.outil).toBe("enregistrer_demande");
  });

  it("après validation, exécute l'outil et reprend la boucle jusqu'à la fin", async () => {
    contexte = creerDbTemp();
    const { client: clientPause } = clientSimule([
      {
        content: [
          {
            type: "tool_use",
            id: "tu3",
            name: "enregistrer_demande",
            input: { demandeur: "Sophie", equipe: "CS", expression_brute: "voir les factures", type: "evolution" },
          },
        ],
        stop_reason: "tool_use",
        usage: USAGE,
      },
    ]);
    const pause = await envoyerMessageUtilisateur(contexte.db, clientPause, CONFIG, PROMPT, {
      message: "Sophie du CS veut voir les factures",
    });
    expect(pause.enAttenteValidation).toBe(true);

    const { client: clientReprise, nombreAppels } = clientSimule([
      { content: [{ type: "text", text: "C'est enregistré." }], stop_reason: "end_turn", usage: USAGE },
    ]);
    const r = await reprendreApresDecision(contexte.db, clientReprise, CONFIG, PROMPT, {
      ecritureId: pause.ecritureId!,
      decision: "valider",
    });

    expect(r.termine).toBe(true);
    expect(nombreAppels()).toBe(1);

    const demandes = contexte.db.prepare("SELECT demandeur FROM demandes").get() as { demandeur: string };
    expect(demandes.demandeur).toBe("Sophie");

    const ecriture = contexte.db
      .prepare("SELECT statut FROM ecritures_proposees WHERE id = ?")
      .get(pause.ecritureId) as { statut: string };
    expect(ecriture.statut).toBe("validee");
  });

  it("la correction des paramètres avant validation est bien celle enregistrée (modifiee_validee)", async () => {
    contexte = creerDbTemp();
    const { client: clientPause } = clientSimule([
      {
        content: [
          {
            type: "tool_use",
            id: "tu4",
            name: "enregistrer_demande",
            input: { demandeur: "Sophie", equipe: "CS", expression_brute: "voir les factures", type: "evolution" },
          },
        ],
        stop_reason: "tool_use",
        usage: USAGE,
      },
    ]);
    const pause = await envoyerMessageUtilisateur(contexte.db, clientPause, CONFIG, PROMPT, {
      message: "Sophie du CS veut voir les factures",
    });

    const { client: clientReprise } = clientSimule([
      { content: [{ type: "text", text: "C'est enregistré." }], stop_reason: "end_turn", usage: USAGE },
    ]);
    await reprendreApresDecision(contexte.db, clientReprise, CONFIG, PROMPT, {
      ecritureId: pause.ecritureId!,
      decision: "valider",
      parametres: { demandeur: "Sophie", equipe: "ADV", expression_brute: "voir les factures", type: "evolution" },
    });

    const demande = contexte.db.prepare("SELECT equipe FROM demandes").get() as { equipe: string };
    expect(demande.equipe).toBe("ADV"); // valeur corrigée, pas celle proposée (CS)

    const ecriture = contexte.db
      .prepare("SELECT statut FROM ecritures_proposees WHERE id = ?")
      .get(pause.ecritureId) as { statut: string };
    expect(ecriture.statut).toBe("modifiee_validee");
  });

  it("après rejet, un tool_result d'annulation est renvoyé au modèle et rien n'est écrit", async () => {
    contexte = creerDbTemp();
    const { client: clientPause } = clientSimule([
      {
        content: [
          {
            type: "tool_use",
            id: "tu5",
            name: "enregistrer_demande",
            input: { demandeur: "Sophie", equipe: "CS", expression_brute: "voir les factures", type: "evolution" },
          },
        ],
        stop_reason: "tool_use",
        usage: USAGE,
      },
    ]);
    const pause = await envoyerMessageUtilisateur(contexte.db, clientPause, CONFIG, PROMPT, {
      message: "Sophie du CS veut voir les factures",
    });

    const { client: clientReprise, appels } = clientSimule([
      { content: [{ type: "text", text: "D'accord, rien n'est enregistré." }], stop_reason: "end_turn", usage: USAGE },
    ]);
    const r = await reprendreApresDecision(contexte.db, clientReprise, CONFIG, PROMPT, {
      ecritureId: pause.ecritureId!,
      decision: "rejeter",
    });

    expect(r.termine).toBe(true);
    const demandes = contexte.db.prepare("SELECT COUNT(*) AS n FROM demandes").get() as { n: number };
    expect(demandes.n).toBe(0);

    const ecriture = contexte.db
      .prepare("SELECT statut FROM ecritures_proposees WHERE id = ?")
      .get(pause.ecritureId) as { statut: string };
    expect(ecriture.statut).toBe("rejetee");

    // Le tool_result d'annulation doit apparaître dans l'historique envoyé au modèle.
    const dernierAppel = appels[0]!;
    const messageToolResult = dernierAppel.messages.find(
      (m) => Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result")
    );
    expect(messageToolResult).toBeDefined();
    const bloc = (messageToolResult!.content as { type: string; content?: string }[]).find(
      (b) => b.type === "tool_result"
    );
    expect(bloc?.content).toContain("rejetée");
  });
});

describe("agent/boucle — garde-fou de tours", () => {
  it(`s'arrête après ${MAX_TOURS_DEFAUT} tours avec un message explicite plutôt qu'un ${MAX_TOURS_DEFAUT + 1}e appel`, async () => {
    contexte = creerDbTemp();
    const { client, nombreAppels } = clientSimule([
      {
        content: [{ type: "tool_use", id: "tu-boucle", name: "constats_ouverts", input: {} }],
        stop_reason: "tool_use",
        usage: USAGE,
      },
    ]);

    const r = await envoyerMessageUtilisateur(contexte.db, client, CONFIG, PROMPT, {
      message: "Boucle sans fin",
    });

    expect(nombreAppels()).toBe(MAX_TOURS_DEFAUT);
    expect(r.termine).toBe(true);
    expect(r.enAttenteValidation).toBe(false);

    const messages = listerMessages(contexte.db, r.conversationId);
    const dernier = messages[messages.length - 1]!;
    expect(dernier.role).toBe("assistant");
    expect(dernier.contenu[0]).toMatchObject({ type: "text" });
    expect((dernier.contenu[0] as { text: string }).text).toContain("Trop d'étapes enchaînées");
  });
});

describe("agent/messages — persistance fidèle", () => {
  it("une conversation rechargée restitue exactement les blocs, y compris tool_use/tool_result", async () => {
    contexte = creerDbTemp();
    const { client } = clientSimule([
      {
        content: [{ type: "tool_use", id: "tu6", name: "rechercher_journal", input: { question: "x" } }],
        stop_reason: "tool_use",
        usage: USAGE,
      },
      { content: [{ type: "text", text: "Fin." }], stop_reason: "end_turn", usage: USAGE },
    ]);
    const r = await envoyerMessageUtilisateur(contexte.db, client, CONFIG, PROMPT, { message: "question" });

    const messages = listerMessages(contexte.db, r.conversationId);
    expect(messages).toHaveLength(4);
    expect(messages[1]!.contenu[0]).toMatchObject({ type: "tool_use", id: "tu6", name: "rechercher_journal" });
    expect(messages[2]!.contenu[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu6" });
  });
});
