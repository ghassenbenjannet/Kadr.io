// Rendu minimal du sous-ensemble markdown produit par rapport/hebdo.ts :
// titres (# / ##), lignes à puce "— ...", paragraphes. Évite une dépendance
// de parsing markdown complète pour un format que le serveur contrôle
// entièrement.

import type { JSX } from "react";

export function rendreMarkdownLeger(source: string): JSX.Element[] {
  const lignes = source.split("\n");
  const elements: JSX.Element[] = [];
  let puces: string[] = [];
  let cle = 0;

  function viderPuces() {
    if (puces.length === 0) return;
    elements.push(
      <ul key={`ul-${cle++}`}>
        {puces.map((texte, i) => (
          <li key={i}>{texte}</li>
        ))}
      </ul>
    );
    puces = [];
  }

  for (const ligneBrute of lignes) {
    const ligne = ligneBrute.trimEnd();
    if (ligne.startsWith("## ")) {
      viderPuces();
      elements.push(<h2 key={`h2-${cle++}`}>{ligne.slice(3)}</h2>);
    } else if (ligne.startsWith("# ")) {
      viderPuces();
      elements.push(<h1 key={`h1-${cle++}`}>{ligne.slice(2)}</h1>);
    } else if (ligne.startsWith("— ")) {
      puces.push(ligne.slice(2));
    } else if (ligne.trim().length > 0) {
      viderPuces();
      elements.push(<p key={`p-${cle++}`}>{ligne}</p>);
    }
  }
  viderPuces();

  return elements;
}
