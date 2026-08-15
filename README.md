# Registre SI

Mémoire structurée et vérifiable du SI d'Abraxio — outil personnel de l'opérateur SI
solo. Voir `docs/cahier-des-charges-registre-SI.md` pour le produit et les trois
`docs/spec-technique-jalon*.md` pour l'implémentation détaillée de chaque jalon.

## État actuel

- **Jalon 1 (le journal)** : livré. Demandes, décisions, changements, incidents,
  recherche plein texte, contrôles de pratique C1-C6, rapport hebdo.
- **Jalon 2 (la carte)** : livré. Cartographie applicative (systèmes, modules, champs,
  habilitations, intégrations, automatisations), `impact()`, contrôles de modèle
  (M1-M4) et d'intégration (I1-I7), liens carte ↔ journal, rapports `etat_si` et
  `impact`, interface web en lecture (`npm run web`).
- **Jalon 3 (import Zoho)** : amorcé (migration v3, `zoho_configurer`, client HTTP
  Zoho testé sur transport injecté). **La suite (découverte, mapper, fusion, import,
  contrôles de dérive) est délibérément arrêtée** : la spec impose de valider le
  mapping contre des fichiers de découverte réels obtenus en exécutant
  `zoho_decouvrir` contre le vrai Zoho d'Abraxio (accès admin + Self Client OAuth2
  requis). Voir « Continuer le Jalon 3 » plus bas.

116 tests verts (`npm test`).

## Installation

```bash
npm install
npm run build
```

Le serveur MCP se lance avec `node dist/server.js` (transport stdio). La base SQLite
est créée automatiquement au premier démarrage.

## Configuration Claude Desktop

Ajoutez ce bloc dans la configuration MCP de Claude Desktop
(`~/Library/Application Support/Claude/claude_desktop_config.json` sur macOS,
`%APPDATA%\Claude\claude_desktop_config.json` sur Windows) :

```json
{
  "mcpServers": {
    "registre-si": {
      "command": "node",
      "args": ["<chemin>/dist/server.js"],
      "env": { "REGISTRE_DB_PATH": "<chemin>/registre.db" }
    }
  }
}
```

Remplacez `<chemin>` par le chemin absolu du projet cloné. Si `REGISTRE_DB_PATH`
n'est pas défini, la base est créée par défaut dans `~/.registre-si/registre.db`.

Redémarrez Claude Desktop après avoir modifié la configuration.

## Vérification manuelle

1. Lancez `npm run build` puis redémarrez Claude Desktop avec la configuration
   ci-dessus.
2. Dans une conversation Claude Desktop, écrivez :

   > Enregistre une demande de Sophie de l'équipe CS : elle veut voir les factures
   > directement dans la fiche client.

3. Claude doit appeler l'outil `enregistrer_demande` et répondre avec un résumé et un
   identifiant.
4. Pour vérifier en base, ouvrez `registre.db` (ex. avec `sqlite3` ou DB Browser for
   SQLite) et contrôlez la table `demandes` : une ligne avec `demandeur = 'Sophie'`,
   `equipe = 'CS'`, `expression_brute` contenant exactement les mots de la phrase, et
   `statut = 'recue'`.
5. Testez ensuite : « Décris le système Zoho CRM, module Comptes, champ
   Statut_Client » (`decrire_champ`), « Si je modifie Statut_Client, qu'est-ce qui
   casse ? » (`impact`), « Quels sont les points de vigilance ouverts ? »
   (`constats_ouverts` après un premier `lancer_controles`), et « Génère le rapport
   hebdo » (`generer_rapport`).
6. Pour l'interface web : `npm run web`, puis ouvrez `http://localhost:3737`.

## Outils MCP disponibles

| Outil | Rôle |
|---|---|
| `enregistrer_demande` | Journal — sollicitation reçue |
| `enregistrer_decision` | Journal — arbitrage |
| `enregistrer_changement` | Journal — mise en production (propose des liens vers la carte) |
| `enregistrer_incident` | Journal — incident |
| `rechercher_journal` | Recherche plein texte dans le journal et la carte |
| `lancer_controles` | Exécute la vigie (pratique, modèle, intégration) |
| `constats_ouverts` | Liste les constats ouverts |
| `generer_rapport` | hebdo / etat_si / impact (markdown) / matrice_habilitations (HTML) |
| `decrire_systeme` | Carte — décrit un système |
| `decrire_module` | Carte — décrit un module |
| `decrire_champ` | Carte — décrit un champ (source de vérité, éditabilité…) |
| `decrire_habilitation` | Carte — droits d'un profil sur un champ |
| `decrire_integration` | Carte — intégration entre deux systèmes |
| `decrire_automatisation` | Carte — workflow / Deluge / blueprint |
| `impact` | « Si je modifie X, qu'est-ce qui casse ? » |
| `lier_changement` | Confirme un lien carte ↔ journal |
| `zoho_configurer` | Jalon 3 — enregistre les identifiants Zoho (Self Client OAuth2) |

## Interface web (lecture seule)

```bash
npm run build
npm run web        # http://localhost:3737 (port : variable WEB_PORT)
```

4 pages générées depuis la base : matrice d'habilitations (filtrable par module),
champs par source de vérité (contradictions en tête), carte des intégrations,
constats ouverts. Aucune saisie possible depuis le web — c'est la conversation qui
écrit, le web ne fait que lire.

## Développement

```bash
npm run typecheck   # tsc --noEmit
npm test             # vitest run
npm run build         # compile dans dist/
```

Structure du repo : voir `docs/spec-technique-jalon1-claude-code.md` §1.

## Sauvegarde

La base est un unique fichier SQLite (`registre.db`, plus les fichiers WAL associés
pendant l'exécution). Sauvegarder = copier ce fichier. Les identifiants Zoho (une
fois configurés) vivent séparément dans `~/.registre-si/zoho-credentials.json`
(permissions 600) — ne jamais les commiter.

## Continuer le Jalon 3

Le reste de l'import Zoho (`docs/spec-technique-jalon3-zoho.md`) nécessite une
étape en conditions réelles :

1. Créer un Self Client dans la console développeur Zoho (client_id, client_secret,
   grant code), puis appeler `zoho_configurer` depuis Claude Desktop.
2. Implémenter et exécuter `zoho_decouvrir` contre le vrai Zoho d'Abraxio (§3 de la
   spec) — écrit des fichiers bruts dans `~/.registre-si/decouverte-zoho/{date}/`.
3. Copier ces fichiers réels dans `tests/fixtures/zoho/`.
4. Écrire `zoho/mapper.ts` et `zoho/fusion.ts` **validés contre ces fixtures**, pas
   contre la seule documentation (toute divergence structurelle doit être vérifiée
   avec l'extrait JSON réel avant d'écrire le code).
5. `zoho_importer` (aperçu puis appliquer), contrôles de dérive D1-D4, rapport
   `revue_habilitations`.

C'est un arrêt volontaire, pas un oubli : `prompts-claude-code-jalons2-3.md` (Prompt
17) est explicite là-dessus — « STOP après ce prompt : je reviens avec les fixtures
réelles avant la suite. »
