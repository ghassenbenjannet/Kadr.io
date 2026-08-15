import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";
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

function seedDeuxProjetsAvecTickets(db: DbTemp["db"]) {
  const p1 = creerProjet(db, { nom: "Refonte CRM" });
  const p2 = creerProjet(db, { nom: "Migration ERP" });
  if (!p1.ok || !p2.ok) throw new Error("échec de seed projets");
  const e1 = creerEpic(db, { projet: "Refonte CRM", nom: "Facturation" });
  const e2 = creerEpic(db, { projet: "Migration ERP", nom: "Comptes" });
  if (!e1.ok || !e2.ok) throw new Error("échec de seed epics");
  const t1 = creerTicket(db, { projet: "Refonte CRM", epic: "Facturation", titre: "Export CSV", type: "task" });
  const t2 = creerTicket(db, { projet: "Migration ERP", epic: "Comptes", titre: "Migrer comptes", type: "task" });
  if (!t1.ok || !t2.ok) throw new Error("échec de seed tickets");
  return { p1: p1.id, p2: p2.id, e1: e1.id, e2: e2.id, t1: t1.id, t2: t2.id };
}

describe("GET /api/tickets — kanban configurable, filtres projet/epic", () => {
  it("liste tous les tickets sans filtre", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    seedDeuxProjetsAvecTickets(contexte.db);
    const res = await envoyer(a, "GET", "/api/tickets");
    expect(res.status).toBe(200);
    const corps = (await res.json()) as { tickets: { titre: string }[] };
    expect(corps.tickets.length).toBe(2);
  });

  it("filtre par projet", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const { p1 } = seedDeuxProjetsAvecTickets(contexte.db);
    const res = await envoyer(a, "GET", `/api/tickets?projet_id=${p1}`);
    const corps = (await res.json()) as { tickets: { titre: string }[] };
    expect(corps.tickets.length).toBe(1);
    expect(corps.tickets[0]!.titre).toBe("Export CSV");
  });

  it("filtre par epic", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const { e2 } = seedDeuxProjetsAvecTickets(contexte.db);
    const res = await envoyer(a, "GET", `/api/tickets?epic_id=${e2}`);
    const corps = (await res.json()) as { tickets: { titre: string }[] };
    expect(corps.tickets.length).toBe(1);
    expect(corps.tickets[0]!.titre).toBe("Migrer comptes");
  });
});

describe("GET /api/demandes — filtrable par projet", () => {
  it("filtre les demandes liées à un projet", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const d1 = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "x",
      type: "evolution",
    });
    const d2 = enregistrerDemande(contexte.db, {
      demandeur: "Marc",
      equipe: "ADV",
      expression_brute: "y",
      type: "evolution",
    });
    if (!d1.ok || !d2.ok) throw new Error("échec de seed");
    const p = creerProjet(contexte.db, { nom: "Refonte CRM", demande_ids: [d1.id] });
    if (!p.ok) throw new Error("échec de seed projet");

    const res = await envoyer(a, "GET", `/api/demandes?projet_id=${p.id}`);
    const corps = (await res.json()) as { demandes: { id: string }[] };
    expect(corps.demandes.length).toBe(1);
    expect(corps.demandes[0]!.id).toBe(d1.id);
  });
});

describe("projet <-> demande : lier / délier / voir dans le détail projet", () => {
  it("lie une demande à un projet, la retrouve dans le détail, puis délie", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const demande = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "x",
      type: "evolution",
    });
    const projet = creerProjet(contexte.db, { nom: "Refonte CRM" });
    if (!demande.ok || !projet.ok) throw new Error("échec de seed");

    const lien = await envoyer(a, "POST", `/api/projets/${projet.id}/demandes`, { demande_id: demande.id });
    expect(lien.status).toBe(200);

    const detail = (await (await envoyer(a, "GET", `/api/projets/${projet.id}`)).json()) as {
      demandes_liees: { id: string }[];
    };
    expect(detail.demandes_liees.map((d) => d.id)).toContain(demande.id);

    const delien = await envoyer(a, "DELETE", `/api/projets/${projet.id}/demandes/${demande.id}`);
    expect(delien.status).toBe(200);

    const apresDelien = (await (await envoyer(a, "GET", `/api/projets/${projet.id}`)).json()) as {
      demandes_liees: { id: string }[];
    };
    expect(apresDelien.demandes_liees.map((d) => d.id)).not.toContain(demande.id);
  });

  it("expose les projets liés depuis la fiche demande", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const demande = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "x",
      type: "evolution",
    });
    if (!demande.ok) throw new Error("échec de seed");
    const projet = creerProjet(contexte.db, { nom: "Refonte CRM", demande_ids: [demande.id] });
    if (!projet.ok) throw new Error("échec de seed");

    const detail = (await (await envoyer(a, "GET", `/api/journal/demande/${demande.id}`)).json()) as {
      projets_lies: { id: string; nom: string }[];
    };
    expect(detail.projets_lies.map((p) => p.nom)).toContain("Refonte CRM");
  });
});

describe("vues_kanban — sauvegarder / lister / supprimer", () => {
  it("sauvegarde une vue puis la retrouve dans la liste", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const res = await envoyer(a, "POST", "/api/vues-kanban", {
      nom: "Tickets - Refonte CRM",
      entite: "ticket",
      filtres: { projet_id: "p1" },
    });
    expect(res.status).toBe(200);

    const liste = (await (await envoyer(a, "GET", "/api/vues-kanban")).json()) as {
      vues: { nom: string; entite: string; filtres: { projet_id?: string } }[];
    };
    expect(liste.vues.length).toBe(1);
    expect(liste.vues[0]!.nom).toBe("Tickets - Refonte CRM");
    expect(liste.vues[0]!.filtres.projet_id).toBe("p1");
  });

  it("enregistrer sous un nom existant écrase la vue plutôt que de la dupliquer", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    await envoyer(a, "POST", "/api/vues-kanban", { nom: "Ma vue", entite: "demande", filtres: {} });
    await envoyer(a, "POST", "/api/vues-kanban", { nom: "Ma vue", entite: "ticket", filtres: { projet_id: "p2" } });

    const liste = (await (await envoyer(a, "GET", "/api/vues-kanban")).json()) as {
      vues: { nom: string; entite: string }[];
    };
    expect(liste.vues.length).toBe(1);
    expect(liste.vues[0]!.entite).toBe("ticket");
  });

  it("supprime une vue", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const creation = await envoyer(a, "POST", "/api/vues-kanban", { nom: "Ma vue", entite: "demande", filtres: {} });
    const { id } = (await creation.json()) as { id: string };

    const suppression = await envoyer(a, "DELETE", `/api/vues-kanban/${id}`);
    expect(suppression.status).toBe(200);

    const liste = (await (await envoyer(a, "GET", "/api/vues-kanban")).json()) as { vues: unknown[] };
    expect(liste.vues.length).toBe(0);
  });
});
