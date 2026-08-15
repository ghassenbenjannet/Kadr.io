import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { decrireSysteme } from "../src/tools/decrire-systeme.js";
import { decrireModule } from "../src/tools/decrire-module.js";
import { decrireChamp } from "../src/tools/decrire-champ.js";
import { enregistrerChangement } from "../src/tools/enregistrer-changement.js";
import { lierChangement } from "../src/tools/lier-changement.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("lier_changement", () => {
  it("lier deux fois = une ligne dans carte_journal", () => {
    contexte = creerDbTemp();
    const db = contexte.db;
    decrireSysteme(db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(db, { systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client" });
    const c = enregistrerChangement(db, {
      description: "Passage en lecture seule",
      perimetre: "Statut_Client",
      type: "habilitations",
      rollback: "annuler la règle",
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;

    const r1 = lierChangement(db, {
      entite_carte: "champ",
      systeme: "Zoho CRM",
      module: "Comptes",
      nom: "Statut_Client",
      changement_id: c.id,
    });
    expect(r1.ok).toBe(true);
    const r2 = lierChangement(db, {
      entite_carte: "champ",
      systeme: "Zoho CRM",
      module: "Comptes",
      nom: "Statut_Client",
      changement_id: c.id,
    });
    expect(r2.ok).toBe(true);

    const total = db.prepare("SELECT COUNT(*) AS n FROM carte_journal").get() as { n: number };
    expect(total.n).toBe(1);
  });

  it("échoue proprement sur un changement ou un élément inconnu", () => {
    contexte = creerDbTemp();
    const db = contexte.db;
    decrireSysteme(db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(db, { systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client" });
    const c = enregistrerChangement(db, {
      description: "x",
      perimetre: "y",
      type: "autre",
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;

    const r2 = lierChangement(db, {
      entite_carte: "champ",
      systeme: "Zoho CRM",
      module: "Comptes",
      nom: "Inconnu",
      changement_id: c.id,
    });
    expect(r2.ok).toBe(false);

    const r3 = lierChangement(db, {
      entite_carte: "champ",
      systeme: "Zoho CRM",
      module: "Comptes",
      nom: "Statut_Client",
      changement_id: "inconnu",
    });
    expect(r3.ok).toBe(false);
  });
});

describe("enregistrer_changement — propositions de liens", () => {
  it("propose un lien quand le périmètre contient un nom résolu dans la carte", () => {
    contexte = creerDbTemp();
    const db = contexte.db;
    decrireSysteme(db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(db, { systeme: "Zoho CRM", nom: "Comptes" });
    decrireChamp(db, { systeme: "Zoho CRM", module: "Comptes", nom: "Statut_Client" });

    const r = enregistrerChangement(db, {
      description: "Passage en lecture seule",
      perimetre: "Champ Statut_Client du module Comptes",
      type: "habilitations",
      rollback: "annuler",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.liens_proposes).toBeDefined();
    expect(r.liens_proposes?.some((l) => l.entite_carte === "champ" && l.nom === "Statut_Client")).toBe(
      true
    );
    expect(r.liens_proposes?.some((l) => l.entite_carte === "module" && l.nom === "Comptes")).toBe(true);

    // Aucune écriture silencieuse : carte_journal reste vide tant que lier_changement
    // n'a pas été rappelé explicitement.
    const total = db.prepare("SELECT COUNT(*) AS n FROM carte_journal").get() as { n: number };
    expect(total.n).toBe(0);
  });

  it("ne propose rien quand le périmètre ne mentionne aucun élément connu", () => {
    contexte = creerDbTemp();
    const r = enregistrerChangement(contexte.db, {
      description: "x",
      perimetre: "quelque chose de totalement inconnu",
      type: "autre",
      rollback: "y",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.liens_proposes).toBeUndefined();
  });
});
