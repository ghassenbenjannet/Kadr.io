// Feedback toast discret après action (Prompt N) — même pattern que
// navigation.ts : un registre de callbacks module-scope consommé par un
// unique composant hôte monté une fois dans App.tsx, pas de contexte React
// à faire remonter depuis chaque écran.

export type NatureToast = "succes" | "erreur" | "info";

export interface Toast {
  id: number;
  message: string;
  nature: NatureToast;
}

let compteur = 0;
let gestionnaire: ((toast: Toast) => void) | null = null;

export function definirGestionnaireToast(fn: ((toast: Toast) => void) | null): void {
  gestionnaire = fn;
}

export function afficherToast(message: string, nature: NatureToast = "succes"): void {
  compteur += 1;
  gestionnaire?.({ id: compteur, message, nature });
}
