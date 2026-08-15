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

export interface DemandeComplete {
  id: string;
  cree_le: string;
  demandeur: string;
  equipe: string;
  expression_brute: string;
  reformulation: string | null;
  type: string;
  priorite: string | null;
  priorite_arbitree_par: string | null;
  statut: string;
  maj_le: string;
}

export function recupererDemandes(): Promise<{ ok: true; demandes: DemandeComplete[] }> {
  return requeteJson("/api/demandes");
}

export interface ProjetResume {
  id: string;
  nom: string;
  statut: string;
  epics: number;
  tickets_total: number;
  tickets_ouverts: number;
}

export function recupererProjets(): Promise<{ ok: true; projets: ProjetResume[] }> {
  return requeteJson("/api/projets");
}

export interface TicketDetail {
  id: string;
  titre: string;
  type: string;
  statut: string;
}

export interface EpicDetail {
  id: string;
  nom: string;
  statut: string;
  tickets: TicketDetail[];
}

export interface CasTestDetail {
  id: string;
  etape: string;
  resultat_attendu: string;
  statut: string;
  executee_par: string | null;
  executee_le: string | null;
}

export interface PlanTestDetail {
  id: string;
  nom: string;
  cas: CasTestDetail[];
}

export interface DocumentResume {
  id: string;
  titre: string;
  type: string;
  maj_le: string;
}

export interface ProjetDetailComplet {
  projet: { id: string; nom: string; statut: string; description: string | null };
  epics: EpicDetail[];
  suite_recette: PlanTestDetail[];
  documents: DocumentResume[];
}

export function recupererProjet(id: string): Promise<{ ok: true } & ProjetDetailComplet> {
  return requeteJson(`/api/projets/${id}`);
}

export function recupererEntiteJournal(
  entite: string,
  id: string
): Promise<{ ok: true; entite: string } & Record<string, unknown>> {
  return requeteJson(`/api/journal/${entite}/${id}`);
}

export interface TicketDetailComplet {
  id: string;
  titre: string;
  description: string | null;
  type: string;
  statut: string;
  cree_le: string;
  epic: { id: string; nom: string; projet: { id: string; nom: string } };
  plans_test: PlanTestDetail[];
}

export function recupererTicket(id: string): Promise<{ ok: true } & TicketDetailComplet> {
  return requeteJson(`/api/tickets/${id}`);
}

export interface ChampAvecContexte {
  id: string;
  nom: string;
  module: string;
  systeme: string;
  sourceDeVerite: string | null;
  editable: number | null;
}

export type DroitCellule = "editable" | "visible" | "masque" | "non_declare";

export function recupererHabilitations(moduleFiltre?: string): Promise<{
  ok: true;
  champs: ChampAvecContexte[];
  profils: string[];
  modules: string[];
  cellules: Record<string, DroitCellule>;
}> {
  const q = moduleFiltre ? `?module=${encodeURIComponent(moduleFiltre)}` : "";
  return requeteJson(`/api/habilitations${q}`);
}

export interface GroupeSourceDeVerite {
  source: string;
  champs: (ChampAvecContexte & { contredit: boolean })[];
}

export function recupererChamps(): Promise<{ ok: true; groupes: GroupeSourceDeVerite[] }> {
  return requeteJson("/api/champs");
}

export interface IntegrationAvecConstats {
  id: string;
  nom: string;
  source: string;
  cible: string;
  constatsOuverts: number;
}

export function recupererIntegrations(): Promise<{ ok: true; integrations: IntegrationAvecConstats[] }> {
  return requeteJson("/api/integrations");
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

export interface DocumentComplet {
  id: string;
  titre: string;
  type: string;
  contenu: string;
  cree_le: string;
  maj_le: string;
  projet: { id: string; nom: string };
}

export function recupererDocument(id: string): Promise<{ ok: true } & DocumentComplet> {
  return requeteJson(`/api/documents/${id}`);
}

// Écriture directe (pas via l'agent, pas de carte de validation) : c'est
// l'éditeur en page, voir la note dans src/server/app.ts.
export function creerDocumentDirect(args: {
  projet: string;
  type: string;
  titre: string;
  contenu?: string;
}): Promise<{ ok: true; id: string; resume: string }> {
  return requeteJson("/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}

export function mettreAJourDocumentDirect(
  id: string,
  args: { titre?: string; contenu?: string }
): Promise<{ ok: true; id: string; resume: string }> {
  return requeteJson(`/api/documents/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}
