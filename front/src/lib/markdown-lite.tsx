// Rendu minimal du sous-ensemble markdown produit côté serveur (rapport
// hebdo, documents, agents) ET par l'assistant en conversation (réponses
// Claude — gras, listes à tiret standard, tableaux). Évite une dépendance de
// parsing markdown complète : ce sous-ensemble couvre ce qu'on observe
// réellement en sortie (titres, paragraphes, listes à puces/numérotées,
// tableaux, gras, code inline), pas la totalité de CommonMark.

import type { JSX } from "react";

type Inline = string | JSX.Element;

/** `**gras**`, `*italique*` et `` `code` `` à l'intérieur d'une ligne, sans imbrication.
 * L'alternative gras est tentée avant l'italique pour que "**x**" ne soit pas lu comme
 * un italique vide suivi de texte puis d'un autre italique vide. */
function rendreInline(texte: string, clePrefixe: string): Inline[] {
  const parties: Inline[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let dernierIndex = 0;
  let cle = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texte))) {
    if (m.index > dernierIndex) parties.push(texte.slice(dernierIndex, m.index));
    const jeton = m[0];
    if (jeton.startsWith("**")) {
      parties.push(<strong key={`${clePrefixe}-b-${cle++}`}>{jeton.slice(2, -2)}</strong>);
    } else if (jeton.startsWith("`")) {
      parties.push(<code key={`${clePrefixe}-c-${cle++}`}>{jeton.slice(1, -1)}</code>);
    } else {
      parties.push(<em key={`${clePrefixe}-i-${cle++}`}>{jeton.slice(1, -1)}</em>);
    }
    dernierIndex = m.index + jeton.length;
  }
  if (dernierIndex < texte.length) parties.push(texte.slice(dernierIndex));
  return parties;
}

function estLigneTableau(ligne: string): boolean {
  return /^\s*\|.*\|\s*$/.test(ligne);
}

function estSeparateurTableau(ligne: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(ligne) && ligne.includes("-");
}

function cellulesDe(ligne: string): string[] {
  const t = ligne.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split("|").map((c) => c.trim());
}

export function rendreMarkdownLeger(source: string): JSX.Element[] {
  const lignes = source.split("\n");
  const elements: JSX.Element[] = [];
  let paragraphe: string[] = [];
  let liste: { ordonnee: boolean; items: string[] } | null = null;
  let tableau: { entetes: string[]; lignes: string[][] } | null = null;
  let cle = 0;

  function viderParagraphe() {
    if (paragraphe.length === 0) return;
    const texte = paragraphe.join(" ");
    elements.push(<p key={`p-${cle}`}>{rendreInline(texte, `p-${cle++}`)}</p>);
    paragraphe = [];
  }

  function viderListe() {
    if (!liste) return;
    const items = liste.items;
    const ordonnee = liste.ordonnee;
    elements.push(
      ordonnee ? (
        <ol key={`l-${cle}`}>
          {items.map((item, i) => (
            <li key={i}>{rendreInline(item, `li-${cle}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`l-${cle}`}>
          {items.map((item, i) => (
            <li key={i}>{rendreInline(item, `li-${cle}-${i}`)}</li>
          ))}
        </ul>
      )
    );
    cle++;
    liste = null;
  }

  function viderTableau() {
    if (!tableau) return;
    const { entetes, lignes: rangs } = tableau;
    elements.push(
      <table key={`t-${cle}`}>
        <thead>
          <tr>
            {entetes.map((h, i) => (
              <th key={i}>{rendreInline(h, `th-${cle}-${i}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rangs.map((rang, i) => (
            <tr key={i}>
              {rang.map((c, j) => (
                <td key={j}>{rendreInline(c, `td-${cle}-${i}-${j}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
    cle++;
    tableau = null;
  }

  function viderTout() {
    viderParagraphe();
    viderListe();
    viderTableau();
  }

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i]!.trimEnd();

    if (ligne.trim().length === 0) {
      viderTout();
      continue;
    }

    if (/^#{1,3}\s+/.test(ligne)) {
      viderTout();
      const niveau = /^#+/.exec(ligne)![0]!.length;
      const texte = ligne.replace(/^#{1,3}\s+/, "");
      const contenu = rendreInline(texte, `h-${cle}`);
      elements.push(
        niveau === 1 ? (
          <h1 key={`h-${cle++}`}>{contenu}</h1>
        ) : niveau === 2 ? (
          <h2 key={`h-${cle++}`}>{contenu}</h2>
        ) : (
          <h3 key={`h-${cle++}`}>{contenu}</h3>
        )
      );
      continue;
    }

    if (!tableau && estLigneTableau(ligne) && i + 1 < lignes.length && estSeparateurTableau(lignes[i + 1]!)) {
      viderParagraphe();
      viderListe();
      tableau = { entetes: cellulesDe(ligne), lignes: [] };
      i++; // saute la ligne séparatrice d'en-tête
      continue;
    }
    if (tableau && estLigneTableau(ligne)) {
      tableau.lignes.push(cellulesDe(ligne));
      continue;
    }
    if (tableau) viderTableau();

    const puce = /^[-*—]\s+(.*)$/.exec(ligne);
    const numero = /^\d+\.\s+(.*)$/.exec(ligne);
    if (puce || numero) {
      viderParagraphe();
      const ordonnee = !!numero;
      if (!liste || liste.ordonnee !== ordonnee) {
        viderListe();
        liste = { ordonnee, items: [] };
      }
      liste.items.push((puce ?? numero)![1]!);
      continue;
    }
    if (liste) viderListe();

    paragraphe.push(ligne.trim());
  }
  viderTout();

  return elements;
}
