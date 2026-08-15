// Résumé générique du résultat d'un outil de lecture, pour la trace envoyée
// au front (§7 : « recherche dans le journal… » puis « 3 résultats »).

export function resumerResultatLecture(resultat: unknown): string {
  if (typeof resultat !== "object" || resultat === null) return "terminé";
  const objet = resultat as Record<string, unknown>;
  if (objet.ok === false) {
    return typeof objet.erreur === "string" ? objet.erreur : "échec";
  }
  for (const valeur of Object.values(objet)) {
    if (Array.isArray(valeur)) {
      return `${valeur.length} résultat${valeur.length === 1 ? "" : "s"}`;
    }
  }
  return "terminé";
}
