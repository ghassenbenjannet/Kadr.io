import { afterEach, describe, expect, it, vi } from "vitest";
import { clientCompatibleOpenAI } from "../src/agent/client.js";
import type { ParametresCreationMessage } from "../src/agent/client.js";

function fluxSSE(morceaux: string[]): ReadableStream<Uint8Array> {
  const encodeur = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= morceaux.length) {
        controller.close();
        return;
      }
      controller.enqueue(encodeur.encode(morceaux[i]!));
      i++;
    },
  });
}

function reponseSSE(morceaux: string[], statut = 200): Response {
  return new Response(fluxSSE(morceaux), { status: statut });
}

const PARAMS_BASE: ParametresCreationMessage = {
  model: "un-modele",
  maxTokens: 100,
  system: "Tu es un assistant.",
  messages: [{ role: "user", content: [{ type: "text", text: "Bonjour" }] }],
  tools: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clientCompatibleOpenAI — texte en streaming", () => {
  it("accumule le texte des deltas et le pousse via onTexte", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      reponseSSE([
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Bon" } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: "jour" } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 2 } })}\n\n`,
        `data: [DONE]\n\n`,
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = clientCompatibleOpenAI("https://exemple.test/v1", "cle-test");
    const deltas: string[] = [];
    const resultat = await client.creerMessage(PARAMS_BASE, (d) => deltas.push(d));

    expect(deltas).toEqual(["Bon", "jour"]);
    expect(resultat.content).toEqual([{ type: "text", text: "Bonjour" }]);
    expect(resultat.usage).toEqual({ input_tokens: 10, output_tokens: 2 });
    expect(resultat.stop_reason).toBe("stop");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://exemple.test/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer cle-test");
    const corps = JSON.parse(init.body);
    expect(corps.model).toBe("un-modele");
    expect(corps.stream).toBe(true);
    expect(corps.messages[0]).toEqual({ role: "system", content: "Tu es un assistant." });
    expect(corps.messages[1]).toEqual({ role: "user", content: "Bonjour" });
    expect(corps.tools).toBeUndefined();
  });

  it("recolle une ligne SSE coupée entre deux morceaux du flux", async () => {
    const ligne = `data: ${JSON.stringify({ choices: [{ delta: { content: "entier" } }] })}\n\n`;
    const milieu = Math.floor(ligne.length / 2);
    const fetchMock = vi.fn().mockResolvedValue(reponseSSE([ligne.slice(0, milieu), ligne.slice(milieu)]));
    vi.stubGlobal("fetch", fetchMock);

    const client = clientCompatibleOpenAI("https://exemple.test/v1", "cle-test");
    const resultat = await client.creerMessage(PARAMS_BASE);

    expect(resultat.content).toEqual([{ type: "text", text: "entier" }]);
  });
});

describe("clientCompatibleOpenAI — tool_calls en streaming", () => {
  it("accumule les fragments d'arguments par index et produit un bloc tool_use", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      reponseSSE([
        `data: ${JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "rechercher_journal", arguments: "" } }] } }],
        })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"entite":' } }] } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"incident"}' } }] } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 5, completion_tokens: 3 } })}\n\n`,
        `data: [DONE]\n\n`,
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = clientCompatibleOpenAI("https://exemple.test/v1", "cle-test");
    const resultat = await client.creerMessage({
      ...PARAMS_BASE,
      tools: [{ name: "rechercher_journal", description: "Recherche.", input_schema: { type: "object" } }],
    });

    expect(resultat.content).toEqual([
      { type: "tool_use", id: "call_1", name: "rechercher_journal", input: { entite: "incident" } },
    ]);
    expect(resultat.stop_reason).toBe("tool_calls");

    const corps = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(corps.tools).toEqual([
      { type: "function", function: { name: "rechercher_journal", description: "Recherche.", parameters: { type: "object" } } },
    ]);
    expect(corps.tool_choice).toBe("auto");
  });
});

describe("clientCompatibleOpenAI — traduction de l'historique", () => {
  it("convertit un tool_use assistant + tool_result utilisateur en assistant.tool_calls + message role=tool", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reponseSSE([`data: [DONE]\n\n`]));
    vi.stubGlobal("fetch", fetchMock);

    const client = clientCompatibleOpenAI("https://exemple.test/v1", "cle-test");
    await client.creerMessage({
      ...PARAMS_BASE,
      messages: [
        { role: "user", content: [{ type: "text", text: "Cherche les incidents" }] },
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "call_9", name: "rechercher_journal", input: { entite: "incident" } }],
        },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "call_9", content: JSON.stringify({ ok: true, resultats: [] }) }],
        },
      ],
    });

    const corps = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(corps.messages).toEqual([
      { role: "system", content: "Tu es un assistant." },
      { role: "user", content: "Cherche les incidents" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call_9", type: "function", function: { name: "rechercher_journal", arguments: '{"entite":"incident"}' } }],
      },
      { role: "tool", tool_call_id: "call_9", content: JSON.stringify({ ok: true, resultats: [] }) },
    ]);
  });
});

describe("clientCompatibleOpenAI — erreurs", () => {
  it("lève une erreur explicite quand la réponse HTTP n'est pas ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("clé invalide", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = clientCompatibleOpenAI("https://exemple.test/v1", "mauvaise-cle");
    await expect(client.creerMessage(PARAMS_BASE)).rejects.toThrow(/HTTP 401/);
  });
});
