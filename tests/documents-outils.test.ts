import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerProjet } from "../src/tools/creer-projet.js";
import { creerDocument } from "../src/tools/creer-document.js";
import { mettreAJourDocument } from "../src/tools/mettre-a-jour-document.js";
import { lireDocument } from "../src/tools/lire-document.js";
import { rechercherConnaissance } from "../src/tools/rechercher-connaissance.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("creer_document", () => {
  it("utilise le squelette du type quand contenu est omis", () => {
    contexte = creerDbTemp();
    creerProjet(contexte.db, { nom: "CS-Vue360" });
    const r = creerDocument(contexte.db, { projet: "CS-Vue360", type: "cadrage", titre: "Cadrage initial" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const ligne = contexte.db.prepare("SELECT contenu FROM documents WHERE id = ?").get(r.id) as {
      contenu: string;
    };
    expect(ligne.contenu).toContain("## Contexte");
    expect(ligne.contenu).toContain("## Risques");
  });

  it("respecte un contenu fourni explicitement, même vide", () => {
    contexte = creerDbTemp();
    creerProjet(contexte.db, { nom: "P" });
    const r = creerDocument(contexte.db, { projet: "P", type: "note", titre: "Note", contenu: "Texte libre." });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ligne = contexte.db.prepare("SELECT contenu FROM documents WHERE id = ?").get(r.id) as {
      contenu: string;
    };
    expect(ligne.contenu).toBe("Texte libre.");
  });

  it("refuse un projet introuvable", () => {
    contexte = creerDbTemp();
    const r = creerDocument(contexte.db, { projet: "N'existe pas", type: "note", titre: "X" });
    expect(r.ok).toBe(false);
  });

  it("crée une page de la base de connaissances quand projet est omis", () => {
    contexte = creerDbTemp();
    const r = creerDocument(contexte.db, { type: "architecture_existante", titre: "Existant Zoho CRM" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ligne = contexte.db.prepare("SELECT projet_id FROM documents WHERE id = ?").get(r.id) as {
      projet_id: string | null;
    };
    expect(ligne.projet_id).toBeNull();
  });
});

describe("mettre_a_jour_document", () => {
  it("remplace le contenu", () => {
    contexte = creerDbTemp();
    creerProjet(contexte.db, { nom: "P" });
    const doc = creerDocument(contexte.db, { projet: "P", type: "note", titre: "Note", contenu: "v1" });
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;

    const r = mettreAJourDocument(contexte.db, { id: doc.id, contenu: "v2" });
    expect(r.ok).toBe(true);
    const ligne = contexte.db.prepare("SELECT contenu FROM documents WHERE id = ?").get(doc.id) as {
      contenu: string;
    };
    expect(ligne.contenu).toBe("v2");
  });

  it("refuse une page introuvable et une mise à jour vide", () => {
    contexte = creerDbTemp();
    creerProjet(contexte.db, { nom: "P" });
    const doc = creerDocument(contexte.db, { projet: "P", type: "note", titre: "Note" });
    if (!doc.ok) return;
    expect(mettreAJourDocument(contexte.db, { id: "inconnu", contenu: "x" }).ok).toBe(false);
    expect(mettreAJourDocument(contexte.db, { id: doc.id }).ok).toBe(false);
  });
});

describe("lire_document", () => {
  it("lit le contenu complet, avec le projet quand il y en a un", () => {
    contexte = creerDbTemp();
    creerProjet(contexte.db, { nom: "P" });
    const doc = creerDocument(contexte.db, { projet: "P", type: "note", titre: "Note", contenu: "contenu complet" });
    if (!doc.ok) return;

    const r = lireDocument(contexte.db, { id: doc.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contenu).toBe("contenu complet");
    expect(r.projet).toBe("P");
  });

  it("projet est null pour une page de la base de connaissances", () => {
    contexte = creerDbTemp();
    const doc = creerDocument(contexte.db, { type: "note", titre: "Note globale", contenu: "x" });
    if (!doc.ok) return;
    const r = lireDocument(contexte.db, { id: doc.id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.projet).toBeNull();
  });

  it("refuse une page introuvable", () => {
    contexte = creerDbTemp();
    expect(lireDocument(contexte.db, { id: "inconnu" }).ok).toBe(false);
  });
});

describe("rechercher_connaissance", () => {
  it("trouve une page de la base de connaissances par son contenu", () => {
    contexte = creerDbTemp();
    creerDocument(contexte.db, {
      type: "architecture_existante",
      titre: "Existant Zoho CRM",
      contenu: "Le module Comptes gère les factures et les devis.",
    });

    const r = rechercherConnaissance(contexte.db, { question: "factures" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultats.length).toBe(1);
    expect(r.resultats[0]!.titre).toBe("Existant Zoho CRM");
  });

  it("ignore les pages rattachées à un projet", () => {
    contexte = creerDbTemp();
    creerProjet(contexte.db, { nom: "P" });
    creerDocument(contexte.db, { projet: "P", type: "note", titre: "Note projet", contenu: "mot-clé rare zzyzx" });

    const r = rechercherConnaissance(contexte.db, { question: "zzyzx" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultats.length).toBe(0);
  });

  it("retourne une liste vide sans lever d'erreur quand la question est vide de mots utiles", () => {
    contexte = creerDbTemp();
    const r = rechercherConnaissance(contexte.db, { question: "??" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resultats).toEqual([]);
  });
});
