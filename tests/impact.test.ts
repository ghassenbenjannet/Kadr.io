import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { decrireSysteme } from "../src/tools/decrire-systeme.js";
import { decrireModule } from "../src/tools/decrire-module.js";
import { decrireChamp } from "../src/tools/decrire-champ.js";
import { decrireHabilitation } from "../src/tools/decrire-habilitation.js";
import { decrireIntegration } from "../src/tools/decrire-integration.js";
import { decrireAutomatisation } from "../src/tools/decrire-automatisation.js";
import { impact } from "../src/tools/impact.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

function construireCasComplet(db: DbTemp["db"]) {
  decrireSysteme(db, { nom: "Zoho CRM", role: "CRM" });
  decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
  decrireChamp(db, {
    systeme: "Zoho CRM",
    module: "Comptes",
    nom: "Statut_Client",
    source_de_verite: "Zoho CRM",
  });

  decrireAutomatisation(db, {
    nom: "WF relance",
    type: "workflow",
    systeme: "Zoho CRM",
    module: "Comptes",
    champs: [{ systeme: "Zoho CRM", module: "Comptes", champ: "Statut_Client", sens: "lit" }],
  });
  decrireAutomatisation(db, {
    nom: "Deluge maj statut",
    type: "deluge",
    systeme: "Zoho CRM",
    module: "Comptes",
    champs: [{ systeme: "Zoho CRM", module: "Comptes", champ: "Statut_Client", sens: "ecrit" }],
  });

  decrireIntegration(db, {
    nom: "Devis -> CRM",
    source: "App Devis",
    cible: "Zoho CRM",
    champs: [{ systeme: "Zoho CRM", module: "Comptes", champ: "Statut_Client", sens: "ecrit" }],
  });

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
    justification: "rôle Admin",
  });
}

describe("impact — cas complet (§7.2)", () => {
  it("un champ touché par 2 automatisations, 1 intégration, 2 profils", () => {
    contexte = creerDbTemp();
    construireCasComplet(contexte.db);

    const r = impact(contexte.db, {
      cible: { type: "champ", systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.impacts.automatisations).toHaveLength(2);
    expect(r.impacts.automatisations.map((a) => a.sens).sort()).toEqual(["ecrit", "lit"]);
    expect(r.impacts.integrations).toHaveLength(1);
    expect(r.impacts.integrations[0]?.nom).toBe("Devis -> CRM");
    expect(r.impacts.habilitations).toHaveLength(2);
    expect(r.impacts.habilitations.some((h) => h.profil === "ADV" && h.droits === "visible")).toBe(true);
    expect(r.impacts.habilitations.some((h) => h.profil === "Admin" && h.droits === "éditable")).toBe(true);
    expect(r.resume).toContain("Statut_Client");
    expect(r.resume).toContain("2 automatisation(s)");
    expect(r.resume).toContain("1 intégration(s)");
    expect(r.resume).toContain("2 profil(s)");
  });

  it("agrège les impacts pour un module", () => {
    contexte = creerDbTemp();
    construireCasComplet(contexte.db);

    const r = impact(contexte.db, {
      cible: { type: "module", systeme: "Zoho CRM", nom: "Comptes" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.impacts.champs?.length).toBe(1);
    expect(r.impacts.automatisations.length).toBe(2);
    expect(r.impacts.integrations.length).toBe(1);
    expect(r.impacts.habilitations.length).toBe(2);
  });
});

describe("impact — cible inconnue", () => {
  it("retourne ok:false avec des suggestions de noms proches", () => {
    contexte = creerDbTemp();
    construireCasComplet(contexte.db);

    const r = impact(contexte.db, {
      cible: { type: "champ", systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Clint" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.suggestions).toContain("Statut_Client");
  });

  it("intégration inconnue -> ok:false", () => {
    contexte = creerDbTemp();
    const r = impact(contexte.db, { cible: { type: "integration", nom: "Inconnue" } });
    expect(r.ok).toBe(false);
  });
});
