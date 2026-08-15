import { afterEach, describe, expect, it } from "vitest";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";
import { decrireSysteme } from "../src/tools/decrire-systeme.js";
import { decrireModule } from "../src/tools/decrire-module.js";
import { decrireChamp } from "../src/tools/decrire-champ.js";
import { decrireHabilitation } from "../src/tools/decrire-habilitation.js";
import { decrireIntegration } from "../src/tools/decrire-integration.js";
import { decrireAutomatisation } from "../src/tools/decrire-automatisation.js";

let contexte: DbTemp;

afterEach(() => {
  if (contexte) fermerDbTemp(contexte);
});

describe("decrire_systeme", () => {
  it("upsert par nom : rappeler avec le même nom complète sans dupliquer", () => {
    contexte = creerDbTemp();
    const r1 = decrireSysteme(contexte.db, { nom: "Zoho CRM", role: "CRM principal" });
    expect(r1.ok).toBe(true);
    const r2 = decrireSysteme(contexte.db, { nom: "Zoho CRM", editeur: "Zoho" });
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.id).toBe(r1.id);

    const total = contexte.db.prepare("SELECT COUNT(*) AS n FROM systemes").get() as { n: number };
    expect(total.n).toBe(1);

    const ligne = contexte.db.prepare("SELECT role, editeur FROM systemes WHERE nom = 'Zoho CRM'").get() as {
      role: string;
      editeur: string;
    };
    expect(ligne.role).toBe("CRM principal");
    expect(ligne.editeur).toBe("Zoho");
  });
});

describe("decrire_champ — création à la volée des parents", () => {
  it("crée système et module manquants, et le signale", () => {
    contexte = creerDbTemp();
    const r = decrireChamp(contexte.db, {
      systeme: "App Devis",
      module: "Devis",
      nom: "Statut_Client",
      source_de_verite: "App Devis",
      editable: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.avertissements.some((a) => a.includes("Système « App Devis » créé"))).toBe(true);
    expect(r.avertissements.some((a) => a.includes("Module « Devis » créé"))).toBe(true);

    const systeme = contexte.db.prepare("SELECT nom FROM systemes WHERE nom = 'App Devis'").get();
    expect(systeme).toBeTruthy();
    const module = contexte.db.prepare("SELECT nom FROM modules WHERE nom = 'Devis'").get();
    expect(module).toBeTruthy();
  });

  it("upsert par nom au sein du module : ne duplique pas", () => {
    contexte = creerDbTemp();
    decrireChamp(contexte.db, { systeme: "App Devis", module: "Devis", nom: "Statut_Client" });
    const r2 = decrireChamp(contexte.db, {
      systeme: "App Devis",
      module: "Devis",
      nom: "Statut_Client",
      source_de_verite: "App Devis",
    });
    expect(r2.ok).toBe(true);
    const total = contexte.db.prepare("SELECT COUNT(*) AS n FROM champs").get() as { n: number };
    expect(total.n).toBe(1);
    const ligne = contexte.db.prepare("SELECT source_de_verite FROM champs").get() as {
      source_de_verite: string;
    };
    expect(ligne.source_de_verite).toBe("App Devis");
  });

  it("pas d'avertissement quand système et module existent déjà", () => {
    contexte = creerDbTemp();
    decrireSysteme(contexte.db, { nom: "Zoho CRM", role: "CRM" });
    decrireModule(contexte.db, { systeme: "Zoho CRM", nom: "Comptes" });
    const r = decrireChamp(contexte.db, { systeme: "Zoho CRM", module: "Comptes", nom: "Statut" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.avertissements).toHaveLength(0);
  });
});

describe("decrire_habilitation", () => {
  it("crée la chaîne système/module/champ à la volée", () => {
    contexte = creerDbTemp();
    const r = decrireHabilitation(contexte.db, {
      profil: "ADV",
      systeme: "Zoho CRM",
      module: "Comptes",
      champ: "Statut_Client",
      visible: true,
      editable: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.avertissements.length).toBeGreaterThan(0);
  });

  it("upsert par (profil, champ)", () => {
    contexte = creerDbTemp();
    decrireHabilitation(contexte.db, {
      profil: "ADV",
      systeme: "Zoho CRM",
      module: "Comptes",
      champ: "Statut_Client",
      editable: true,
    });
    const r2 = decrireHabilitation(contexte.db, {
      profil: "ADV",
      systeme: "Zoho CRM",
      module: "Comptes",
      champ: "Statut_Client",
      justification: "rôle Admin délégué",
    });
    expect(r2.ok).toBe(true);
    const total = contexte.db.prepare("SELECT COUNT(*) AS n FROM habilitations").get() as { n: number };
    expect(total.n).toBe(1);
    const ligne = contexte.db.prepare("SELECT editable, justification FROM habilitations").get() as {
      editable: number;
      justification: string;
    };
    expect(ligne.editable).toBe(1);
    expect(ligne.justification).toBe("rôle Admin délégué");
  });
});

describe("decrire_integration — sous-listes qui remplacent", () => {
  it("upsert par nom, ne duplique pas", () => {
    contexte = creerDbTemp();
    const r1 = decrireIntegration(contexte.db, {
      nom: "Devis -> CRM",
      source: "App Devis",
      cible: "Zoho CRM",
      idempotence: "id_devis",
    });
    expect(r1.ok).toBe(true);
    const r2 = decrireIntegration(contexte.db, {
      nom: "Devis -> CRM",
      source: "App Devis",
      cible: "Zoho CRM",
      matching: "email",
    });
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.id).toBe(r1.id);
    const total = contexte.db.prepare("SELECT COUNT(*) AS n FROM integrations").get() as { n: number };
    expect(total.n).toBe(1);
    const ligne = contexte.db.prepare("SELECT idempotence, matching FROM integrations").get() as {
      idempotence: string;
      matching: string;
    };
    expect(ligne.idempotence).toBe("id_devis");
    expect(ligne.matching).toBe("email");
  });

  it("remplace la liste de champs mappés plutôt que d'ajouter", () => {
    contexte = creerDbTemp();
    decrireIntegration(contexte.db, {
      nom: "Devis -> CRM",
      source: "App Devis",
      cible: "Zoho CRM",
      champs: [{ systeme: "Zoho CRM", module: "Comptes", champ: "Statut_Client", sens: "ecrit" }],
    });
    let mappings = contexte.db.prepare("SELECT COUNT(*) AS n FROM integration_champs").get() as {
      n: number;
    };
    expect(mappings.n).toBe(1);

    decrireIntegration(contexte.db, {
      nom: "Devis -> CRM",
      source: "App Devis",
      cible: "Zoho CRM",
      champs: [
        { systeme: "Zoho CRM", module: "Comptes", champ: "Statut_Client", sens: "ecrit" },
        { systeme: "Zoho CRM", module: "Comptes", champ: "Montant", sens: "ecrit" },
      ],
    });
    mappings = contexte.db.prepare("SELECT COUNT(*) AS n FROM integration_champs").get() as { n: number };
    expect(mappings.n).toBe(2);

    // Un appel sans la clé "champs" ne touche pas la liste existante.
    decrireIntegration(contexte.db, {
      nom: "Devis -> CRM",
      source: "App Devis",
      cible: "Zoho CRM",
      auth: "OAuth2",
    });
    mappings = contexte.db.prepare("SELECT COUNT(*) AS n FROM integration_champs").get() as { n: number };
    expect(mappings.n).toBe(2);

    // Fournir une liste vide vide bien la liste.
    decrireIntegration(contexte.db, {
      nom: "Devis -> CRM",
      source: "App Devis",
      cible: "Zoho CRM",
      champs: [],
    });
    mappings = contexte.db.prepare("SELECT COUNT(*) AS n FROM integration_champs").get() as { n: number };
    expect(mappings.n).toBe(0);
  });

  it("remplace la liste d'erreurs et de métriques", () => {
    contexte = creerDbTemp();
    decrireIntegration(contexte.db, {
      nom: "Devis -> CRM",
      source: "App Devis",
      cible: "Zoho CRM",
      erreurs: [{ titre: "Timeout", nature: "technique" }],
      metriques: [{ nom: "Taux d'échec", seuil: "5%" }],
    });
    let erreurs = contexte.db.prepare("SELECT COUNT(*) AS n FROM erreurs_integration").get() as {
      n: number;
    };
    let metriques = contexte.db.prepare("SELECT COUNT(*) AS n FROM metriques").get() as { n: number };
    expect(erreurs.n).toBe(1);
    expect(metriques.n).toBe(1);

    decrireIntegration(contexte.db, {
      nom: "Devis -> CRM",
      source: "App Devis",
      cible: "Zoho CRM",
      erreurs: [
        { titre: "Timeout", nature: "technique" },
        { titre: "Client inconnu", nature: "fonctionnelle" },
      ],
    });
    erreurs = contexte.db.prepare("SELECT COUNT(*) AS n FROM erreurs_integration").get() as { n: number };
    metriques = contexte.db.prepare("SELECT COUNT(*) AS n FROM metriques").get() as { n: number };
    expect(erreurs.n).toBe(2);
    expect(metriques.n).toBe(1); // non touché, clé "metriques" absente cette fois
  });
});

describe("decrire_automatisation", () => {
  it("crée sans module (automatisation transverse)", () => {
    contexte = creerDbTemp();
    const r = decrireAutomatisation(contexte.db, {
      nom: "Relance devis",
      type: "workflow",
      declencheur: "Devis créé",
    });
    expect(r.ok).toBe(true);
  });

  it("remplace la liste de champs référencés", () => {
    contexte = creerDbTemp();
    decrireAutomatisation(contexte.db, {
      nom: "Relance devis",
      type: "workflow",
      systeme: "Zoho CRM",
      module: "Comptes",
      champs: [{ systeme: "Zoho CRM", module: "Comptes", champ: "Statut_Client", sens: "lit" }],
    });
    let mappings = contexte.db.prepare("SELECT COUNT(*) AS n FROM automatisation_champs").get() as {
      n: number;
    };
    expect(mappings.n).toBe(1);

    decrireAutomatisation(contexte.db, {
      nom: "Relance devis",
      type: "workflow",
      systeme: "Zoho CRM",
      module: "Comptes",
      champs: [
        { systeme: "Zoho CRM", module: "Comptes", champ: "Statut_Client", sens: "lit" },
        { systeme: "Zoho CRM", module: "Comptes", champ: "Date_Relance", sens: "ecrit" },
      ],
    });
    mappings = contexte.db.prepare("SELECT COUNT(*) AS n FROM automatisation_champs").get() as {
      n: number;
    };
    expect(mappings.n).toBe(2);
  });
});
