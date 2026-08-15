import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";
import { enregistrerDecision } from "../src/tools/enregistrer-decision.js";
import { enregistrerChangement } from "../src/tools/enregistrer-changement.js";
import { enregistrerIncident } from "../src/tools/enregistrer-incident.js";
import { creerTicket } from "../src/tools/creer-ticket.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const PROMPT = "Tu es l'assistant du Registre SI.";

function app(db: DbTemp["db"]) {
  return creerApp({ db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
}

async function putJson(a: ReturnType<typeof app>, chemin: string, corps: unknown) {
  return a.request(chemin, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corps),
  });
}

describe("PUT /api/journal/:entite/:id — édition directe", () => {
  it("met à jour une demande sans passer par l'agent", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const d = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "je veux voir les factures",
      type: "evolution",
    });
    if (!d.ok) throw new Error("échec de seed");

    const res = await putJson(a, `/api/journal/demande/${d.id}`, { statut: "qualifiee" });
    expect(res.status).toBe(200);
    const corps = (await res.json()) as { ok: boolean };
    expect(corps.ok).toBe(true);

    const ligne = contexte.db.prepare("SELECT statut FROM demandes WHERE id = ?").get(d.id) as { statut: string };
    expect(ligne.statut).toBe("qualifiee");
  });

  it("répercute les contraintes métier existantes (decision remplacee sans remplacee_par)", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const dec = enregistrerDecision(contexte.db, {
      contexte: "x",
      options: [{ option: "a" }],
      decision: "on fait a",
      decideur: "moi",
    });
    if (!dec.ok) throw new Error("échec de seed");

    const res = await putJson(a, `/api/journal/decision/${dec.id}`, { statut: "remplacee" });
    expect(res.status).toBe(400);
    const corps = (await res.json()) as { ok: boolean };
    expect(corps.ok).toBe(false);
  });

  it("404 sur une entité inconnue, 400 sur un id inexistant", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    expect((await putJson(a, "/api/journal/module/x", { statut: "x" })).status).toBe(404);
    expect((await putJson(a, "/api/journal/demande/inconnu", { statut: "qualifiee" })).status).toBe(400);
  });

  it("met à jour un changement et un incident", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const ch = enregistrerChangement(contexte.db, {
      description: "MAJ workflow",
      perimetre: "module CS",
      type: "parametrage",
    });
    const inc = enregistrerIncident(contexte.db, { symptome: "erreur 500", impact: "bloquant" });
    if (!ch.ok || !inc.ok) throw new Error("échec de seed");

    const resCh = await putJson(a, `/api/journal/changement/${ch.id}`, { rollback: "annuler le param" });
    expect(resCh.status).toBe(200);

    const resInc = await putJson(a, `/api/journal/incident/${inc.id}`, { resolution: "redémarré le service" });
    expect(resInc.status).toBe(200);
    const ligne = contexte.db.prepare("SELECT resolution, resolu_le FROM incidents WHERE id = ?").get(inc.id) as {
      resolution: string;
      resolu_le: string | null;
    };
    expect(ligne.resolution).toBe("redémarré le service");
    expect(ligne.resolu_le).not.toBeNull();
  });
});

describe("PUT /api/tickets/:id, /api/projets/:id, /api/epics/:id — édition directe", () => {
  it("met à jour un ticket, son epic et son projet", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const t = creerTicket(contexte.db, { projet: "Vue 360", epic: "Discovery", titre: "Cadrer le besoin", type: "analyse" });
    if (!t.ok) throw new Error("échec de seed");

    const ligneTicket = contexte.db.prepare("SELECT epic_id FROM tickets WHERE id = ?").get(t.id) as { epic_id: string };
    const ligneEpic = contexte.db
      .prepare("SELECT projet_id FROM epics WHERE id = ?")
      .get(ligneTicket.epic_id) as { projet_id: string };

    const resTicket = await putJson(a, `/api/tickets/${t.id}`, { statut: "en_cours" });
    expect(resTicket.status).toBe(200);
    expect((contexte.db.prepare("SELECT statut FROM tickets WHERE id = ?").get(t.id) as { statut: string }).statut).toBe(
      "en_cours"
    );

    const resEpic = await putJson(a, `/api/epics/${ligneTicket.epic_id}`, { statut: "en_cours", description: "en cours de cadrage" });
    expect(resEpic.status).toBe(200);
    const epicRow = contexte.db.prepare("SELECT statut, description FROM epics WHERE id = ?").get(ligneTicket.epic_id) as {
      statut: string;
      description: string | null;
    };
    expect(epicRow.statut).toBe("en_cours");
    expect(epicRow.description).toBe("en cours de cadrage");

    const resProjet = await putJson(a, `/api/projets/${ligneEpic.projet_id}`, { statut: "clos" });
    expect(resProjet.status).toBe(200);
    expect(
      (contexte.db.prepare("SELECT statut FROM projets WHERE id = ?").get(ligneEpic.projet_id) as { statut: string }).statut
    ).toBe("clos");
  });

  it("404/400 sur des ids inexistants", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    expect((await putJson(a, "/api/tickets/inconnu", { statut: "en_cours" })).status).toBe(400);
    expect((await putJson(a, "/api/projets/inconnu", { statut: "clos" })).status).toBe(400);
    expect((await putJson(a, "/api/epics/inconnu", { statut: "termine" })).status).toBe(400);
  });
});
