// Client HTTP minimal vers l'API du serveur (§6). Pas de librairie de
// requêtes : fetch suffit pour la taille de cette application.

export interface LigneJournal {
  entite: string;
  id: string;
  date: string;
  resume: string;
}

export interface ConstatOuvert {
  controle: string;
  entite: string;
  resume: string;
  consequence: string;
  depuis: string;
}

export interface ConversationResume {
  id: string;
  titre: string | null;
  cree_le: string;
  maj_le: string;
}

export type BlocContenu =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface MessageConversation {
  id: string;
  conversation_id: string;
  cree_le: string;
  role: "user" | "assistant" | "tool_result";
  contenu: BlocContenu[];
}

export interface EcritureProposee {
  id: string;
  conversation_id: string;
  message_id: string;
  tool_use_id: string;
  outil: string;
  parametres: Record<string, unknown>;
  statut: "en_attente" | "validee" | "rejetee" | "modifiee_validee";
  resultat: unknown | null;
}

async function requeteJson<T>(chemin: string, init?: RequestInit): Promise<T> {
  const res = await fetch(chemin, init);
  const corps = await res.json();
  if (!res.ok) {
    throw new Error((corps as { erreur?: string }).erreur ?? `Erreur HTTP ${res.status}`);
  }
  return corps as T;
}

export function recupererJournal(filtres: {
  entite?: string;
  depuis?: string;
  jusqu_a?: string;
}): Promise<{ ok: true; journal: LigneJournal[] }> {
  const params = new URLSearchParams();
  if (filtres.entite) params.set("entite", filtres.entite);
  if (filtres.depuis) params.set("depuis", filtres.depuis);
  if (filtres.jusqu_a) params.set("jusqu_a", filtres.jusqu_a);
  const q = params.toString();
  return requeteJson(`/api/journal${q ? `?${q}` : ""}`);
}

export function recupererConstats(): Promise<{ ok: true; constats: ConstatOuvert[] }> {
  return requeteJson("/api/constats");
}

export async function recupererRapportHebdo(semaine?: string): Promise<string> {
  const q = semaine ? `?semaine=${encodeURIComponent(semaine)}` : "";
  const res = await fetch(`/api/rapport/hebdo${q}`);
  if (!res.ok) {
    const corps = await res.json().catch(() => ({}));
    throw new Error((corps as { erreur?: string }).erreur ?? `Erreur HTTP ${res.status}`);
  }
  return res.text();
}

export function recupererConversations(): Promise<{ ok: true; conversations: ConversationResume[] }> {
  return requeteJson("/api/conversations");
}

export function recupererConversation(
  id: string
): Promise<{ ok: true; conversation: ConversationResume; messages: MessageConversation[] }> {
  return requeteJson(`/api/conversations/${id}`);
}

export interface ResultatChat {
  conversationId: string;
  termine: boolean;
  enAttenteValidation: boolean;
  ecritureId?: string;
}

export interface EvenementFluxChat {
  onTexte?: (delta: string) => void;
  onOutilLecture?: (info: { outil: string; phase: "debut" | "fin"; resume?: string }) => void;
  onValidationRequise?: (ecriture: EcritureProposee) => void;
  onFin?: (resultat: ResultatChat) => void;
  onErreur?: (message: string) => void;
}

/** POST /api/chat, lit le flux SSE et distribue les événements via des callbacks. */
export async function envoyerMessage(
  args: { conversationId?: string; message: string },
  gestionnaires: EvenementFluxChat
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    const corps = await res.json().catch(() => ({}));
    gestionnaires.onErreur?.((corps as { erreur?: string }).erreur ?? `Erreur HTTP ${res.status}`);
    return;
  }
  if (!res.body) {
    gestionnaires.onErreur?.("Réponse sans flux.");
    return;
  }

  const lecteur = res.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";

  while (true) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });

    let indexSeparateur: number;
    while ((indexSeparateur = tampon.indexOf("\n\n")) >= 0) {
      const bloc = tampon.slice(0, indexSeparateur);
      tampon = tampon.slice(indexSeparateur + 2);
      distribuerEvenementSSE(bloc, gestionnaires);
    }
  }
}

function distribuerEvenementSSE(bloc: string, gestionnaires: EvenementFluxChat): void {
  let event = "message";
  let data = "";
  for (const ligne of bloc.split("\n")) {
    if (ligne.startsWith("event:")) event = ligne.slice(6).trim();
    if (ligne.startsWith("data:")) data += ligne.slice(5).trim();
  }
  if (!data) return;

  switch (event) {
    case "texte":
      gestionnaires.onTexte?.(data);
      break;
    case "outil_lecture":
      gestionnaires.onOutilLecture?.(JSON.parse(data));
      break;
    case "validation_requise":
      gestionnaires.onValidationRequise?.(JSON.parse(data));
      break;
    case "fin":
      gestionnaires.onFin?.(JSON.parse(data));
      break;
    case "erreur":
      gestionnaires.onErreur?.(JSON.parse(data).erreur ?? "Erreur inconnue.");
      break;
  }
}

export interface ResultatConfirm extends ResultatChat {
  texteAssistant?: string;
  /** Présent si la reprise enchaîne directement sur une nouvelle écriture proposée. */
  ecriture?: EcritureProposee;
}

export function confirmerEcriture(args: {
  ecritureId: string;
  action: "valider" | "rejeter";
  parametres?: unknown;
}): Promise<ResultatConfirm> {
  return requeteJson("/api/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}
