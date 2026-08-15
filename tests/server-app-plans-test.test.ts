import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";
import { creerProjet } from "../src/tools/creer-projet.js";
import { creerEpic } from "../src/tools/creer-epic.js";
import { creerTicket } from "../src/tools/creer-ticket.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const PROMPT = "Tu es l'assistant du Registre SI.";

function app(db: DbTemp["db"]) {
  return creerApp({ db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
}

async function envoyer(a: ReturnType<typeof app>, methode: string, chemin: string, corps?: unknown) {
  return a.request(chemin, {
    method: methode,
    headers: corps !== undefined ? { "content-type": "application/json" } : undefined,
    body: corps !== undefined ? JSON.stringify(corps) : undefined,
  });
}

function seedTicket(db: DbTemp["db"]) {
  const projet = creerProjet(db, { nom: "Refonte CRM" });
  if (!projet.ok) throw new Error("échec de seed projet");
  const epic = creerEpic(db, { projet: "Refonte CRM", nom: "Facturation" });
  if (!epic.ok) throw new Error("échec de seed epic");
  const ticket = creerTicket(db, {
    projet: "Refonte CRM",
    epic: "Facturation",
    titre: "Ajouter export CSV",
    type: "task",
  });
  if (!ticket.ok) throw new Error("échec de seed ticket");
  return ticket.id;
}

describe("écran Plans de test — création, suivi, liaison, suppression", () => {
  it("crée un plan de test avec ses scénarios en une fois", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const res = await envoyer(a, "POST", "/api/plans-test", {
      nom: "Non-régression export",
      cas: [
        { etape: "Exporter en CSV", resultat_attendu: "Fichier généré" },
        { etape: "Ouvrir le fichier", resultat_attendu: "Colonnes correctes" },
      ],
    });
    expect(res.status).toBe(200);
    const corps = (await res.json()) as { ok: boolean; id: string; cas_ids: string[] };
    expect(corps.cas_ids.length).toBe(2);

    const liste = (await (await envoyer(a, "GET", "/api/plans-test")).json()) as {
      plans: { cas_total: number }[];
    };
    expect(liste.plans.length).toBe(1);
    expect(liste.plans[0]!.cas_total).toBe(2);
  });

  it("ajoute un scénario à un plan existant, l'exécute, puis le supprime", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const creation = await envoyer(a, "POST", "/api/plans-test", {
      nom: "Plan initial",
      cas: [{ etape: "Étape 1", resultat_attendu: "OK" }],
    });
    const { id: planId } = (await creation.json()) as { id: string };

    const ajout = await envoyer(a, "POST", `/api/plans-test/${planId}/cas`, {
      etape: "Étape 2",
      resultat_attendu: "OK aussi",
    });
    expect(ajout.status).toBe(200);
    const { id: casId } = (await ajout.json()) as { id: string };

    const execution = await envoyer(a, "PUT", `/api/cas-test/${casId}`, {
      statut: "reussi",
      executee_par: "Sophie",
    });
    expect(execution.status).toBe(200);
    const ligne = contexte.db.prepare("SELECT statut, executee_par FROM cas_test WHERE id = ?").get(casId) as {
      statut: string;
      executee_par: string;
    };
    expect(ligne.statut).toBe("reussi");
    expect(ligne.executee_par).toBe("Sophie");

    const suppressionCas = await envoyer(a, "DELETE", `/api/cas-test/${casId}`);
    expect(suppressionCas.status).toBe(200);

    const suppressionPlan = await envoyer(a, "DELETE", `/api/plans-test/${planId}`);
    expect(suppressionPlan.status).toBe(200);
    const detail = await envoyer(a, "GET", `/api/plans-test/${planId}`);
    expect(detail.status).toBe(404);
  });

  it("lie un plan de test à un ticket, puis délie", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const ticketId = seedTicket(contexte.db);

    const creation = await envoyer(a, "POST", "/api/plans-test", {
      nom: "Suite export",
      cas: [{ etape: "Vérifier export", resultat_attendu: "OK" }],
    });
    const { id: planId } = (await creation.json()) as { id: string };

    const lien = await envoyer(a, "POST", `/api/tickets/${ticketId}/plans-test`, { plan_test_id: planId });
    expect(lien.status).toBe(200);

    const ticketDetail = (await (await envoyer(a, "GET", `/api/tickets/${ticketId}`)).json()) as {
      plans_test: { id: string }[];
    };
    expect(ticketDetail.plans_test.map((p) => p.id)).toContain(planId);

    const delien = await envoyer(a, "DELETE", `/api/tickets/${ticketId}/plans-test/${planId}`);
    expect(delien.status).toBe(200);

    const apresDelien = (await (await envoyer(a, "GET", `/api/tickets/${ticketId}`)).json()) as {
      plans_test: { id: string }[];
    };
    expect(apresDelien.plans_test.map((p) => p.id)).not.toContain(planId);
  });
});
