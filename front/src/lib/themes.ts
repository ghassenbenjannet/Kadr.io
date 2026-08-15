// Registre des thèmes (Jalon 4, Prompt M). Un thème ne change QUE la couche
// primitive (primitives.css) — la couche sémantique et tous les composants
// restent inchangés. Voir docs/design-tokens.md.
//
// App mono-utilisateur : persistance en localStorage, pas de justification
// pour une table DB.

export type NomTheme = "console" | "papier";

export interface DefinitionTheme {
  nom: NomTheme;
  label: string;
  description: string;
}

export const THEMES: DefinitionTheme[] = [
  { nom: "console", label: "Console", description: "Neutres froids, encre presque noire (par défaut)" },
  { nom: "papier", label: "Papier", description: "Kraft d'archive, encre brun-noir sur papier chaud" },
];

const CLE_STOCKAGE = "registre-si-theme";
const THEME_DEFAUT: NomTheme = "console";

function estNomTheme(valeur: string | null): valeur is NomTheme {
  return valeur === "console" || valeur === "papier";
}

export function themeInitial(): NomTheme {
  if (typeof window === "undefined") return THEME_DEFAUT;
  const stocke = window.localStorage.getItem(CLE_STOCKAGE);
  return estNomTheme(stocke) ? stocke : THEME_DEFAUT;
}

/** Applique le thème au document (attribut data-theme sur <html>) et le persiste. */
export function appliquerTheme(theme: NomTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(CLE_STOCKAGE, theme);
}

export function themeSuivant(theme: NomTheme): NomTheme {
  const index = THEMES.findIndex((t) => t.nom === theme);
  return THEMES[(index + 1) % THEMES.length]!.nom;
}
