// Garde-fous du système de tokens (Jalon 4, Prompt M) : voir docs/design-tokens.md.
// Ces tests lisent front/src/**/*.css et *.tsx comme du texte brut — pas
// besoin d'un navigateur, la règle vérifiée est structurelle (quel fichier a
// le droit de contenir une couleur en dur, quels tokens existent par thème).

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE_FRONT_SRC = new URL("../front/src", import.meta.url).pathname;
const PRIMITIVES_CSS = readFileSync(join(RACINE_FRONT_SRC, "primitives.css"), "utf-8");
const SEMANTIQUE_CSS = readFileSync(join(RACINE_FRONT_SRC, "semantique.css"), "utf-8");

const REGEX_COULEUR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

function listerFichiers(dossier: string, extensions: string[]): string[] {
  const resultats: string[] = [];
  for (const entree of readdirSync(dossier)) {
    if (entree === "node_modules") continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      resultats.push(...listerFichiers(chemin, extensions));
    } else if (extensions.some((ext) => chemin.endsWith(ext))) {
      resultats.push(chemin);
    }
  }
  return resultats;
}

/** Extrait le bloc de déclarations d'un sélecteur donné (une seule occurrence attendue). */
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

describe("aucune couleur en dur hors des fichiers de tokens", () => {
  const fichiersCss = listerFichiers(RACINE_FRONT_SRC, [".css"]).filter(
    (f) => !f.endsWith("primitives.css") && !f.endsWith("semantique.css")
  );
  const fichiersComposants = listerFichiers(RACINE_FRONT_SRC, [".tsx", ".ts"]);

  it("scanne au moins les fichiers attendus (le test n'est pas vide par erreur)", () => {
    expect(fichiersCss.length).toBeGreaterThan(0);
    expect(fichiersComposants.length).toBeGreaterThan(0);
  });

  for (const fichier of fichiersCss) {
    it(`${fichier.replace(RACINE_FRONT_SRC, "front/src")} : aucune couleur hex/rgb en dur`, () => {
      const source = readFileSync(fichier, "utf-8");
      const trouvailles = source.match(REGEX_COULEUR) ?? [];
      expect(trouvailles).toEqual([]);
    });
  }

  for (const fichier of fichiersComposants) {
    it(`${fichier.replace(RACINE_FRONT_SRC, "front/src")} : aucune couleur hex/rgb en dur`, () => {
      const source = readFileSync(fichier, "utf-8");
      const trouvailles = source.match(REGEX_COULEUR) ?? [];
      expect(trouvailles).toEqual([]);
    });
  }
});

describe("semantique.css : mapping fixe, jamais de conditionnel par thème", () => {
  it("ne contient aucun sélecteur [data-theme]", () => {
    expect(SEMANTIQUE_CSS).not.toMatch(/\[data-theme=/);
  });

  it("déclare chaque token d'état et l'accent exactement une fois", () => {
    for (const token of ["--etat-succes:", "--etat-attention:", "--etat-danger:", "--accent:"]) {
      const occurrences = SEMANTIQUE_CSS.split(token).length - 1;
      expect(occurrences, `${token} doit apparaître une seule fois dans semantique.css`).toBe(1);
    }
  });
});

describe("primitives.css : chaque thème enregistré a ses 3 couleurs d'état + accent, mutuellement distinctes", () => {
  const THEMES = [
    { nom: "console", selecteur: ':root,\n:root[data-theme="console"]' },
    { nom: "papier", selecteur: ':root[data-theme="papier"]' },
  ];

  for (const { nom, selecteur } of THEMES) {
    it(`thème ${nom}`, () => {
      const bloc = extraireBloc(PRIMITIVES_CSS, selecteur);
      const succes = extraireValeur(bloc, "--primitif-etat-succes");
      const attention = extraireValeur(bloc, "--primitif-etat-attention");
      const danger = extraireValeur(bloc, "--primitif-etat-danger");
      const accent = extraireValeur(bloc, "--primitif-accent");

      for (const valeur of [succes, attention, danger, accent]) {
        expect(valeur).toMatch(/^#[0-9a-fA-F]{6}$/);
      }

      const valeurs = [succes, attention, danger, accent];
      const uniques = new Set(valeurs.map((v) => v.toLowerCase()));
      expect(uniques.size, "succès/attention/danger/accent doivent être mutuellement distincts").toBe(
        valeurs.length
      );
    });
  }
});
