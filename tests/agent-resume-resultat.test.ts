import { describe, expect, it } from "vitest";
import { resumerResultatLecture } from "../src/agent/resume-resultat.js";

describe("resumerResultatLecture", () => {
  it("compte le premier tableau trouvé dans le résultat", () => {
    expect(resumerResultatLecture({ ok: true, resultats: [1, 2, 3] })).toBe("3 résultats");
    expect(resumerResultatLecture({ ok: true, constats: [1] })).toBe("1 résultat");
  });

  it("retourne l'erreur si ok:false", () => {
    expect(resumerResultatLecture({ ok: false, erreur: "Champ introuvable" })).toBe("Champ introuvable");
  });

  it("retombe sur 'terminé' sans tableau ni erreur", () => {
    expect(resumerResultatLecture({ ok: true, markdown: "# Rapport" })).toBe("terminé");
    expect(resumerResultatLecture(null)).toBe("terminé");
  });
});
