// Libellés et classes de badge par type d'entité du journal — partagés
// entre Journal et Aujourd'hui (dashboard).

export const LIBELLES_ENTITE: Record<string, string> = {
  demande: "Demande",
  decision: "Décision",
  changement: "Changement",
  incident: "Incident",
};

const CLASSES_BADGE_ENTITE: Record<string, string> = {
  demande: "badge--demande",
  decision: "badge--decision",
  changement: "badge--changement",
  incident: "badge--incident",
};

export function badgeEntite(entite: string): string {
  return `badge ${CLASSES_BADGE_ENTITE[entite] ?? "badge--neutre"}`;
}
