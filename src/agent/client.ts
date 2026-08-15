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
