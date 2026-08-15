// Client Anthropic — interface minimale et injectable pour agent/boucle.ts.
// Aucun appel réel dans les tests (client simulé) ; clientAnthropicReel()
// n'est instancié que par le serveur HTTP, avec une clé API réelle.

export type BlocContenu =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface MessageParamAnthropic {
  role: "user" | "assistant";
  content: BlocContenu[] | string;
}

export interface UsageAnthropic {
  input_tokens: number;
  output_tokens: number;
}

export interface ResultatMessageAnthropic {
  content: BlocContenu[];
  stop_reason: string | null;
  usage: UsageAnthropic;
}

export interface OutilAnthropicPourRequete {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ParametresCreationMessage {
  model: string;
  maxTokens: number;
  system: string;
  messages: MessageParamAnthropic[];
  tools: OutilAnthropicPourRequete[];
}

export type GestionnaireTexte = (delta: string) => void;

export interface ClientAnthropic {
  creerMessage(params: ParametresCreationMessage, onTexte?: GestionnaireTexte): Promise<ResultatMessageAnthropic>;
}

/**
 * Implémentation réelle, sur le SDK officiel. Utilise le streaming pour
 * pousser le texte au fil de l'eau (onTexte) tout en récupérant le message
 * complet (content, usage, stop_reason) à la fin — c'est ce message complet
 * que la boucle persiste et analyse pour détecter un tool_use.
 */
export function clientAnthropicReel(apiKey: string): ClientAnthropic {
  return {
    async creerMessage(params, onTexte) {
      // Import dynamique : évite de charger le SDK (et d'exiger une clé) dans
      // les tests, qui n'utilisent jamais cette fonction.
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });

      const flux = client.messages.stream({
        model: params.model,
        max_tokens: params.maxTokens,
        system: params.system,
        messages: params.messages as never,
        tools: params.tools as never,
        tool_choice: { type: "auto", disable_parallel_tool_use: true } as never,
      });

      if (onTexte) {
        flux.on("text", (delta) => onTexte(delta));
      }

      const messageFinal = await flux.finalMessage();
      return {
        content: messageFinal.content as BlocContenu[],
        stop_reason: messageFinal.stop_reason,
        usage: { input_tokens: messageFinal.usage.input_tokens, output_tokens: messageFinal.usage.output_tokens },
      };
    },
  };
}

// --- Fournisseur compatible OpenAI (NVIDIA NIM et autres endpoints "chat completions") ---
//
// L'interface ClientAnthropic ci-dessus n'a rien de spécifique à Anthropic
// dans sa forme (creerMessage(params, onTexte) -> {content, stop_reason,
// usage}) : c'est déjà la frontière d'abstraction dont a besoin
// agent/boucle.ts, qui ignore stop_reason et ne regarde que content/usage.
// Cette implémentation traduit dans les deux sens vers l'API "chat
// completions" (OpenAI et compatibles : NVIDIA NIM, vLLM, Together, Groq…) :
// system + tool_use/tool_result repliés en messages system/user/assistant/tool,
// et streaming SSE avec accumulation des fragments de tool_calls par index.

interface MessageOpenAICompat {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

function versMessagesOpenAI(system: string, messages: MessageParamAnthropic[]): MessageOpenAICompat[] {
  const sortie: MessageOpenAICompat[] = [{ role: "system", content: system }];

  for (const m of messages) {
    const blocs: BlocContenu[] = Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }];
    const texte: string[] = [];
    const toolCalls: MessageOpenAICompat["tool_calls"] = [];
    const toolResultats: { tool_call_id: string; content: string }[] = [];

    for (const b of blocs) {
      if (b.type === "text") {
        texte.push(b.text);
      } else if (b.type === "tool_use") {
        toolCalls!.push({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } });
      } else if (b.type === "tool_result") {
        toolResultats.push({
          tool_call_id: b.tool_use_id,
          content: typeof b.content === "string" ? b.content : JSON.stringify(b.content),
        });
      }
    }

    if (toolCalls!.length > 0) {
      sortie.push({ role: "assistant", content: texte.length > 0 ? texte.join("\n") : null, tool_calls: toolCalls });
    } else if (texte.length > 0) {
      sortie.push({ role: m.role, content: texte.join("\n") });
    }
    for (const tr of toolResultats) {
      sortie.push({ role: "tool", tool_call_id: tr.tool_call_id, content: tr.content });
    }
  }

  return sortie;
}

interface ToolCallAccumule {
  id: string;
  name: string;
  arguments: string;
}

/** Parse un flux SSE "chat completions" et applique chaque chunk via `surChunk`. */
async function lireFluxSSE(corps: ReadableStream<Uint8Array>, surChunk: (chunk: unknown) => void): Promise<void> {
  const lecteur = corps.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";

  while (true) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });

    let indexLigne: number;
    while ((indexLigne = tampon.indexOf("\n")) >= 0) {
      const ligne = tampon.slice(0, indexLigne).trim();
      tampon = tampon.slice(indexLigne + 1);
      if (!ligne.startsWith("data:")) continue;
      const data = ligne.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        surChunk(JSON.parse(data));
      } catch {
        // Chunk malformé (parfois un commentaire keep-alive) : ignoré.
      }
    }
  }
}

/**
 * Fournisseur générique : n'importe quel endpoint exposant l'API
 * "chat completions" compatible OpenAI (base URL + clé + nom de modèle
 * fournis par la config — voir REGISTRE_PROVIDER/REGISTRE_BASE_URL).
 */
export function clientCompatibleOpenAI(baseUrl: string, apiKey: string): ClientAnthropic {
  return {
    async creerMessage(params, onTexte) {
      const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
      const messages = versMessagesOpenAI(params.system, params.messages);
      const tools = params.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      }));

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: params.model,
          max_tokens: params.maxTokens,
          messages,
          ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
          stream: true,
          stream_options: { include_usage: true },
        }),
      });

      if (!res.ok || !res.body) {
        const corpsErreur = await res.text().catch(() => "");
        throw new Error(`Appel au modèle échoué (HTTP ${res.status}) : ${corpsErreur.slice(0, 500)}`);
      }

      let texteComplet = "";
      const toolCallsParIndex = new Map<number, ToolCallAccumule>();
      let usage = { input_tokens: 0, output_tokens: 0 };
      let finishReason: string | null = null;

      await lireFluxSSE(res.body, (chunkBrut) => {
        const chunk = chunkBrut as {
          usage?: { prompt_tokens?: number; completion_tokens?: number };
          choices?: {
            finish_reason?: string | null;
            delta?: {
              content?: string;
              tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
            };
          }[];
        };

        if (chunk.usage) {
          usage = {
            input_tokens: chunk.usage.prompt_tokens ?? usage.input_tokens,
            output_tokens: chunk.usage.completion_tokens ?? usage.output_tokens,
          };
        }

        const choix = chunk.choices?.[0];
        if (!choix) return;
        if (choix.finish_reason) finishReason = choix.finish_reason;

        const delta = choix.delta ?? {};
        if (typeof delta.content === "string" && delta.content.length > 0) {
          texteComplet += delta.content;
          onTexte?.(delta.content);
        }

        for (const tc of delta.tool_calls ?? []) {
          const index = tc.index ?? 0;
          const existant = toolCallsParIndex.get(index) ?? { id: "", name: "", arguments: "" };
          if (tc.id) existant.id = tc.id;
          if (tc.function?.name) existant.name = tc.function.name;
          if (tc.function?.arguments) existant.arguments += tc.function.arguments;
          toolCallsParIndex.set(index, existant);
        }
      });

      const content: BlocContenu[] = [];
      if (texteComplet) content.push({ type: "text", text: texteComplet });
      for (const tc of toolCallsParIndex.values()) {
        let input: unknown = {};
        try {
          input = tc.arguments ? JSON.parse(tc.arguments) : {};
        } catch {
          input = {};
        }
        content.push({ type: "tool_use", id: tc.id || crypto.randomUUID(), name: tc.name, input });
      }

      return { content, stop_reason: finishReason, usage };
    },
  };
}
