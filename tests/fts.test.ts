import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { enregistrerDemande } from "../src/tools/enregistrer-demande.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("triggers FTS", () => {
  it("peuple journal_fts à l'insertion d'une demande", () => {
    contexte = creerDbTemp();
    const r = enregistrerDemande(contexte.db, {
      demandeur: "Marc",
      equipe: "ADV",
      expression_brute: "il faut revoir le délai de livraison sur les devis",
      type: "evolution",
    });
    expect(r.ok).toBe(true);

    const trouves = contexte.db
      .prepare("SELECT entite_id FROM journal_fts WHERE journal_fts MATCH 'devis*'")
      .all() as { entite_id: string }[];
    expect(trouves.map((t) => t.entite_id)).toContain(r.ok ? r.id : "");
  });

  it("insensible aux diacritiques : 'delai' retrouve 'délai'", () => {
    contexte = creerDbTemp();
    enregistrerDemande(contexte.db, {
      demandeur: "Marc",
      equipe: "ADV",
      expression_brute: "il faut revoir le délai de livraison",
      type: "evolution",
    });
    const trouves = contexte.db
      .prepare("SELECT entite_id FROM journal_fts WHERE journal_fts MATCH 'delai*'")
      .all();
    expect(trouves.length).toBeGreaterThan(0);
  });
});
