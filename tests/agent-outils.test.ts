import { describe, expect, it } from "vitest";
import { catalogueOutils, outilParNom, schemasAnthropic } from "../src/agent/outils.js";

describe("agent/outils — catalogue et adaptateur", () => {
  it("expose au moins les outils de lecture et d'écriture attendus", () => {
    const catalogue = catalogueOutils();
    const noms = catalogue.map((d) => d.nom);
    expect(noms).toEqual(expect.arrayContaining(["enregistrer_demande", "rechercher_journal", "impact"]));
  });

  it("lancer_controles est classé en lecture", () => {
    const def = outilParNom("lancer_controles");
    expect(def?.nature).toBe("lecture");
  });

  it("chaque outil d'écriture attendu est bien classé écriture", () => {
    const ecritures = [
      "enregistrer_demande",
      "mettre_a_jour_demande",
      "enregistrer_decision",
      "enregistrer_changement",
      "enregistrer_incident",
      "decrire_systeme",
      "decrire_module",
      "decrire_champ",
      "decrire_habilitation",
      "decrire_integration",
      "decrire_automatisation",
      "lier_changement",
      "zoho_configurer",
      "creer_projet",
      "creer_epic",
      "creer_ticket",
      "mettre_a_jour_ticket",
      "creer_plan_test",
      "executer_cas_test",
      "lier_ticket_plan_test",
      "lier_projet_demande",
      "mettre_a_jour_projet",
      "mettre_a_jour_epic",
      "mettre_a_jour_decision",
      "mettre_a_jour_changement",
      "mettre_a_jour_incident",
      "creer_document",
      "mettre_a_jour_document",
    ];
    for (const nom of ecritures) {
      expect(outilParNom(nom)?.nature).toBe("ecriture");
    }
  });

  it("chaque outil de lecture attendu est bien classé lecture", () => {
    const lectures = [
      "rechercher_journal",
      "constats_ouverts",
      "lancer_controles",
      "generer_rapport",
      "impact",
      "etat_projet",
      "lire_document",
      "rechercher_connaissance",
      "charger_mode",
    ];
    for (const nom of lectures) {
      expect(outilParNom(nom)?.nature).toBe("lecture");
    }
  });

  it("produit un JSON Schema valide avec une description française non vide pour chaque outil", () => {
    const schemas = schemasAnthropic();
    expect(schemas.length).toBe(catalogueOutils().length);
    for (const s of schemas) {
      expect(s.name).toBeTruthy();
      expect(s.description.length).toBeGreaterThan(10);
      expect(s.input_schema).toBeTypeOf("object");
      expect((s.input_schema as { type?: string }).type).toBe("object");
    }
  });

  it("le schéma de enregistrer_demande liste ses champs requis", () => {
    const schemas = schemasAnthropic();
    const demande = schemas.find((s) => s.name === "enregistrer_demande");
    expect(demande).toBeDefined();
    const schema = demande!.input_schema as { required?: string[]; properties?: Record<string, unknown> };
    expect(schema.required).toEqual(expect.arrayContaining(["demandeur", "equipe", "expression_brute", "type"]));
    expect(schema.properties).toHaveProperty("priorite");
  });
});
