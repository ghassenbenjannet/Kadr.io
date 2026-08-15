// tone.test.ts (Jalon 4, Prompt M) : rejoue le mapping de tonalité pour
// chaque thème enregistré et vérifie que le résultat SÉMANTIQUE ne change
// jamais — un No-Go reste "danger" (famille rouge), jamais autre chose,
// quel que soit le thème actif. Voir docs/design-tokens.md.
//
// Approche : lire primitives.css comme du texte, résoudre les 4 couleurs de
// rôle (succès/attention/danger/accent) par thème, convertir en HSL et
// vérifier que chacune reste dans sa "famille" de teinte (bande de hue)
// d'un thème à l'autre — la température/luminosité peut varier (c'est même
// le but des thèmes), la famille jamais.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE_FRONT_SRC = new URL("../front/src", import.meta.url).pathname;
const PRIMITIVES_CSS = readFileSync(join(RACINE_FRONT_SRC, "primitives.css"), "utf-8");

function extraireBloc(css: string, selecteur: string): string {
  const debut = css.indexOf(selecteur);
  if (debut === -1) throw new Error(`Sélecteur introuvable : ${selecteur}`);
  const ouvrante = css.indexOf("{", debut);
  const fermante = css.indexOf("}", ouvrante);
  return css.slice(ouvrante + 1, fermante);
}

function extraireValeur(bloc: string, propriete: string): string {
  const regex = new RegExp(`${propriete}:\\s*([^;]+);`);
  const m = regex.exec(bloc);
  if (!m) throw new Error(`Propriété introuvable : ${propriete}`);
  return m[1]!.trim();
}

function hexVersHsl(hex: string): { h: number; s: number; l: number } {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    default:
      h = ((r - g) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/** Bandes de teinte (degrés, 0-360) attendues par rôle métier — larges pour tolérer un réchauffement/refroidissement entre thèmes, jamais assez pour glisser vers un autre rôle. */
const BANDES_ROLE: Record<string, [number, number]> = {
  succes: [70, 170], // verts
  attention: [20, 65], // ambre/orange
  danger: [340, 20], // rouges (traverse 0°)
  accent: [200, 280], // bleus/indigo
};

function dansBande(h: number, [debut, fin]: [number, number]): boolean {
  if (debut <= fin) return h >= debut && h <= fin;
  return h >= debut || h <= fin; // bande qui traverse 0° (rouge)
}

const THEMES = [
  { nom: "console", selecteur: ':root,\n:root[data-theme="console"]' },
  { nom: "papier", selecteur: ':root[data-theme="papier"]' },
];

interface Tonalite {
  succes: string;
  attention: string;
  danger: string;
  accent: string;
}

function tonalitePourTheme(nomTheme: string): Tonalite {
  const theme = THEMES.find((t) => t.nom === nomTheme);
  if (!theme) throw new Error(`Thème inconnu : ${nomTheme}`);
  const bloc = extraireBloc(PRIMITIVES_CSS, theme.selecteur);
  return {
    succes: extraireValeur(bloc, "--primitif-etat-succes"),
    attention: extraireValeur(bloc, "--primitif-etat-attention"),
    danger: extraireValeur(bloc, "--primitif-etat-danger"),
    accent: extraireValeur(bloc, "--primitif-accent"),
  };
}

describe("mapping de tonalité — stable par rôle, quel que soit le thème actif", () => {
  for (const { nom } of THEMES) {
    it(`thème ${nom} : succès=vert, attention=ambre, danger=rouge, accent=bleu`, () => {
      const tonalite = tonalitePourTheme(nom);
      for (const [role, hex] of Object.entries(tonalite)) {
        const { h, s, l } = hexVersHsl(hex);
        expect(dansBande(h, BANDES_ROLE[role]!), `${role} (${hex}, hue=${h.toFixed(0)}°) hors de sa bande attendue`).toBe(
          true
        );
        // Une couleur de rôle ne doit être ni un gris invisible ni un blanc/noir dégénéré.
        expect(s, `${role} (${hex}) doit être suffisamment saturée pour porter un sens`).toBeGreaterThan(20);
        expect(l, `${role} (${hex}) ne doit être ni blanc ni noir`).toBeGreaterThan(10);
        expect(l).toBeLessThan(90);
      }
    });
  }

  it("un « No-Go » (danger) reste dans la famille rouge dans tous les thèmes enregistrés", () => {
    for (const { nom } of THEMES) {
      const { danger } = tonalitePourTheme(nom);
      const { h } = hexVersHsl(danger);
      expect(dansBande(h, BANDES_ROLE.danger!), `danger du thème ${nom} (${danger}) doit rester rouge`).toBe(true);
    }
  });

  it("les 4 rôles sont mutuellement distincts dans chaque thème (rejoué par thème)", () => {
    for (const { nom } of THEMES) {
      const tonalite = tonalitePourTheme(nom);
      const valeurs = Object.values(tonalite).map((v) => v.toLowerCase());
      expect(new Set(valeurs).size, `thème ${nom}`).toBe(valeurs.length);
    }
  });
});
