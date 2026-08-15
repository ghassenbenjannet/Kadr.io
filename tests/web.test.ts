// Le rendu HTML autonome de la matrice d'habilitations n'est plus servi par un
// serveur web séparé (porté en écran React, voir front/src/views/Habilitations.tsx) :
// il ne sert plus qu'à l'export produit par generer_rapport(type: "matrice_habilitations").
import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { decrireSysteme } from "../src/tools/decrire-systeme.js";
import { decrireModule } from "../src/tools/decrire-module.js";
import { decrireChamp } from "../src/tools/decrire-champ.js";
import { decrireHabilitation } from "../src/tools/decrire-habilitation.js";
import { rendrePageHabilitations } from "../src/web/pages/habilitations.js";
import { genererRapport } from "../src/tools/generer-rapport.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

function construireCarte(db: DbTemp["db"]) {
  decrireSysteme(db, { nom: "Zoho CRM", role: "CRM" });
  decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
  decrireChamp(db, {
    systeme: "Zoho CRM",
    module: "Comptes",
    nom: "Statut_Client",
    source_de_verite: "Zoho CRM",
    editable: true,
  });
  decrireChamp(db, { systeme: "Zoho CRM", module: "Comptes", nom: "Montant" }); // sans source (M1)
  decrireHabilitation(db, {
    profil: "ADV",
    systeme: "Zoho CRM",
    module: "Comptes",
    champ: "Statut_Client",
    visible: true,
    editable: false,
  });
  decrireHabilitation(db, {
    profil: "Admin",
    systeme: "Zoho CRM",
    module: "Comptes",
    champ: "Statut_Client",
    visible: true,
    editable: true,
    justification: "délégation CEO",
  });
}

describe("export HTML matrice d'habilitations", () => {
  it("distingue non déclaré / masqué / visible / éditable", () => {
    contexte = creerDbTemp();
    construireCarte(contexte.db);
    const html = rendrePageHabilitations(contexte.db, undefined);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Statut_Client");
    expect(html).toContain("Édite");
    expect(html).toContain("Visible");
    // "Montant" n'a aucune habilitation déclarée -> non déclaré, pour chaque profil.
    expect(html).toContain("non déclaré");
  });

  it("le filtre par module réduit les lignes", () => {
    contexte = creerDbTemp();
    construireCarte(contexte.db);
    decrireModule(contexte.db, { systeme: "Zoho CRM", nom: "Devis" });
    decrireChamp(contexte.db, { systeme: "Zoho CRM", module: "Devis", nom: "Reference" });

    const complete = rendrePageHabilitations(contexte.db, undefined);
    expect(complete).toContain("Reference");

    const filtree = rendrePageHabilitations(contexte.db, "Comptes");
    expect(filtree).not.toContain("Reference");
    expect(filtree).toContain("Statut_Client");
  });

  it("generer_rapport('matrice_habilitations') retourne du HTML autonome", () => {
    contexte = creerDbTemp();
    construireCarte(contexte.db);
    const r = genererRapport(contexte.db, { type: "matrice_habilitations" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.html).toContain("<!doctype html>");
    expect(r.markdown).toBeUndefined();
  });
});
