import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";
import { rechercherJournal } from "../src/tools/rechercher-journal.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("rechercher_journal", () => {
  it("retrouve « devis » dans une demande", () => {
    contexte = creerDbTemp();
    const r = enregistrerDemande(contexte.db, {
      demandeur: "Marc",
      equipe: "ADV",
      expression_brute: "le délai affiché sur les devis est faux",
      type: "correction",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const resultat = rechercherJournal(contexte.db, { question: "devis" });
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.resultats.some((x) => x.id === r.id)).toBe(true);
    expect(resultat.resultats[0]?.lien_conversationnel).toContain("demande du");
  });

  it("insensible aux accents : 'delai' retrouve 'délai'", () => {
    contexte = creerDbTemp();
    enregistrerDemande(contexte.db, {
      demandeur: "Marc",
      equipe: "ADV",
      expression_brute: "le délai affiché sur les devis est faux",
      type: "correction",
    });
    const resultat = rechercherJournal(contexte.db, { question: "delai" });
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.resultats.length).toBeGreaterThan(0);
  });

  it("filtre par date (depuis/jusqu_a)", () => {
    contexte = creerDbTemp();
    const r = enregistrerDemande(contexte.db, {
      demandeur: "Marc",
      equipe: "ADV",
      expression_brute: "sujet devis",
      type: "correction",
    });
    expect(r.ok).toBe(true);
    const dansLeFutur = rechercherJournal(contexte.db, {
      question: "devis",
      depuis: "2999-01-01T00:00:00.000Z",
    });
    expect(dansLeFutur.ok).toBe(true);
    if (dansLeFutur.ok) expect(dansLeFutur.resultats).toHaveLength(0);
  });

  it("limite à 20 résultats maximum", () => {
    contexte = creerDbTemp();
    for (let i = 0; i < 25; i++) {
      enregistrerDemande(contexte.db, {
        demandeur: `Personne ${i}`,
        equipe: "ADV",
        expression_brute: "sujet devis récurrent",
        type: "correction",
      });
    }
    const resultat = rechercherJournal(contexte.db, { question: "devis" });
    expect(resultat.ok).toBe(true);
    if (resultat.ok) expect(resultat.resultats.length).toBeLessThanOrEqual(20);
  });
});
