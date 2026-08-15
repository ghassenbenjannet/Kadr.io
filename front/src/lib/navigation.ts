// Registre d'écrans + navigation programmatique minimale — l'app est une
// SPA à état plat (pas de react-router), et le bouton d'action global
// "Nouvelle entrée" doit pouvoir naviguer vers Journal depuis n'importe quel
// écran sans faire remonter les props de tous les composants jusqu'à
// App.tsx. Même pattern que surSessionExpiree (lib/api.ts) : des callbacks
// module-scope enregistrés une fois par le composant concerné.

export type Vue =
  | "aujourdhui"
  | "conversation"
  | "tickets"
  | "projets"
  | "connaissances"
  | "journal"
  | "constats"
  | "rapport"
  | "habilitations"
  | "champs"
  | "integrations"
  | "mobile";

let gestionnaireNavigation: ((vue: Vue) => void) | null = null;
let gestionnaireOuvertureCreation: (() => void) | null = null;
// Si "Nouvelle entrée" est cliqué depuis un autre écran, Journal ne s'enregistre
// (effet de montage) qu'APRÈS ce clic — trop tard pour un appel direct. On mémorise
// la demande et Journal la consomme dès qu'il s'enregistre.
let ouvertureCreationEnAttente = false;

export function definirNavigation(fn: (vue: Vue) => void): void {
  gestionnaireNavigation = fn;
}

export function naviguerVers(vue: Vue): void {
  gestionnaireNavigation?.(vue);
}

/** Enregistré par Journal.tsx au montage : ouvre son formulaire de création. */
export function definirOuvertureCreationJournal(fn: (() => void) | null): void {
  gestionnaireOuvertureCreation = fn;
  if (fn && ouvertureCreationEnAttente) {
    ouvertureCreationEnAttente = false;
    fn();
  }
}

/** Bouton d'action global "Nouvelle entrée" : va sur Journal, formulaire de création ouvert. */
export function naviguerVersNouvelleEntree(): void {
  naviguerVers("journal");
  if (gestionnaireOuvertureCreation) {
    // Journal est déjà monté (on y est déjà) : la navigation ci-dessus ne
    // déclenche pas de remontage, donc c'est cet appel direct qui ouvre le
    // formulaire dans ce cas.
    gestionnaireOuvertureCreation();
  } else {
    // Journal vient d'être démonté ou n'est pas encore monté : la demande sera
    // consommée dès que son effet de montage s'enregistre (voir ci-dessus).
    ouvertureCreationEnAttente = true;
  }
}
