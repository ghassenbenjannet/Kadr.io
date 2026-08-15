import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";
import { seedModesDefaut } from "../src/agent/modes.js";

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

describe("écran Agents — CRUD direct des modes", () => {
  it("liste les 4 modes amorcés par défaut", async () => {
    contexte = creerDbTemp();
    seedModesDefaut(contexte.db);
    const a = app(contexte.db);
    const res = await envoyer(a, "GET", "/api/agents");
    expect(res.status).toBe(200);
    const corps = (await res.json()) as { ok: boolean; agents: { cle: string }[] };
    expect(corps.agents.length).toBe(4);
  });

  it("crée, lit, modifie puis supprime un agent personnalisé", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);

    const creation = await envoyer(a, "POST", "/api/agents", {
      cle: "audit_secu",
      titre: "Audit sécurité",
      description: "Revue des habilitations sous l'angle sécurité",
      contenu: "# Mode audit sécu\n\nInstructions détaillées ici.",
    });
    expect(creation.status).toBe(200);
    const { id } = (await creation.json()) as { ok: boolean; id: string };
    expect(id).toBeTruthy();

    const lecture = await envoyer(a, "GET", `/api/agents/${id}`);
    expect(lecture.status).toBe(200);
    const detail = (await lecture.json()) as { ok: boolean; titre: string };
    expect(detail.titre).toBe("Audit sécurité");

    const maj = await envoyer(a, "PUT", `/api/agents/${id}`, { titre: "Audit sécurité renforcé" });
    expect(maj.status).toBe(200);
    const apresMaj = contexte.db.prepare("SELECT titre FROM agents_modes WHERE id = ?").get(id) as {
      titre: string;
    };
    expect(apresMaj.titre).toBe("Audit sécurité renforcé");

    const suppression = await envoyer(a, "DELETE", `/api/agents/${id}`);
    expect(suppression.status).toBe(200);
    const apresSuppression = contexte.db.prepare("SELECT id FROM agents_modes WHERE id = ?").get(id);
    expect(apresSuppression).toBeUndefined();
  });

  it("refuse deux agents avec la même clé", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    await envoyer(a, "POST", "/api/agents", { cle: "audit_secu", titre: "A", contenu: "x" });
    const doublon = await envoyer(a, "POST", "/api/agents", { cle: "audit_secu", titre: "B", contenu: "y" });
    expect(doublon.status).toBe(400);
  });

  it("le contenu d'un agent modifié est repris par charger_mode", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const creation = await envoyer(a, "POST", "/api/agents", {
      cle: "test_mode",
      titre: "Mode de test",
      contenu: "Contenu initial",
    });
    const { id } = (await creation.json()) as { id: string };
    await envoyer(a, "PUT", `/api/agents/${id}`, { contenu: "Contenu modifié" });

    const { chargerModeOutil } = await import("../src/tools/charger-mode.js");
    const resultat = chargerModeOutil(contexte.db, { mode: "test_mode" });
    expect(resultat.ok).toBe(true);
    if (resultat.ok) expect(resultat.instructions).toBe("Contenu modifié");
  });
});
