import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const PROMPT = "Tu es l'assistant du Registre SI.";

function app(db: DbTemp["db"]) {
  return creerApp({ db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
}

async function postJson(a: ReturnType<typeof app>, chemin: string, corps: unknown) {
  return a.request(chemin, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps),
  });
}

describe("POST /api/journal/:entite — création directe", () => {
  it("crée une demande sans passer par l'agent", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const res = await postJson(a, "/api/journal/demande", {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "je veux voir les factures",
      type: "evolution",
    });
    expect(res.status).toBe(200);
    const corps = (await res.json()) as { ok: boolean; id: string };
    expect(corps.ok).toBe(true);
    const ligne = contexte.db.prepare("SELECT demandeur FROM demandes WHERE id = ?").get(corps.id) as {
      demandeur: string;
    };
    expect(ligne.demandeur).toBe("Sophie");
  });

  it("crée une décision, un changement et un incident", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);

    const dec = await postJson(a, "/api/journal/decision", {
      contexte: "x",
      options: [{ option: "a" }],
      decision: "on fait a",
      decideur: "moi",
    });
    expect(dec.status).toBe(200);

    const ch = await postJson(a, "/api/journal/changement", {
      description: "MAJ workflow",
      perimetre: "module CS",
      type: "parametrage",
    });
    expect(ch.status).toBe(200);

    const inc = await postJson(a, "/api/journal/incident", { symptome: "erreur 500", impact: "bloquant" });
    expect(inc.status).toBe(200);
  });

  it("400 sur une entité inconnue ou un corps invalide", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    expect((await postJson(a, "/api/journal/module", { statut: "x" })).status).toBe(404);
    expect((await postJson(a, "/api/journal/demande", { demandeur: "" })).status).toBe(400);
  });
});

describe("POST /api/projets, /api/epics, /api/tickets — création directe", () => {
  it("crée un projet, un epic dans ce projet, puis un ticket dans cet epic", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);

    const p = await postJson(a, "/api/projets", { nom: "Vue 360" });
    expect(p.status).toBe(200);
    const pCorps = (await p.json()) as { ok: boolean; id: string };
    expect(pCorps.ok).toBe(true);

    const e = await postJson(a, "/api/epics", { projet: "Vue 360", nom: "Discovery" });
    expect(e.status).toBe(200);

    const t = await postJson(a, "/api/tickets", {
      projet: "Vue 360",
      epic: "Discovery",
      titre: "Cadrer le besoin",
      type: "analyse",
    });
    expect(t.status).toBe(200);
    const tCorps = (await t.json()) as { ok: boolean; id: string };
    expect(tCorps.ok).toBe(true);

    const ligne = contexte.db.prepare("SELECT titre FROM tickets WHERE id = ?").get(tCorps.id) as { titre: string };
    expect(ligne.titre).toBe("Cadrer le besoin");
  });

  it("400 sur un corps invalide", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    expect((await postJson(a, "/api/projets", {})).status).toBe(400);
    expect((await postJson(a, "/api/epics", { projet: "X" })).status).toBe(400);
    expect((await postJson(a, "/api/tickets", { projet: "X", epic: "Y" })).status).toBe(400);
  });
});
