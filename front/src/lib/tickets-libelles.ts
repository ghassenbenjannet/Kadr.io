// Libellés et classes de badge partagés entre ProjetDetail et TicketDetail.

export const LIBELLES_TYPE_TICKET: Record<string, string> = {
  analyse: "Analyse",
  documentation: "Documentation",
  atelier: "Atelier",
  bug: "Bug",
  task: "Tâche",
};

export function badgeStatutTicket(statut: string): string {
  if (statut === "bloque") return "badge badge--attention";
  return "badge badge--neutre";
}

export function badgeStatutCas(statut: string): string {
  if (statut === "reussi") return "badge badge--succes";
  if (statut === "echoue") return "badge badge--danger";
  return "badge badge--neutre";
}
