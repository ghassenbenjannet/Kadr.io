// Noms d'action en clair pour la trace de tool-calls et la carte de
// validation (§7 : "le nom de l'action en clair").

export const LIBELLES_OUTILS: Record<string, string> = {
  rechercher_journal: "Recherche dans le journal",
  constats_ouverts: "Liste des constats ouverts",
  lancer_controles: "Exécution des contrôles",
  generer_rapport: "Génération du rapport",
  impact: "Analyse d'impact",
  enregistrer_demande: "Enregistrer une demande",
  enregistrer_decision: "Enregistrer une décision",
  enregistrer_changement: "Enregistrer un changement",
  enregistrer_incident: "Enregistrer un incident",
  decrire_systeme: "Décrire un système",
  decrire_module: "Décrire un module",
  decrire_champ: "Décrire un champ",
  decrire_habilitation: "Décrire une habilitation",
  decrire_integration: "Décrire une intégration",
  decrire_automatisation: "Décrire une automatisation",
  lier_changement: "Lier un changement à la carte",
  zoho_configurer: "Configurer l'accès Zoho",
};

export function libelleOutil(nom: string): string {
  return LIBELLES_OUTILS[nom] ?? nom;
}

const LIBELLES_CHAMPS: Record<string, string> = {
  demandeur: "Demandeur",
  equipe: "Équipe",
  expression_brute: "Expression brute",
  reformulation: "Reformulation",
  type: "Type",
  priorite: "Priorité",
  priorite_arbitree_par: "Priorité arbitrée par",
  contexte: "Contexte",
  decision: "Décision",
  decideur: "Décideur",
  consequences: "Conséquences",
  statut: "Statut",
  description: "Description",
  perimetre: "Périmètre",
  rollback: "Retour arrière",
  test_effectue: "Test effectué",
  communication: "Communication",
  demande_id: "Demande d'origine",
  decision_id: "Décision d'origine",
  symptome: "Symptôme",
  impact: "Impact",
  cause: "Cause",
  changement_id: "Changement associé",
  resolution: "Résolution",
  action_preventive: "Action préventive",
  nom: "Nom",
  systeme: "Système",
  module: "Module",
  champ: "Champ",
  source_de_verite: "Source de vérité",
  editable: "Éditable",
  regle_metier: "Règle métier",
  fraicheur: "Fraîcheur",
  profil: "Profil",
  visible: "Visible",
  justification: "Justification",
  source: "Source",
  cible: "Cible",
  auth: "Authentification",
  strategie: "Stratégie",
  idempotence: "Idempotence",
  matching: "Rapprochement",
  regle_vide: "Règle de valeur vide",
  regle_suppression: "Règle de suppression",
  procedure_reprise: "Procédure de reprise",
  declencheur: "Déclencheur",
  entite_carte: "Élément de la carte",
  changement_id_lien: "Changement à lier",
  client_id: "Client ID",
  client_secret: "Client Secret",
  grant_code: "Grant code",
};

export function libelleChamp(cle: string): string {
  return LIBELLES_CHAMPS[cle] ?? cle;
}
