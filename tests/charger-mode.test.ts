import { describe, expect, it } from "vitest";
import { MODES, chargerMode } from "../src/agent/modes.js";
import { chargerModeOutil } from "../src/tools/charger-mode.js";

describe("agent/modes", () => {
  it("charge le contenu de chaque mode déclaré", () => {
    for (const mode of MODES) {
      const contenu = chargerMode(mode.cle);
      expect(contenu).not.toBeNull();
      expect(contenu!.length).toBeGreaterThan(50);
      expect(contenu).toContain(mode.titre);
    }
  });

  it("retourne null pour un mode inconnu", () => {
    expect(chargerMode("n'existe pas")).toBeNull();
  });
});

describe("charger_mode (outil)", () => {
  it("retourne les instructions pour un mode valide", () => {
    const r = chargerModeOutil({ mode: "analyse" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("analyse");
    expect(r.instructions).toContain("Analyse de demande");
  });

  it("refuse un mode inconnu", () => {
    const r = chargerModeOutil({ mode: "n'existe pas" as never });
    expect(r.ok).toBe(false);
  });
});
