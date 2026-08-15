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

export interface TableauDeBord {
  demandesEnAttente: number;
  constatsOuverts: number;
  changements7j: number;
  incidentsOuverts: number;
  journalSemaine: LigneJournal[];
  vigie: { controle: string; resume: string; consequence: string }[];
  resumeSemaine: { demandes: number; decisions: number; changements: number; incidentsClos: number };
}

export function recupererTableauDeBord(): Promise<{ ok: true } & TableauDeBord> {
  return requeteJson("/api/tableau-de-bord");
}

export interface ResultatControles {
  ok: true;
  nouveaux: number;
  resolus: number;
  ouverts: { controle: string; entite: string; resume: string; consequence: string }[];
}

export function lancerControlesDirect(perimetre?: string): Promise<ResultatControles> {
  return requeteJson("/api/controles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(perimetre ? { perimetre } : {}),
  });
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

const ROUTES_AUTH = new Set(["/api/login", "/api/logout", "/api/session"]);

let gestionnaireSessionExpiree: (() => void) | null = null;

/** Appelé quand une requête protégée reçoit un 401 : la session a expiré ou n'existe plus. */
export function surSessionExpiree(gestionnaire: () => void): void {
  gestionnaireSessionExpiree = gestionnaire;
}

async function requeteJson<T>(chemin: string, init?: RequestInit): Promise<T> {
  const res = await fetch(chemin, init);
  const corps = await res.json();
  if (!res.ok) {
    if (res.status === 401 && !ROUTES_AUTH.has(chemin)) gestionnaireSessionExpiree?.();
    throw new Error((corps as { erreur?: string }).erreur ?? `Erreur HTTP ${res.status}`);
  }
  return corps as T;
}

export interface EtatSession {
  ok: true;
  verrouille: boolean;
  authentifie: boolean;
}

export function verifierSession(): Promise<EtatSession> {
  return requeteJson("/api/session");
}

export function seConnecter(motDePasse: string): Promise<{ ok: true }> {
  return requeteJson("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ motDePasse }),
  });
}

export function seDeconnecter(): Promise<{ ok: true }> {
  return requeteJson("/api/logout", { method: "POST" });
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

export function recupererDemandes(filtres: { projetId?: string } = {}): Promise<{
  ok: true;
  demandes: DemandeComplete[];
}> {
  const q = filtres.projetId ? `?projet_id=${encodeURIComponent(filtres.projetId)}` : "";
  return requeteJson(`/api/demandes${q}`);
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
  description: string | null;
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

export interface DemandeLiee {
  id: string;
  demandeur: string;
  expression_brute: string;
  statut: string;
}

export interface ProjetDetailComplet {
  projet: { id: string; nom: string; statut: string; description: string | null };
  epics: EpicDetail[];
  suite_recette: PlanTestDetail[];
  documents: DocumentResume[];
  demandes_liees: DemandeLiee[];
}

export function recupererProjet(id: string): Promise<{ ok: true } & ProjetDetailComplet> {
  return requeteJson(`/api/projets/${id}`);
}

export function lierProjetDemandeDirect(
  projetId: string,
  demandeId: string
): Promise<{ ok: true; projet_id: string; demande_id: string }> {
  return requeteJson(`/api/projets/${projetId}/demandes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ demande_id: demandeId }),
  });
}

export function delierProjetDemandeDirect(projetId: string, demandeId: string): Promise<{ ok: true }> {
  return requeteJson(`/api/projets/${projetId}/demandes/${demandeId}`, { method: "DELETE" });
}

export function recupererEntiteJournal(
  entite: string,
  id: string
): Promise<{ ok: true; entite: string } & Record<string, unknown>> {
  return requeteJson(`/api/journal/${entite}/${id}`);
}

export function creerEntiteDirect(
  entite: string,
  champs: Record<string, unknown>
): Promise<{ ok: true; id: string; resume: string; avertissements?: string[] }> {
  return requeteJson(`/api/journal/${entite}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(champs),
  });
}

// Écriture directe (sans validation IA) sur les fiches objet — même principe
// que l'éditeur de documents : ces champs sont tapés par Ghassen lui-même.
export function mettreAJourEntiteDirect(
  entite: string,
  id: string,
  champs: Record<string, string>
): Promise<{ ok: true; id: string; resume: string; avertissements?: string[] }> {
  return requeteJson(`/api/journal/${entite}/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(champs),
  });
}

export function mettreAJourTicketDirect(
  id: string,
  champs: Record<string, string>
): Promise<{ ok: true; id: string; resume: string }> {
  return requeteJson(`/api/tickets/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(champs),
  });
}

export function mettreAJourProjetDirect(
  id: string,
  champs: Record<string, string>
): Promise<{ ok: true; id: string; resume: string }> {
  return requeteJson(`/api/projets/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(champs),
  });
}

export function mettreAJourEpicDirect(
  id: string,
  champs: Record<string, string>
): Promise<{ ok: true; id: string; resume: string }> {
  return requeteJson(`/api/epics/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(champs),
  });
}

export function creerProjetDirect(champs: {
  nom: string;
  description?: string;
}): Promise<{ ok: true; id: string; resume: string }> {
  return requeteJson("/api/projets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(champs),
  });
}

export function creerEpicDirect(champs: {
  projet: string;
  nom: string;
  description?: string;
}): Promise<{ ok: true; id: string; resume: string; avertissements?: string[] }> {
  return requeteJson("/api/epics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(champs),
  });
}

export function creerTicketDirect(champs: {
  projet: string;
  epic: string;
  titre: string;
  type: string;
  description?: string;
}): Promise<{ ok: true; id: string; resume: string; avertissements?: string[] }> {
  return requeteJson("/api/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(champs),
  });
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

export interface TicketAvecContexte {
  id: string;
  titre: string;
  type: string;
  statut: string;
  cree_le: string;
  epic_id: string;
  epic_nom: string;
  projet_id: string;
  projet_nom: string;
}

/** Tous les tickets, tous projets confondus (filtrables) — alimente le kanban configurable. */
export function recupererTickets(
  filtres: { projetId?: string; epicId?: string } = {}
): Promise<{ ok: true; tickets: TicketAvecContexte[] }> {
  const params = new URLSearchParams();
  if (filtres.projetId) params.set("projet_id", filtres.projetId);
  if (filtres.epicId) params.set("epic_id", filtres.epicId);
  const q = params.toString();
  return requeteJson(`/api/tickets${q ? `?${q}` : ""}`);
}

// --- Kanban configurable : vues sauvegardées --------------------------------

export type EntiteKanban = "demande" | "ticket";

export interface FiltresKanban {
  projet_id?: string;
  epic_id?: string;
}

export interface VueKanban {
  id: string;
  cree_le: string;
  nom: string;
  entite: EntiteKanban;
  filtres: FiltresKanban;
  maj_le: string;
}

export function recupererVuesKanban(): Promise<{ ok: true; vues: VueKanban[] }> {
  return requeteJson("/api/vues-kanban");
}

/** Enregistrer sous un nom déjà utilisé remplace la vue plutôt que de la dupliquer. */
export function sauvegarderVueKanbanDirect(args: {
  nom: string;
  entite: EntiteKanban;
  filtres: FiltresKanban;
}): Promise<{ ok: true; id: string }> {
  return requeteJson("/api/vues-kanban", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}

export function supprimerVueKanbanDirect(id: string): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/vues-kanban/${id}`, { method: "DELETE" });
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
  // Tout est capturé ici, y compris les échecs de fetch() lui-même (réseau
  // coupé, endpoint injoignable) et les erreurs de lecture du flux en cours
  // de route : sans ce filet, une requête qui échoue avant même de recevoir
  // une réponse HTTP plante silencieusement — ni erreur affichée, ni sortie
  // de l'état "en cours" côté Conversation.tsx.
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      if (res.status === 401) gestionnaireSessionExpiree?.();
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
  } catch (e) {
    gestionnaires.onErreur?.(
      e instanceof Error ? `Requête échouée : ${e.message}` : "Requête échouée (erreur réseau)."
    );
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
  projet: { id: string; nom: string } | null;
}

export function recupererDocument(id: string): Promise<{ ok: true } & DocumentComplet> {
  return requeteJson(`/api/documents/${id}`);
}

export function recupererConnaissances(): Promise<{ ok: true; documents: DocumentResume[] }> {
  return requeteJson("/api/connaissances");
}

// Écriture directe (pas via l'agent, pas de carte de validation) : c'est
// l'éditeur en page, voir la note dans src/server/app.ts.
export function creerDocumentDirect(args: {
  projet?: string;
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

// --- Suppression directe --------------------------------------------------

export function supprimerEntiteDirect(entite: string, id: string): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/journal/${entite}/${id}`, { method: "DELETE" });
}

export function supprimerTicketDirect(id: string): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/tickets/${id}`, { method: "DELETE" });
}

export function supprimerEpicDirect(id: string): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/epics/${id}`, { method: "DELETE" });
}

export function supprimerProjetDirect(id: string): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/projets/${id}`, { method: "DELETE" });
}

export function supprimerDocumentDirect(id: string): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/documents/${id}`, { method: "DELETE" });
}

// --- Plans de test ---------------------------------------------------------

export interface PlanTestResume {
  id: string;
  nom: string;
  description: string | null;
  cree_le: string;
  cas_total: number;
  cas_reussis: number;
  cas_echoues: number;
}

export function recupererPlansTest(): Promise<{ ok: true; plans: PlanTestResume[] }> {
  return requeteJson("/api/plans-test");
}

export interface PlanTestComplet {
  id: string;
  nom: string;
  description: string | null;
  cree_le: string;
  cas: CasTestDetail[];
  tickets: { id: string; titre: string; epic_nom: string; projet_id: string; projet_nom: string }[];
}

export function recupererPlanTest(id: string): Promise<{ ok: true } & PlanTestComplet> {
  return requeteJson(`/api/plans-test/${id}`);
}

export function creerPlanTestDirect(args: {
  nom: string;
  description?: string;
  cas: { etape: string; resultat_attendu: string }[];
}): Promise<{ ok: true; id: string; resume: string; cas_ids: string[] }> {
  return requeteJson("/api/plans-test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}

export function supprimerPlanTestDirect(id: string): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/plans-test/${id}`, { method: "DELETE" });
}

export function ajouterCasTestDirect(
  planTestId: string,
  args: { etape: string; resultat_attendu: string }
): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/plans-test/${planTestId}/cas`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}

export function executerCasTestDirect(
  id: string,
  args: { statut: "a_faire" | "reussi" | "echoue"; executee_par?: string }
): Promise<{ ok: true; id: string; resume: string }> {
  return requeteJson(`/api/cas-test/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}

export function supprimerCasTestDirect(id: string): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/cas-test/${id}`, { method: "DELETE" });
}

export function lierPlanTestDirect(
  ticketId: string,
  planTestId: string
): Promise<{ ok: true; ticket_id: string; plan_test_id: string }> {
  return requeteJson(`/api/tickets/${ticketId}/plans-test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan_test_id: planTestId }),
  });
}

export function delierPlanTestDirect(ticketId: string, planTestId: string): Promise<{ ok: true }> {
  return requeteJson(`/api/tickets/${ticketId}/plans-test/${planTestId}`, { method: "DELETE" });
}

// --- Agents (modes de travail spécialisés) ---------------------------------

export interface AgentMode {
  id: string;
  cree_le: string;
  cle: string;
  titre: string;
  description: string | null;
  contenu: string;
  maj_le: string;
}

export function recupererAgents(): Promise<{ ok: true; agents: AgentMode[] }> {
  return requeteJson("/api/agents");
}

export function recupererAgent(id: string): Promise<{ ok: true } & AgentMode> {
  return requeteJson(`/api/agents/${id}`);
}

export function creerAgentDirect(args: {
  cle: string;
  titre: string;
  description?: string;
  contenu: string;
}): Promise<{ ok: true; id: string }> {
  return requeteJson("/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}

export function mettreAJourAgentDirect(
  id: string,
  args: { cle?: string; titre?: string; description?: string; contenu?: string }
): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/agents/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
}

export function supprimerAgentDirect(id: string): Promise<{ ok: true; id: string }> {
  return requeteJson(`/api/agents/${id}`, { method: "DELETE" });
}
