// Garde-fou d'architecture (§2 + §7.8 de la spec Jalon 4, renforcé sur
// demande explicite) : src/mcp/** ne doit jamais importer directement un
// fichier de src/tools/*, ni @anthropic-ai/sdk, agent/client.ts,
// agent/boucle.ts ou agent/prompt.ts. Seuls agent/outils.ts,
// agent/ecritures.ts, agent/avertissements.ts et db/** sont autorisés côté
// src — le reste (node builtins, @modelcontextprotocol/sdk, zod, etc.) est
// libre. Conséquence : la liste d'outils MCP ne peut être qu'une dérivation
// de catalogueOutils(), jamais une liste écrite à la main important
// directement les modules d'outils.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const RACINE_SRC = new URL("../src", import.meta.url).pathname;
const RACINE_MCP = join(RACINE_SRC, "mcp");

const FICHIERS_AUTORISES_SRC = new Set(["agent/outils.ts", "agent/ecritures.ts", "agent/avertissements.ts"]);
const PREFIXE_AUTORISE_SRC = "db/";

function listerFichiersTs(dossier: string): string[] {
  const resultats: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      resultats.push(...listerFichiersTs(chemin));
    } else if (chemin.endsWith(".ts")) {
      resultats.push(chemin);
    }
  }
  return resultats;
}

function extraireSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const regex = /(?:import|export)(?:[^'"]*?from)?\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source))) {
    specifiers.push(m[1]!);
  }
  return specifiers;
}

describe("frontière d'imports src/mcp/**", () => {
  const fichiers = listerFichiersTs(RACINE_MCP);
  it("scanne au moins un fichier (le test n'est pas vide par erreur)", () => {
    expect(fichiers.length).toBeGreaterThan(0);
  });

  for (const fichier of fichiers) {
    const relatif = relative(RACINE_MCP, fichier);
    it(`${relatif} : n'importe que agent/outils.ts, agent/ecritures.ts, agent/avertissements.ts, db/** côté src`, () => {
      const source = readFileSync(fichier, "utf-8");
      const specifiers = extraireSpecifiers(source);

      for (const specifier of specifiers) {
        // Import explicitement interdit même s'il n'est pas relatif.
        expect(specifier).not.toBe("@anthropic-ai/sdk");

        if (!specifier.startsWith(".")) continue; // package externe ou node: — libre

        const cible = resolve(dirname(fichier), specifier).replace(/\.js$/, ".ts");
        const relatifSrc = relative(RACINE_SRC, cible);

        const autorise =
          FICHIERS_AUTORISES_SRC.has(relatifSrc) || relatifSrc.startsWith(PREFIXE_AUTORISE_SRC);

        expect(
          autorise,
          `${relatif} importe "${specifier}" (résolu : src/${relatifSrc}) — hors de la liste autorisée`
        ).toBe(true);

        // Jamais un import direct dans src/tools/, ni les modules IA interdits.
        expect(relatifSrc.startsWith("tools/")).toBe(false);
        expect(relatifSrc).not.toBe("agent/client.ts");
        expect(relatifSrc).not.toBe("agent/boucle.ts");
        expect(relatifSrc).not.toBe("agent/prompt.ts");
      }
    });
  }
});
