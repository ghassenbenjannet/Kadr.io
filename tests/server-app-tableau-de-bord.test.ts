import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";
import { enregistrerChangement } from "../src/tools/enregistrer-changement.js";
import { decrireSysteme } from "../src/tools/decrire-systeme.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const PROMPT = "Tu es l'assistant du Registre SI.";

function app(db: DbTemp["db"]) {
  return creerApp({ db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
}

describe("POST /api/controles", () => {
  it("exécute la vigie et renvoie les constats ouverts", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    decrireSysteme(contexte.db, { nom: "Zoho CRM" });
    const ch = enregistrerChangement(contexte.db, {
      description: "MAJ workflow",
      perimetre: "module CS",
      type: "parametrage",
    });
    expect(ch.ok).toBe(true);

    const res = await a.request("/api/controles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const corps = (await res.json()) as { ok: boolean; ouverts: unknown[] };
    expect(corps.ok).toBe(true);
    expect(Array.isArray(corps.ouverts)).toBe(true);
  });
});

describe("GET /api/tableau-de-bord", () => {
  it("agrège les compteurs et le journal de la semaine", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "je veux voir les factures",
      type: "evolution",
    });

    const res = await a.request("/api/tableau-de-bord");
    expect(res.status).toBe(200);
    const corps = (await res.json()) as {
      ok: boolean;
      demandesEnAttente: number;
      constatsOuverts: number;
      changements7j: number;
      incidentsOuverts: number;
      journalSemaine: unknown[];
      vigie: unknown[];
      resumeSemaine: { demandes: number };
    };
    expect(corps.ok).toBe(true);
    expect(corps.demandesEnAttente).toBe(1);
    expect(corps.journalSemaine.length).toBe(1);
    expect(corps.resumeSemaine.demandes).toBe(1);
  });
});
