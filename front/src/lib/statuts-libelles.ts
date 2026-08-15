// Libellés pour les listes déroulantes des formulaires d'édition directe
// (mêmes valeurs que les enums zod côté serveur — db/enums.ts).

export const OPTIONS_STATUT_DEMANDE = [
  { valeur: "recue", label: "Reçue" },
  { valeur: "qualifiee", label: "Qualifiée" },
  { valeur: "arbitree", label: "Arbitrée" },
  { valeur: "realisee", label: "Réalisée" },
  { valeur: "refusee", label: "Refusée" },
  { valeur: "reportee", label: "Reportée" },
];

export const OPTIONS_STATUT_DECISION = [
  { valeur: "proposee", label: "Proposée" },
  { valeur: "validee", label: "Validée" },
  { valeur: "appliquee", label: "Appliquée" },
  { valeur: "remplacee", label: "Remplacée" },
];

export const OPTIONS_PRIORITE = [
  { valeur: "P1", label: "P1" },
  { valeur: "P2", label: "P2" },
  { valeur: "P3", label: "P3" },
];

export const OPTIONS_STATUT_TICKET = [
  { valeur: "a_faire", label: "À faire" },
  { valeur: "en_cours", label: "En cours" },
  { valeur: "bloque", label: "Bloqué" },
  { valeur: "termine", label: "Terminé" },
];

export const OPTIONS_STATUT_PROJET = [
  { valeur: "actif", label: "Actif" },
  { valeur: "clos", label: "Clos" },
];

export const OPTIONS_STATUT_EPIC = [
  { valeur: "a_faire", label: "À faire" },
  { valeur: "en_cours", label: "En cours" },
  { valeur: "termine", label: "Terminé" },
];

export const OPTIONS_EQUIPE = [
  { valeur: "CS", label: "CS" },
  { valeur: "AE", label: "AE" },
  { valeur: "Marketing", label: "Marketing" },
  { valeur: "ADV", label: "ADV" },
  { valeur: "Produit", label: "Produit" },
  { valeur: "Communication", label: "Communication" },
  { valeur: "Direction", label: "Direction" },
  { valeur: "Autre", label: "Autre" },
];

export const OPTIONS_TYPE_DEMANDE = [
  { valeur: "evolution", label: "Évolution" },
  { valeur: "correction", label: "Correction" },
  { valeur: "question", label: "Question" },
  { valeur: "acces", label: "Accès" },
  { valeur: "incident", label: "Incident" },
];

export const OPTIONS_TYPE_CHANGEMENT = [
  { valeur: "parametrage", label: "Paramétrage" },
  { valeur: "deluge", label: "Deluge" },
  { valeur: "sql", label: "SQL" },
  { valeur: "javascript", label: "JavaScript" },
  { valeur: "config_api", label: "Config API" },
  { valeur: "habilitations", label: "Habilitations" },
  { valeur: "autre", label: "Autre" },
];
