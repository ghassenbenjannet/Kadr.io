// Mise en page HTML minimale, CSS inline, sans framework — les interdits du CDC tiennent.

const CSS = `
  :root {
    color-scheme: light;
    --fond: #ffffff;
    --texte: #1f2430;
    --bordure: #d8dce3;
    --tete: #f4f5f7;
    --lien: #2454b0;
    --alerte: #a5350a;
    --alerte-fond: #fdf1ec;
    --muted: #6b7280;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 0 1.5rem 3rem;
    background: var(--fond);
    color: var(--texte);
    line-height: 1.5;
  }
  header {
    padding: 1.25rem 0 0.5rem;
    border-bottom: 1px solid var(--bordure);
    margin-bottom: 1.5rem;
  }
  h1 { font-size: 1.4rem; margin: 0 0 0.5rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 0.75rem; }
  nav { display: flex; gap: 1rem; flex-wrap: wrap; }
  nav a {
    color: var(--lien);
    text-decoration: none;
    font-size: 0.9rem;
    padding: 0.25rem 0;
  }
  nav a.actif { font-weight: 600; border-bottom: 2px solid var(--lien); }
  nav a:hover { text-decoration: underline; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; font-size: 0.9rem; }
  th, td {
    border: 1px solid var(--bordure);
    padding: 0.4rem 0.6rem;
    text-align: left;
    vertical-align: top;
  }
  th { background: var(--tete); font-weight: 600; white-space: nowrap; }
  td.centre, th.centre { text-align: center; }
  .non-declare { color: var(--muted); font-style: italic; }
  .masque { color: var(--muted); }
  .editable { font-weight: 600; }
  .alerte {
    background: var(--alerte-fond);
    color: var(--alerte);
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    margin: 0.5rem 0;
  }
  .muted { color: var(--muted); }
  ul.constats { list-style: none; padding: 0; margin: 0 0 1rem; }
  ul.constats li {
    padding: 0.5rem 0.75rem;
    border-left: 3px solid var(--alerte);
    background: var(--alerte-fond);
    margin-bottom: 0.5rem;
    border-radius: 0 4px 4px 0;
  }
  select { padding: 0.3rem 0.5rem; font-size: 0.9rem; }
  footer { margin-top: 3rem; color: var(--muted); font-size: 0.8rem; }
`;

export interface OptionsPage {
  /** Inclure la barre de navigation entre les 4 pages (absente pour un export autonome). */
  navigation?: boolean;
  cheminActif?: string;
}

const PAGES_NAV = [
  { chemin: "/", label: "Matrice d'habilitations" },
  { chemin: "/champs", label: "Champs par source de vérité" },
  { chemin: "/integrations", label: "Carte des intégrations" },
  { chemin: "/constats", label: "Constats ouverts" },
];

export function page(titre: string, corps: string, options: OptionsPage = {}): string {
  const nav =
    options.navigation === false
      ? ""
      : `<nav>${PAGES_NAV.map(
          (p) =>
            `<a href="${p.chemin}"${p.chemin === options.cheminActif ? ' class="actif"' : ""}>${p.label}</a>`
        ).join("")}</nav>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${titre} — Registre SI</title>
<style>${CSS}</style>
</head>
<body>
<header>
<h1>${titre}</h1>
${nav}
</header>
${corps}
<footer>Registre SI — généré le ${new Date().toLocaleString("fr-FR", { timeZone: "UTC" })} UTC</footer>
</body>
</html>
`;
}

export function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
