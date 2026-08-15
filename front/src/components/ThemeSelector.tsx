import { useState } from "react";
import { SwatchBook } from "lucide-react";
import { THEMES, appliquerTheme, themeInitial, themeSuivant, type NomTheme } from "../lib/themes";

/** Icône, pas un écran dédié — bascule console/papier, visible sur tous les écrans (infrastructure transverse, hors du gel §1 Jalon 4). */
export function ThemeSelector() {
  const [theme, setTheme] = useState<NomTheme>(() => themeInitial());
  const definition = THEMES.find((t) => t.nom === theme)!;
  const suivant = THEMES.find((t) => t.nom === themeSuivant(theme))!;

  function basculer() {
    const nouveau = themeSuivant(theme);
    appliquerTheme(nouveau);
    setTheme(nouveau);
  }

  return (
    <button
      className="sidebar__theme"
      onClick={basculer}
      title={`Thème : ${definition.label} — cliquer pour passer à ${suivant.label}`}
      aria-label={`Changer de thème (actuel : ${definition.label})`}
    >
      <SwatchBook size={16} aria-hidden="true" />
    </button>
  );
}
