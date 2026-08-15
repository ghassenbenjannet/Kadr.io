import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { decrireSysteme } from "../src/tools/decrire-systeme.js";
import { decrireModule } from "../src/tools/decrire-module.js";
import { decrireChamp } from "../src/tools/decrire-champ.js";
import { decrireHabilitation } from "../src/tools/decrire-habilitation.js";
import { decrireIntegration } from "../src/tools/decrire-integration.js";
import { rendrePageHabilitations } from "../src/web/pages/habilitations.js";
import { rendrePageChamps } from "../src/web/pages/champs.js";
import { rendrePageIntegrations } from "../src/web/pages/integrations.js";
import { rendrePageConstats } from "../src/web/pages/constats.js";
import { lancerControles } from "../src/tools/lancer-controles.js";
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
  decrireIntegration(db, { nom: "Devis -> CRM", source: "App Devis", cible: "Zoho CRM" });
}

describe("pages web", () => {
  it("matrice d'habilitations : distingue non déclaré / masqué / visible / éditable", () => {
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

  it("matrice d'habilitations : le filtre par module réduit les lignes", () => {
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

  it("champs par source de vérité : contradiction M2 signalée", () => {
    contexte = creerDbTemp();
    const db = contexte.db;
    decrireSysteme(db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(db, {
      systeme: "Zoho CRM",
      module: "Comptes",
      nom: "Statut_Client",
      source_de_verite: "App Devis",
      editable: true,
    });
    const html = rendrePageChamps(db);
    expect(html).toContain("App Devis");
    expect(html).toContain("contredit sa source");
  });

  it("carte des intégrations : affiche source -> cible et les constats ouverts", () => {
    contexte = creerDbTemp();
    construireCarte(contexte.db);
    lancerControles(contexte.db, { perimetre: "integration" });
    const html = rendrePageIntegrations(contexte.db);
    expect(html).toContain("Devis -&gt; CRM");
    expect(html).toContain("App Devis");
    expect(html).toMatch(/point\(s\) de vigilance/);
  });

  it("constats ouverts : groupés par famille sans code brut", () => {
    contexte = creerDbTemp();
    construireCarte(contexte.db);
    lancerControles(contexte.db, { perimetre: "tous" });
    const html = rendrePageConstats(contexte.db);
    expect(html).toContain("Modèle");
    expect(html).toContain("Intégration");
    expect(html).not.toMatch(/>M1</);
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
