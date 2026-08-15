import { describe, expect, it } from "vitest";
import {
  controleC1,
  controleC2,
  controleC3,
  controleC4,
  controleC5,
  controleC6,
  SEUILS,
  type ChangementRow,
  type DecisionRow,
  type DemandeRow,
  type IncidentRow,
} from "../src/controles/pratique.js";

const MAINTENANT = new Date("2026-08-15T12:00:00.000Z");

function ilYA(jours: number): string {
  const d = new Date(MAINTENANT);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString();
}

function changement(overrides: Partial<ChangementRow>): ChangementRow {
  return {
    id: "c1",
    cree_le: ilYA(1),
    rollback: null,
    test_effectue: null,
    demande_id: null,
    decision_id: null,
    ...overrides,
  };
}

describe("controle C1 — retour arrière", () => {
  it("déclenche quand rollback absent et changement âgé", () => {
    const r = controleC1([changement({ rollback: null, cree_le: ilYA(1) })], MAINTENANT);
    expect(r).toHaveLength(1);
    expect(r[0]?.controle).toBe("C1");
    expect(r[0]?.consequence).toBe(
      "Aucun retour arrière déclaré : un incident sur ce changement se traitera en improvisation."
    );
  });

  it("ne déclenche pas quand rollback renseigné", () => {
    const r = controleC1([changement({ rollback: "désactiver la règle", cree_le: ilYA(5) })], MAINTENANT);
    expect(r).toHaveLength(0);
  });

  it("ne déclenche pas le jour même (âge = 0)", () => {
    const r = controleC1([changement({ rollback: null, cree_le: MAINTENANT.toISOString() })], MAINTENANT);
    expect(r).toHaveLength(0);
  });
});

describe("controle C2 — test", () => {
  it("déclenche quand test_effectue absent", () => {
    const r = controleC2([changement({ test_effectue: null })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe(
      "Aucun test déclaré : la recette de ce changement, c'est l'utilisateur en production."
    );
  });

  it("ne déclenche pas quand test_effectue renseigné", () => {
    const r = controleC2([changement({ test_effectue: "testé avec Sophie" })]);
    expect(r).toHaveLength(0);
  });
});

describe("controle C3 — origine", () => {
  it("déclenche sans demande ni décision", () => {
    const r = controleC3([changement({ demande_id: null, decision_id: null })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe(
      "Changement sans origine : le SI dérive sans trace de qui a demandé quoi."
    );
  });

  it("ne déclenche pas avec une demande liée", () => {
    const r = controleC3([changement({ demande_id: "d1", decision_id: null })]);
    expect(r).toHaveLength(0);
  });
});

describe("controle C4 — décision validée", () => {
  function decision(overrides: Partial<DecisionRow>): DecisionRow {
    return { id: "dec1", statut: "appliquee", decideur: "moi", ...overrides };
  }

  it("déclenche quand appliquée par 'moi' (auto-validation)", () => {
    const r = controleC4([decision({ statut: "appliquee", decideur: "moi" })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe(
      "Décision appliquée jamais validée : engagement pris sans couverture du décideur."
    );
  });

  it("ne déclenche pas quand décidée par le CEO", () => {
    const r = controleC4([decision({ statut: "appliquee", decideur: "CEO" })]);
    expect(r).toHaveLength(0);
  });

  it("ne déclenche pas quand non appliquée", () => {
    const r = controleC4([decision({ statut: "validee", decideur: "moi" })]);
    expect(r).toHaveLength(0);
  });
});

describe("controle C5 — demande en attente", () => {
  function demande(overrides: Partial<DemandeRow>): DemandeRow {
    return { id: "dem1", cree_le: ilYA(10), statut: "recue", equipe: "CS", ...overrides };
  }

  it(`ne déclenche pas exactement au seuil (${SEUILS.demandeEnAttenteJours} j)`, () => {
    const r = controleC5([demande({ cree_le: ilYA(SEUILS.demandeEnAttenteJours) })], MAINTENANT);
    expect(r).toHaveLength(0);
  });

  it(`déclenche juste après le seuil (${SEUILS.demandeEnAttenteJours + 1} j)`, () => {
    const r = controleC5([demande({ cree_le: ilYA(SEUILS.demandeEnAttenteJours + 1) })], MAINTENANT);
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe(
      "Demande en attente depuis 15 jours : la confiance de l'équipe CS s'érode en silence."
    );
  });

  it("ne déclenche pas pour un statut déjà arbitré", () => {
    const r = controleC5([demande({ statut: "arbitree", cree_le: ilYA(30) })], MAINTENANT);
    expect(r).toHaveLength(0);
  });
});

describe("controle C6 — action préventive", () => {
  function incident(overrides: Partial<IncidentRow>): IncidentRow {
    return { id: "i1", resolu_le: ilYA(1), action_preventive: null, ...overrides };
  }

  it("déclenche quand résolu sans action préventive", () => {
    const r = controleC6([incident({ resolu_le: ilYA(1), action_preventive: null })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe(
      "Incident résolu sans action préventive : le même incident reviendra."
    );
  });

  it("ne déclenche pas avec une action préventive déclarée", () => {
    const r = controleC6([incident({ resolu_le: ilYA(1), action_preventive: "ajout d'une validation" })]);
    expect(r).toHaveLength(0);
  });

  it("ne déclenche pas si non résolu", () => {
    const r = controleC6([incident({ resolu_le: null, action_preventive: null })]);
    expect(r).toHaveLength(0);
  });
});
