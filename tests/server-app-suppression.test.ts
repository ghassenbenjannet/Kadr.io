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

describe("suppression directe — entités du journal", () => {
  it("supprime une demande et son entrée dans journal_fts", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const d = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "je veux voir les factures",
      type: "evolution",
    });
    if (!d.ok) throw new Error("échec de seed");

    const avant = contexte.db
      .prepare("SELECT COUNT(*) AS n FROM journal_fts WHERE entite = 'demande' AND entite_id = ?")
      .get(d.id) as { n: number };
    expect(avant.n).toBe(1);

    const res = await envoyer(a, "DELETE", `/api/journal/demande/${d.id}`);
    expect(res.status).toBe(200);

    const ligne = contexte.db.prepare("SELECT id FROM demandes WHERE id = ?").get(d.id);
    expect(ligne).toBeUndefined();
    const apres = contexte.db
      .prepare("SELECT COUNT(*) AS n FROM journal_fts WHERE entite = 'demande' AND entite_id = ?")
      .get(d.id) as { n: number };
    expect(apres.n).toBe(0);
  });

  it("404 sur une entité inconnue, 400 sur un id inexistant", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const inconnue = await envoyer(a, "DELETE", "/api/journal/fromage/x");
    expect(inconnue.status).toBe(404);
    const introuvable = await envoyer(a, "DELETE", "/api/journal/demande/x");
    expect(introuvable.status).toBe(400);
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
