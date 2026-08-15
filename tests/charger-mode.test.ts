import { describe, expect, it, afterEach } from "vitest";
import { seedModesDefaut, listerModes, chargerMode } from "../src/agent/modes.js";
import { chargerModeOutil } from "../src/tools/charger-mode.js";
import { creerDbTemp, fermerDbTemp, type DbTemp } from "./helpers.js";

describe("agent/modes", () => {
  let temp: DbTemp;

  afterEach(() => {
    if (temp) fermerDbTemp(temp);
  });

  it("amorce les 4 modes par défaut à partir des fichiers .md", () => {
    temp = creerDbTemp();
    seedModesDefaut(temp.db);
    const modes = listerModes(temp.db);
    expect(modes.length).toBe(4);
    const cles = modes.map((m) => m.cle).sort();
    expect(cles).toEqual(["analyse", "architecture", "livrable", "revue"]);
  });

  it("charge le contenu de chaque mode amorcé", () => {
    temp = creerDbTemp();
    seedModesDefaut(temp.db);
    for (const mode of listerModes(temp.db)) {
      const contenu = chargerMode(temp.db, mode.cle);
      expect(contenu).not.toBeNull();
      expect(contenu!.length).toBeGreaterThan(50);
      expect(contenu).toContain(mode.titre);
    }
  });

  it("ne réamorce pas si la table contient déjà des modes", () => {
    temp = creerDbTemp();
    seedModesDefaut(temp.db);
    seedModesDefaut(temp.db);
    expect(listerModes(temp.db).length).toBe(4);
  });

  it("retourne null pour un mode inconnu", () => {
    temp = creerDbTemp();
    expect(chargerMode(temp.db, "n'existe pas")).toBeNull();
  });
});

describe("charger_mode (outil)", () => {
  let temp: DbTemp;

  afterEach(() => {
    if (temp) fermerDbTemp(temp);
  });

  it("retourne les instructions pour un mode valide", () => {
    temp = creerDbTemp();
    seedModesDefaut(temp.db);
    const r = chargerModeOutil(temp.db, { mode: "analyse" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mode).toBe("analyse");
    expect(r.instructions).toContain("Analyse de demande");
  });

  it("refuse un mode inconnu et liste les modes disponibles", () => {
    temp = creerDbTemp();
    seedModesDefaut(temp.db);
    const r = chargerModeOutil(temp.db, { mode: "n'existe pas" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreur).toContain("analyse");
  });
});
