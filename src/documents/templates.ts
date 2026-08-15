// Contenu markdown de départ par type de document — un point de départ,
// jamais une contrainte : tout reste éditable en texte libre ensuite.

export const PATTERNS_DOCUMENT: Record<string, string> = {
  cadrage: `## Contexte

## Objectifs

## Périmètre

## Risques
`,
  compte_rendu: `## Participants

## Décisions

## Actions
`,
  specification: `## Besoin

## Solution retenue

## Critères d'acceptation
`,
  note: "",
  autre: "",
};

export function patternPourType(type: string): string {
  return PATTERNS_DOCUMENT[type] ?? "";
}
