import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { creerProjet } from "../src/tools/creer-projet.js";
import { creerDocument } from "../src/tools/creer-document.js";
import { mettreAJourDocument } from "../src/tools/mettre-a-jour-document.js";

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
