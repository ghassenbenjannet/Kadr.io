import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";
import { creerProjet } from "../src/tools/creer-projet.js";
import { creerEpic } from "../src/tools/creer-epic.js";
import { creerTicket } from "../src/tools/creer-ticket.js";
import { creerDocument } from "../src/tools/creer-document.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const PROMPT = "Tu es l'assistant du Registre SI.";

function app(db: DbTemp["db"]) {
  return creerApp({ db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
}

async function envoyer(a: ReturnType<typeof app>, methode: string, chemin: string) {
  return a.request(chemin, { method: methode });
}

// Les 4 entités du journal ne se suppriment plus (Jalon 4, Prompt L) : voir
// tests/annulation-journal.test.ts pour le remplacement (POST .../annuler).
// Ici, seule la route DELETE historique reste à couvrir : elle doit répondre
// 410 sans rien exécuter, quelle que soit l'entité ou l'id.
describe("DELETE /api/journal/:entite/:id — route retirée (410)", () => {
  it("répond 410 même pour une entité/un id valides, sans toucher à la ligne", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const d = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "je veux voir les factures",
      type: "evolution",
    });
    if (!d.ok) throw new Error("échec de seed");

    const res = await envoyer(a, "DELETE", `/api/journal/demande/${d.id}`);
    expect(res.status).toBe(410);

    const ligne = contexte.db.prepare("SELECT id FROM demandes WHERE id = ?").get(d.id);
    expect(ligne).toBeDefined();
  });

  it("410 aussi sur une entité inconnue ou un id inexistant", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    expect((await envoyer(a, "DELETE", "/api/journal/fromage/x")).status).toBe(410);
    expect((await envoyer(a, "DELETE", "/api/journal/demande/x")).status).toBe(410);
  });
});

describe("suppression directe — projets, epics, tickets (cascade)", () => {
  it("supprimer un projet supprime ses epics et tickets en cascade", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const projet = creerProjet(contexte.db, { nom: "Refonte CRM" });
    if (!projet.ok) throw new Error("échec de seed");
    const epic = creerEpic(contexte.db, { projet: "Refonte CRM", nom: "Facturation" });
    if (!epic.ok) throw new Error("échec de seed");
    const ticket = creerTicket(contexte.db, {
      projet: "Refonte CRM",
      epic: "Facturation",
      titre: "Export CSV",
      type: "task",
    });
    if (!ticket.ok) throw new Error("échec de seed");

    const res = await envoyer(a, "DELETE", `/api/projets/${projet.id}`);
    expect(res.status).toBe(200);

    expect(contexte.db.prepare("SELECT id FROM epics WHERE id = ?").get(epic.id)).toBeUndefined();
    expect(contexte.db.prepare("SELECT id FROM tickets WHERE id = ?").get(ticket.id)).toBeUndefined();
  });

  it("supprime un ticket isolément", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    creerProjet(contexte.db, { nom: "Refonte CRM" });
    creerEpic(contexte.db, { projet: "Refonte CRM", nom: "Facturation" });
    const ticket = creerTicket(contexte.db, {
      projet: "Refonte CRM",
      epic: "Facturation",
      titre: "Export CSV",
      type: "task",
    });
    if (!ticket.ok) throw new Error("échec de seed");

    const res = await envoyer(a, "DELETE", `/api/tickets/${ticket.id}`);
    expect(res.status).toBe(200);
    expect(contexte.db.prepare("SELECT id FROM tickets WHERE id = ?").get(ticket.id)).toBeUndefined();
  });
});

describe("suppression directe — documents (base de connaissances)", () => {
  it("supprime une page et son entrée dans documents_fts", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const doc = creerDocument(contexte.db, { type: "note", titre: "Notes diverses" });
    if (!doc.ok) throw new Error("échec de seed");

    const res = await envoyer(a, "DELETE", `/api/documents/${doc.id}`);
    expect(res.status).toBe(200);
    expect(contexte.db.prepare("SELECT id FROM documents WHERE id = ?").get(doc.id)).toBeUndefined();

    const enFts = contexte.db
      .prepare("SELECT COUNT(*) AS n FROM documents_fts WHERE rowid IN (SELECT rowid FROM documents WHERE id = ?)")
      .get(doc.id) as { n: number };
    expect(enFts.n).toBe(0);
  });
});
