// Avertissements affichés à la proposition d'une écriture, avant exécution —
// donc calculés à partir des paramètres proposés, pas du résultat (les
// avertissements du Jalon 1 ne sont produits qu'après exécution côté outil).
// Texte partagé par le front (carte de validation) et le serveur MCP (§5.4).
//
// Front (front/src/lib/avertissements-proposition.ts) ne peut pas importer
// ce fichier — son tsconfig restreint la compilation à front/src — donc il
// en garde une copie dupliquée à dessein (§4 de la spec Jalon 4) ; toute
// modification ici doit être reportée là-bas.

export function avertissementsPourProposition(outil: string, parametres: Record<string, unknown>): string[] {
  const avertissements: string[] = [];

  if (outil === "enregistrer_changement" && !parametres.rollback) {
    avertissements.push("Aucun retour arrière déclaré. Le contrôle C1 restera ouvert.");
  }

  if (outil === "enregistrer_incident" && (parametres.resolution || parametres.resolu_le) && !parametres.action_preventive) {
    avertissements.push("Aucune action préventive déclarée. Le contrôle C6 restera ouvert.");
  }

  if (
    (outil === "enregistrer_demande" || outil === "mettre_a_jour_demande") &&
    parametres.priorite &&
    !parametres.priorite_arbitree_par
  ) {
    avertissements.push("Une priorité doit être attribuable : qui l'a arbitrée ?");
  }

  return avertissements;
}
