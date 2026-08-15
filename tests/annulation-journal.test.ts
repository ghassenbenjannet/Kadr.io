import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerApp } from "../src/server/app.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";
import { enregistrerChangement } from "../src/tools/enregistrer-changement.js";
import { rechercherJournal } from "../src/tools/rechercher-journal.js";
import { lancerControles } from "../src/tools/lancer-controles.js";
import { constatsOuverts } from "../src/tools/constats-ouverts.js";
import { annulerEntiteJournal } from "../src/tools/annuler-entite.js";
import { collecterDonneesHebdo, rendreHebdo, semaineCouranteIso } from "../src/rapport/hebdo.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

const PROMPT = "Tu es l'assistant du Registre SI.";

function app(db: DbTemp["db"]) {
  return creerApp({ db, config: { apiKey: null, model: "x", maxTokens: 1 }, promptSysteme: PROMPT });
}

describe("annuler-entite.ts (unitaire)", () => {
  it("entité inconnue -> ok:false", () => {
    contexte = creerDbTemp();
    const r = annulerEntiteJournal(contexte.db, "fromage", "x", "motif");
    expect(r.ok).toBe(false);
  });

  it("id introuvable -> ok:false", () => {
    contexte = creerDbTemp();
    const r = annulerEntiteJournal(contexte.db, "demande", "x", "motif");
    expect(r.ok).toBe(false);
  });

  it("annuler deux fois -> la seconde échoue (déjà annulée)", () => {
    contexte = creerDbTemp();
    const d = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "x",
      type: "evolution",
    });
    if (!d.ok) throw new Error("échec de seed");
    expect(annulerEntiteJournal(contexte.db, "demande", d.id, "doublon").ok).toBe(true);
    expect(annulerEntiteJournal(contexte.db, "demande", d.id, "encore").ok).toBe(false);
  });
});

describe("POST /api/journal/:entite/:id/annuler", () => {
  it("400 sans raison (absente ou vide)", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const d = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "x",
      type: "evolution",
    });
    if (!d.ok) throw new Error("échec de seed");

    const sansCorps = await a.request(`/api/journal/demande/${d.id}/annuler`, { method: "POST" });
    expect(sansCorps.status).toBe(400);

    const raisonVide = await a.request(`/api/journal/demande/${d.id}/annuler`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raison: "   " }),
    });
    expect(raisonVide.status).toBe(400);

    const ligne = contexte.db.prepare("SELECT annule_le FROM demandes WHERE id = ?").get(d.id) as {
      annule_le: string | null;
    };
    expect(ligne.annule_le).toBeNull();
  });

  it("200 avec raison : annule_le et annulation_raison renseignés", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const d = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "x",
      type: "evolution",
    });
    if (!d.ok) throw new Error("échec de seed");

    const res = await a.request(`/api/journal/demande/${d.id}/annuler`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raison: "Doublon avec d2" }),
    });
    expect(res.status).toBe(200);

    const ligne = contexte.db.prepare("SELECT annule_le, annulation_raison FROM demandes WHERE id = ?").get(d.id) as {
      annule_le: string | null;
      annulation_raison: string | null;
    };
    expect(ligne.annule_le).not.toBeNull();
    expect(ligne.annulation_raison).toBe("Doublon avec d2");
  });

  it("404 sur une entité inconnue", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const res = await a.request("/api/journal/fromage/x/annuler", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ raison: "x" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/journal/:entite/:id -> 410 (route historique)", () => {
  it("répond 410 et n'annule ni ne supprime rien", async () => {
    contexte = creerDbTemp();
    const a = app(contexte.db);
    const d = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "x",
      type: "evolution",
    });
    if (!d.ok) throw new Error("échec de seed");

    const res = await a.request(`/api/journal/demande/${d.id}`, { method: "DELETE" });
    expect(res.status).toBe(410);

    const ligne = contexte.db.prepare("SELECT annule_le FROM demandes WHERE id = ?").get(d.id) as {
      annule_le: string | null;
    };
    expect(ligne).toBeDefined();
    expect(ligne.annule_le).toBeNull();
  });
});

describe("une entrée annulée est exclue des vues normales", () => {
  it("absente de rechercher_journal", () => {
    contexte = creerDbTemp();
    const d = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "voir les factures dans la fiche client",
      type: "evolution",
    });
    if (!d.ok) throw new Error("échec de seed");

    const avant = rechercherJournal(contexte.db, { question: "factures" });
    if (!avant.ok) throw new Error("échec recherche");
    expect(avant.resultats.some((r) => r.id === d.id)).toBe(true);

    annulerEntiteJournal(contexte.db, "demande", d.id, "doublon");

    const apres = rechercherJournal(contexte.db, { question: "factures" });
    if (!apres.ok) throw new Error("échec recherche");
    expect(apres.resultats.some((r) => r.id === d.id)).toBe(false);
  });

  it("un changement annulé sort de la vigie (constat C3 déjà ouvert passe en traité, aucun nouveau)", () => {
    contexte = creerDbTemp();
    // C3 (changement sans demande ni décision d'origine) déclenche sans condition d'âge,
    // contrairement à C1 — pas besoin de faux cree_le dans le passé pour ce test.
    const c = enregistrerChangement(contexte.db, {
      description: "Ajout d'un champ",
      perimetre: "Module facturation",
      type: "parametrage",
    });
    if (!c.ok) throw new Error("échec de seed");

    lancerControles(contexte.db, {});
    const avant = constatsOuverts(contexte.db, {});
    if (!avant.ok) throw new Error("échec constats");
    expect(avant.constats.some((co) => co.controle === "C3")).toBe(true);

    annulerEntiteJournal(contexte.db, "changement", c.id, "changement annulé avant mise en prod");
    lancerControles(contexte.db, {});

    const apres = constatsOuverts(contexte.db, {});
    if (!apres.ok) throw new Error("échec constats");
    expect(apres.constats.some((co) => co.controle === "C3")).toBe(false);
  });
});

describe("rapport hebdo — ligne « Entrées annulées cette semaine »", () => {
  it("liste l'entité, le résumé et la raison d'une entrée annulée cette semaine", () => {
    contexte = creerDbTemp();
    const d = enregistrerDemande(contexte.db, {
      demandeur: "Sophie",
      equipe: "CS",
      expression_brute: "voir les factures",
      type: "evolution",
    });
    if (!d.ok) throw new Error("échec de seed");
    annulerEntiteJournal(contexte.db, "demande", d.id, "doublon avec une autre demande");

    const semaine = semaineCouranteIso();
    const donnees = collecterDonneesHebdo(contexte.db, semaine);
    expect(donnees.annulations).toHaveLength(1);
    expect(donnees.annulations[0]!.entite).toBe("demande");
    expect(donnees.annulations[0]!.raison).toBe("doublon avec une autre demande");

    const md = rendreHebdo(donnees);
    expect(md).toContain("Entrées annulées cette semaine");
    expect(md).toContain("doublon avec une autre demande");
  });

  it("« Aucune entrée annulée cette semaine. » sans annulation", () => {
    contexte = creerDbTemp();
    const donnees = collecterDonneesHebdo(contexte.db, semaineCouranteIso());
    const md = rendreHebdo(donnees);
    expect(md).toContain("Aucune entrée annulée cette semaine.");
  });
});
