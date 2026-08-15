import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";
import { lancerControles } from "../src/tools/lancer-controles.js";
import { enregistrerChangement } from "../src/tools/enregistrer-changement.js";
import { decrireSysteme } from "../src/tools/decrire-systeme.js";
import { decrireModule } from "../src/tools/decrire-module.js";
import { decrireChamp } from "../src/tools/decrire-champ.js";
import { decrireHabilitation } from "../src/tools/decrire-habilitation.js";
import { decrireIntegration } from "../src/tools/decrire-integration.js";
import { creerTicket } from "../src/tools/creer-ticket.js";
import { creerPlanTest } from "../src/tools/creer-plan-test.js";
import { executerCasTest } from "../src/tools/executer-cas-test.js";
import { lierTicketPlanTest } from "../src/tools/lier-ticket-plan-test.js";
import type { ClientAnthropic, ParametresCreationMessage, ResultatMessageAnthropic } from "../src/agent/client.js";
import type { ConfigAgent } from "../src/agent/config.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const PROMPT = "Tu es l'assistant du Registre SI.";
const USAGE = { input_tokens: 1, output_tokens: 1 };

function clientSimule(reponses: ResultatMessageAnthropic[]) {
  let i = 0;
  const appels: ParametresCreationMessage[] = [];
  const client: ClientAnthropic = {
    async creerMessage(params, onTexte) {
      appels.push(params);
      const reponse = reponses[Math.min(i, reponses.length - 1)]!;
      i++;
      if (onTexte) for (const b of reponse.content) if (b.type === "text") onTexte(b.text);
      return reponse;
    },
  };
  return { client, appels };
}

function parseSSE(corps: string): { event: string; data: string }[] {
  const evenements: { event: string; data: string }[] = [];
  for (const bloc of corps.split("\n\n")) {
    if (!bloc.trim()) continue;
    const lignes = bloc.split("\n");
    let event = "message";
    let data = "";
    for (const ligne of lignes) {
      if (ligne.startsWith("event:")) event = ligne.slice(6).trim();
      if (ligne.startsWith("data:")) data = ligne.slice(5).trim();
    }
    evenements.push({ event, data });
  }
  return evenements;
}

describe("routes de lecture", () => {
  it("GET /api/journal liste les entrées du journal", async () => {
    contexte = creerDbTemp();
    enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "voir les factures",
      type: "evolution",
    });
    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
    const res = await app.request("/api/journal");
    expect(res.status).toBe(200);
    const corps = (await res.json()) as any;
    expect(corps.ok).toBe(true);
    expect(corps.journal.length).toBeGreaterThan(0);
  });

  it("GET /api/constats liste les constats ouverts", async () => {
    contexte = creerDbTemp();
    enregistrerChangement(contexte.db, { description: "x", perimetre: "y", type: "autre" });
    lancerControles(contexte.db, { perimetre: "tous" });
    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
    const res = await app.request("/api/constats");
    const corps = (await res.json()) as any;
    expect(corps.ok).toBe(true);
    expect(corps.constats.length).toBeGreaterThan(0);
  });

  it("GET /api/rapport/hebdo renvoie du markdown", async () => {
    contexte = creerDbTemp();
    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
    const res = await app.request("/api/rapport/hebdo");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/markdown");
    const texte = await res.text();
    expect(texte).toContain("# Revue SI");
  });

  it("GET /api/habilitations retourne la matrice, filtrable par module", async () => {
    contexte = creerDbTemp();
    decrireSysteme(contexte.db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(contexte.db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(contexte.db, { systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client" });
    decrireHabilitation(contexte.db, {
      profil: "ADV",
      systeme: "Zoho CRM",
      module: "Comptes",
      champ: "Statut_Client",
      visible: true,
      editable: false,
    });
    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });

    const complet = (await (await app.request("/api/habilitations")).json()) as any;
    expect(complet.ok).toBe(true);
    expect(complet.champs.length).toBe(1);
    expect(complet.profils).toEqual(["ADV"]);
    expect(Object.values(complet.cellules)).toEqual(["visible"]);

    const filtre = (await (await app.request("/api/habilitations?module=Autre")).json()) as any;
    expect(filtre.champs.length).toBe(0);
  });

  it("GET /api/champs groupe par source de vérité", async () => {
    contexte = creerDbTemp();
    decrireSysteme(contexte.db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(contexte.db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(contexte.db, {
      systeme: "Zoho CRM",
      module: "Comptes",
      nom: "Statut_Client",
      source_de_verite: "App Devis",
    });
    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
    const corps = (await (await app.request("/api/champs")).json()) as any;
    expect(corps.ok).toBe(true);
    expect(corps.groupes.some((g: any) => g.source === "App Devis")).toBe(true);
  });

  it("GET /api/integrations retourne les flux avec leurs constats ouverts", async () => {
    contexte = creerDbTemp();
    decrireSysteme(contexte.db, { nom: "Zoho CRM", role: "CRM" });
    decrireSysteme(contexte.db, { nom: "App Devis", role: "Devis" });
    decrireIntegration(contexte.db, { nom: "Devis -> CRM", source: "App Devis", cible: "Zoho CRM" });
    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
    const corps = (await (await app.request("/api/integrations")).json()) as any;
    expect(corps.ok).toBe(true);
    expect(corps.integrations.length).toBe(1);
    expect(corps.integrations[0].nom).toBe("Devis -> CRM");
  });

  it("GET /api/demandes retourne les demandes complètes, avec statut", async () => {
    contexte = creerDbTemp();
    enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "voir les factures",
      type: "evolution",
    });
    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
    const res = await app.request("/api/demandes");
    const corps = (await res.json()) as any;
    expect(corps.ok).toBe(true);
    expect(corps.demandes.length).toBe(1);
    expect(corps.demandes[0].statut).toBe("recue");
    expect(corps.demandes[0].demandeur).toBe("Sophie");
  });

  it("GET /api/projets puis /api/projets/:id avec la suite de recette", async () => {
    contexte = creerDbTemp();
    const ticket = creerTicket(contexte.db, {
      projet: "CS-Vue360",
      epic: "Build",
      titre: "Développer export",
      type: "task",
    });
    expect(ticket.ok).toBe(true);
    if (!ticket.ok) return;
    const plan = creerPlanTest(contexte.db, {
      nom: "Recette export",
      cas: [{ etape: "Exporter", resultat_attendu: "CSV" }],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    lierTicketPlanTest(contexte.db, { ticket_id: ticket.id, plan_test: "Recette export" });
    executerCasTest(contexte.db, { id: plan.cas_ids[0]!, statut: "reussi" });

    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });

    const liste = (await (await app.request("/api/projets")).json()) as any;
    expect(liste.ok).toBe(true);
    expect(liste.projets.length).toBe(1);
    expect(liste.projets[0].nom).toBe("CS-Vue360");
    const projetId = liste.projets[0].id;

    const detail = (await (await app.request(`/api/projets/${projetId}`)).json()) as any;
    expect(detail.ok).toBe(true);
    expect(detail.epics[0].nom).toBe("Build");
    expect(detail.epics[0].tickets[0].titre).toBe("Développer export");
    expect(detail.suite_recette[0].nom).toBe("Recette export");
    expect(detail.suite_recette[0].cas[0].statut).toBe("reussi");

    const inconnu = await app.request("/api/projets/inconnu");
    expect(inconnu.status).toBe(404);
  });

  it("GET /api/conversations puis /api/conversations/:id", async () => {
    contexte = creerDbTemp();
    const config: ConfigAgent = { apiKey: "sk-test", model: "x", maxTokens: 100 };
    const { client } = clientSimule([
      { content: [{ type: "text", text: "Bonjour." }], stop_reason: "end_turn", usage: USAGE },
    ]);
    const app = creerApp({ db: contexte.db, config, promptSysteme: PROMPT, creerClient: () => client });
    await app.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "salut" }),
    });

    const liste = (await (await app.request("/api/conversations")).json()) as any;
    expect(liste.conversations.length).toBe(1);
    const id = liste.conversations[0].id;

    const detail = (await (await app.request(`/api/conversations/${id}`)).json()) as any;
    expect(detail.ok).toBe(true);
    expect(detail.messages.length).toBe(2);
  });
});

describe("clé API absente", () => {
  it("le serveur répond sur les routes de lecture et refuse /api/chat proprement", async () => {
    contexte = creerDbTemp();
    const app = creerApp({ db: contexte.db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });

    const journal = await app.request("/api/journal");
    expect(journal.status).toBe(200);

    const chat = await app.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "salut" }),
    });
    expect(chat.status).toBe(503);
    const corps = (await chat.json()) as any;
    expect(corps.ok).toBe(false);
    expect(corps.erreur).toContain("Clé API");
  });
});

describe("POST /api/chat (SSE)", () => {
  it("diffuse le texte puis un événement 'fin'", async () => {
    contexte = creerDbTemp();
    const config: ConfigAgent = { apiKey: "sk-test", model: "x", maxTokens: 100 };
    const { client } = clientSimule([
      { content: [{ type: "text", text: "Voici ma réponse." }], stop_reason: "end_turn", usage: USAGE },
    ]);
    const app = creerApp({ db: contexte.db, config, promptSysteme: PROMPT, creerClient: () => client });

    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Bonjour" }),
    });
    expect(res.status).toBe(200);
    const evenements = parseSSE(await res.text());
    expect(evenements.some((e) => e.event === "texte" && e.data === "Voici ma réponse.")).toBe(true);
    expect(evenements.some((e) => e.event === "fin")).toBe(true);
  });

  it("émet 'validation_requise' quand un outil d'écriture est proposé", async () => {
    contexte = creerDbTemp();
    const config: ConfigAgent = { apiKey: "sk-test", model: "x", maxTokens: 100 };
    const { client } = clientSimule([
      {
        content: [
          {
            type: "tool_use",
            id: "tu1",
            name: "enregistrer_demande",
            input: { demandeur: "Sophie", equipe: "CS", expression_brute: "x", type: "evolution" },
          },
        ],
        stop_reason: "tool_use",
        usage: USAGE,
      },
    ]);
    const app = creerApp({ db: contexte.db, config, promptSysteme: PROMPT, creerClient: () => client });

    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Sophie du CS veut voir les factures" }),
    });
    const evenements = parseSSE(await res.text());
    const validation = evenements.find((e) => e.event === "validation_requise");
    expect(validation).toBeDefined();
    const ecriture = JSON.parse(validation!.data);
    expect(ecriture.outil).toBe("enregistrer_demande");
    expect(ecriture.statut).toBe("en_attente");
  });

  it("les événements 'outil_lecture' portent un résumé du résultat à la fin", async () => {
    contexte = creerDbTemp();
    const config: ConfigAgent = { apiKey: "sk-test", model: "x", maxTokens: 100 };
    const { client } = clientSimule([
      {
        content: [{ type: "tool_use", id: "tu1", name: "constats_ouverts", input: {} }],
        stop_reason: "tool_use",
        usage: USAGE,
      },
      { content: [{ type: "text", text: "Aucun point de vigilance." }], stop_reason: "end_turn", usage: USAGE },
    ]);
    const app = creerApp({ db: contexte.db, config, promptSysteme: PROMPT, creerClient: () => client });

    const res = await app.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Y a-t-il des points de vigilance ?" }),
    });
    const evenements = parseSSE(await res.text());
    const fin = evenements.find((e) => e.event === "outil_lecture" && JSON.parse(e.data).phase === "fin");
    expect(fin).toBeDefined();
    expect(JSON.parse(fin!.data).resume).toBe("0 résultats");
  });
});

describe("POST /api/confirm", () => {
  it("valide avec des paramètres corrigés et retourne le texte final", async () => {
    contexte = creerDbTemp();
    const config: ConfigAgent = { apiKey: "sk-test", model: "x", maxTokens: 100 };
    const { client: clientPause } = clientSimule([
      {
        content: [
          {
            type: "tool_use",
            id: "tu1",
            name: "enregistrer_demande",
            input: { demandeur: "Sophie", equipe: "CS", expression_brute: "x", type: "evolution" },
          },
        ],
        stop_reason: "tool_use",
        usage: USAGE,
      },
    ]);
    const appPause = creerApp({ db: contexte.db, config, promptSysteme: PROMPT, creerClient: () => clientPause });
    const resPause = await appPause.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Sophie du CS veut voir les factures" }),
    });
    const validation = JSON.parse(
      parseSSE(await resPause.text()).find((e) => e.event === "validation_requise")!.data
    );

    const { client: clientReprise } = clientSimule([
      { content: [{ type: "text", text: "C'est fait." }], stop_reason: "end_turn", usage: USAGE },
    ]);
    const appConfirm = creerApp({ db: contexte.db, config, promptSysteme: PROMPT, creerClient: () => clientReprise });
    const res = await appConfirm.request("/api/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ecritureId: validation.id,
        action: "valider",
        parametres: { demandeur: "Sophie", equipe: "ADV", expression_brute: "x", type: "evolution" },
      }),
    });
    const corps = (await res.json()) as any;
    expect(corps.ok).toBe(true);
    expect(corps.termine).toBe(true);
    expect(corps.texteAssistant).toBe("C'est fait.");

    const demande = contexte.db.prepare("SELECT equipe FROM demandes").get() as { equipe: string };
    expect(demande.equipe).toBe("ADV");
  });

  it("renvoie le détail complet d'une nouvelle écriture enchaînée", async () => {
    contexte = creerDbTemp();
    const config: ConfigAgent = { apiKey: "sk-test", model: "x", maxTokens: 100 };
    const { client: clientPause } = clientSimule([
      {
        content: [
          {
            type: "tool_use",
            id: "tu1",
            name: "enregistrer_demande",
            input: { demandeur: "Sophie", equipe: "CS", expression_brute: "x", type: "evolution" },
          },
        ],
        stop_reason: "tool_use",
        usage: USAGE,
      },
    ]);
    const appPause = creerApp({ db: contexte.db, config, promptSysteme: PROMPT, creerClient: () => clientPause });
    const resPause = await appPause.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Sophie du CS veut voir les factures" }),
    });
    const validation = JSON.parse(
      parseSSE(await resPause.text()).find((e) => e.event === "validation_requise")!.data
    );

    const { client: clientEnchainee } = clientSimule([
      {
        content: [
          {
            type: "tool_use",
            id: "tu2",
            name: "enregistrer_decision",
            input: { contexte: "x", options: [{ option: "a" }], decision: "a", decideur: "moi" },
          },
        ],
        stop_reason: "tool_use",
        usage: USAGE,
      },
    ]);
    const appConfirm = creerApp({ db: contexte.db, config, promptSysteme: PROMPT, creerClient: () => clientEnchainee });
    const res = await appConfirm.request("/api/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ecritureId: validation.id, action: "valider" }),
    });
    const corps = (await res.json()) as any;
    expect(corps.enAttenteValidation).toBe(true);
    expect(corps.ecriture).toBeDefined();
    expect(corps.ecriture.outil).toBe("enregistrer_decision");
    expect(corps.ecriture.statut).toBe("en_attente");
  });
});
