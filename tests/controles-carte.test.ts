import { describe, expect, it } from "vitest";
import {
  controleM1,
  controleM2,
  controleM3,
  controleM4,
  SEUILS_MODELE,
  type ChampRow,
  type HabilitationRow,
  type ModuleSansChampRow,
} from "../src/controles/modele.js";
import {
  controleI1,
  controleI2,
  controleI3,
  controleI4,
  controleI5,
  controleI6,
  controleI7,
  type ErreurIntegrationRow,
  type IntegrationRow,
  type MetriqueRow,
} from "../src/controles/integration.js";

const MAINTENANT = new Date("2026-08-15T12:00:00.000Z");

function ilYA(jours: number): string {
  const d = new Date(MAINTENANT);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString();
}

function champ(overrides: Partial<ChampRow>): ChampRow {
  return {
    id: "ch1",
    nom: "Statut_Client",
    source_de_verite: null,
    editable: null,
    systeme_module_nom: "Zoho CRM",
    ...overrides,
  };
}

describe("controle M1 — source de vérité", () => {
  it("déclenche quand source_de_verite est absente", () => {
    const r = controleM1([champ({ source_de_verite: null })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe(
      "Champ sans source de vérité : aucun arbitrage possible en cas d'écart entre systèmes."
    );
  });

  it("ne déclenche pas quand source_de_verite est renseignée", () => {
    const r = controleM1([champ({ source_de_verite: "App Devis" })]);
    expect(r).toHaveLength(0);
  });
});

describe("controle M2 — éditable contredisant la source", () => {
  it("déclenche quand éditable et source différente du système du module", () => {
    const r = controleM2([
      champ({ editable: 1, source_de_verite: "App Devis", systeme_module_nom: "Zoho CRM" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe(
      "Champ éditable alors que sa source de vérité est App Devis : chaque saisie locale créera un écart silencieux."
    );
  });

  it("ne déclenche pas quand source et système du module sont identiques, casse différente", () => {
    const r = controleM2([
      champ({ editable: 1, source_de_verite: "zoho crm", systeme_module_nom: "Zoho CRM" }),
    ]);
    expect(r).toHaveLength(0);
  });

  it("ne déclenche pas quand le champ n'est pas éditable", () => {
    const r = controleM2([
      champ({ editable: 0, source_de_verite: "App Devis", systeme_module_nom: "Zoho CRM" }),
    ]);
    expect(r).toHaveLength(0);
  });
});

describe("controle M3 — habilitation sans justification", () => {
  function habilitation(overrides: Partial<HabilitationRow>): HabilitationRow {
    return { id: "hab1", editable: 1, justification: null, ...overrides };
  }

  it("déclenche quand éditable sans justification", () => {
    const r = controleM3([habilitation({ editable: 1, justification: null })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe(
      "Droit de modification accordé sans justification : indéfendable en revue d'habilitations."
    );
  });

  it("ne déclenche pas avec une justification", () => {
    const r = controleM3([habilitation({ editable: 1, justification: "rôle Admin" })]);
    expect(r).toHaveLength(0);
  });

  it("ne déclenche pas si non éditable", () => {
    const r = controleM3([habilitation({ editable: 0, justification: null })]);
    expect(r).toHaveLength(0);
  });
});

describe("controle M4 — module jamais cartographié", () => {
  function module(overrides: Partial<ModuleSansChampRow>): ModuleSansChampRow {
    return { id: "mod1", cree_le: ilYA(40), nombreChamps: 0, ...overrides };
  }

  it(`déclenche après ${SEUILS_MODELE.moduleSansChampJours} jours sans champ`, () => {
    const r = controleM4(
      [module({ cree_le: ilYA(SEUILS_MODELE.moduleSansChampJours + 1), nombreChamps: 0 })],
      MAINTENANT
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe("Module déclaré mais jamais cartographié : angle mort du SI.");
  });

  it("ne déclenche pas si des champs existent", () => {
    const r = controleM4([module({ cree_le: ilYA(60), nombreChamps: 3 })], MAINTENANT);
    expect(r).toHaveLength(0);
  });

  it("ne déclenche pas avant le seuil", () => {
    const r = controleM4(
      [module({ cree_le: ilYA(SEUILS_MODELE.moduleSansChampJours), nombreChamps: 0 })],
      MAINTENANT
    );
    expect(r).toHaveLength(0);
  });
});

function integration(overrides: Partial<IntegrationRow>): IntegrationRow {
  return {
    id: "int1",
    idempotence: "id_devis",
    matching: "email",
    regle_vide: "ignorer",
    procedure_reprise: "relancer le batch",
    nombreMetriques: 1,
    ...overrides,
  };
}

describe("controle I1 — idempotence", () => {
  it("déclenche sans clé d'idempotence", () => {
    const r = controleI1([integration({ idempotence: null })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.consequence).toBe(
      "Pas de clé d'idempotence : un rejeu après incident créera des doublons."
    );
  });
  it("ne déclenche pas avec une clé", () => {
    expect(controleI1([integration({ idempotence: "id_devis" })])).toHaveLength(0);
  });
});

describe("controle I2 — rapprochement", () => {
  it("déclenche sans règle de rapprochement", () => {
    const r = controleI2([integration({ matching: null })]);
    expect(r).toHaveLength(1);
  });
  it("ne déclenche pas avec une règle", () => {
    expect(controleI2([integration({ matching: "email" })])).toHaveLength(0);
  });
});

describe("controle I3 — valeur vide", () => {
  it("déclenche sans règle de valeur vide", () => {
    expect(controleI3([integration({ regle_vide: null })])).toHaveLength(1);
  });
  it("ne déclenche pas avec une règle", () => {
    expect(controleI3([integration({ regle_vide: "ignorer" })])).toHaveLength(0);
  });
});

describe("controle I4 — nature de l'erreur", () => {
  function erreur(overrides: Partial<ErreurIntegrationRow>): ErreurIntegrationRow {
    return { id: "err1", nature: null, ...overrides };
  }
  it("déclenche sans nature", () => {
    const r = controleI4([erreur({ nature: null })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.entite).toBe("erreur_integration");
  });
  it("ne déclenche pas avec une nature", () => {
    expect(controleI4([erreur({ nature: "technique" })])).toHaveLength(0);
  });
});

describe("controle I5 — procédure de reprise", () => {
  it("déclenche sans procédure", () => {
    expect(controleI5([integration({ procedure_reprise: null })])).toHaveLength(1);
  });
  it("ne déclenche pas avec une procédure", () => {
    expect(controleI5([integration({ procedure_reprise: "relancer le batch" })])).toHaveLength(0);
  });
});

describe("controle I6 — seuil de métrique", () => {
  function metrique(overrides: Partial<MetriqueRow>): MetriqueRow {
    return { id: "m1", seuil: null, ...overrides };
  }
  it("déclenche sans seuil", () => {
    const r = controleI6([metrique({ seuil: null })]);
    expect(r).toHaveLength(1);
    expect(r[0]?.entite).toBe("metrique");
  });
  it("ne déclenche pas avec un seuil", () => {
    expect(controleI6([metrique({ seuil: "> 5% d'échecs" })])).toHaveLength(0);
  });
});

describe("controle I7 — supervision", () => {
  it("déclenche sans aucune métrique", () => {
    expect(controleI7([integration({ nombreMetriques: 0 })])).toHaveLength(1);
  });
  it("ne déclenche pas avec au moins une métrique", () => {
    expect(controleI7([integration({ nombreMetriques: 1 })])).toHaveLength(0);
  });
});
