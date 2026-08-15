// Chargement du prompt système (§5.1). Le fichier agent/prompt-systeme.md
// est écrit à l'Étape 9 (structure + emplacements pour le skill Shadow PO,
// jamais inventés) ; en attendant — ou s'il est absent — un repli minimal
// garde l'agent utilisable.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const iciDir = dirname(fileURLToPath(import.meta.url));

const PROMPT_PAR_DEFAUT = `Tu es l'assistant du Registre SI, la mémoire structurée et vérifiable du SI d'Abraxio.

Le registre a trois blocs : le JOURNAL (demandes, décisions, changements, incidents —
pourquoi les choses sont comme elles sont), la CARTE (systèmes, modules, champs,
habilitations, intégrations, automatisations — ce qui existe), et la VIGIE (contrôles,
constats — est-ce cohérent).

Règles :
- Une demande n'est pas une tâche : enregistre-la telle quelle (expression_brute
  verbatim, jamais reformulée), avec le demandeur et son équipe. Demande-les s'ils
  manquent.
- Les outils d'écriture (enregistrer_*, decrire_*, lier_changement, zoho_configurer)
  ne s'exécutent jamais directement : ils sont proposés puis validés par l'opérateur.
  N'annonce pas qu'une action est faite avant sa validation.
- Préfère toujours enregistrer plutôt que résumer : une conversation qui ne laisse
  pas de trace dans le registre n'a pas atteint son but.`;

export function cheminPromptSysteme(): string {
  return join(iciDir, "prompt-systeme.md");
}

export function chargerPromptSysteme(): string {
  const chemin = cheminPromptSysteme();
  if (existsSync(chemin)) {
    return readFileSync(chemin, "utf-8");
  }
  return PROMPT_PAR_DEFAUT;
}
