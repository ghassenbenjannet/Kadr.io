// Avertissements affichés SUR la carte de validation, avant exécution —
// donc recalculés côté client à partir des paramètres proposés (les
// avertissements du Jalon 1 ne sont produits qu'après exécution côté
// serveur). Textes repris mot pour mot des outils correspondants.

export function avertissementsPourProposition(outil: string, parametres: Record<string, unknown>): string[] {
  const avertissements: string[] = [];

  if (outil === "enregistrer_changement" && !parametres.rollback) {
    avertissements.push("Aucun retour arrière déclaré. Le contrôle C1 restera ouvert.");
  }

  if (outil === "enregistrer_incident" && (parametres.resolution || parametres.resolu_le) && !parametres.action_preventive) {
    avertissements.push("Aucune action préventive déclarée. Le contrôle C6 restera ouvert.");
  }

  if (outil === "enregistrer_demande" && parametres.priorite && !parametres.priorite_arbitree_par) {
    avertissements.push("Une priorité doit être attribuable : qui l'a arbitrée ?");
  }

  return avertissements;
}
