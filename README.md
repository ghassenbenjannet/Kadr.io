# Registre SI

Mémoire structurée et vérifiable du SI d'Abraxio — outil personnel de l'opérateur SI
solo. Voir `docs/cahier-des-charges-registre-SI.md` pour le produit et
`docs/spec-technique-jalon1-claude-code.md` pour l'implémentation détaillée.

État actuel : **Jalon 1 (le journal)** livré. Le journal s'utilise en conversation
depuis Claude Desktop (ou tout client MCP) via les 8 outils décrits ci-dessous.

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
5. Testez ensuite : « Quels sont les points de vigilance ouverts ? » (`constats_ouverts`
   après un premier `lancer_controles`), et « Génère le rapport hebdo » (`generer_rapport`).

## Outils MCP disponibles

| Outil | Rôle |
|---|---|
| `enregistrer_demande` | Journal — sollicitation reçue |
| `enregistrer_decision` | Journal — arbitrage |
| `enregistrer_changement` | Journal — mise en production |
| `enregistrer_incident` | Journal — incident |
| `rechercher_journal` | Recherche plein texte dans le journal |
| `lancer_controles` | Exécute la vigie et met à jour les constats |
| `constats_ouverts` | Liste les constats ouverts |
| `generer_rapport` | Génère le rapport hebdo (markdown) |

## Développement

```bash
npm run typecheck   # tsc --noEmit
npm test             # vitest run
npm run build         # compile dans dist/
```

Structure du repo : voir `docs/spec-technique-jalon1-claude-code.md` §1.

## Sauvegarde

La base est un unique fichier SQLite (`registre.db`, plus les fichiers WAL associés
pendant l'exécution). Sauvegarder = copier ce fichier.

## Suite du projet

- **Jalon 2** (`docs/spec-technique-jalon2-carte.md`) : cartographie applicative,
  `impact()`, contrôles de modèle et d'intégration, interface web en lecture.
- **Jalon 3** (`docs/spec-technique-jalon3-zoho.md`) : import des métadonnées Zoho,
  détection de dérive, vigie complète. Nécessite un accès admin réel au Zoho
  d'Abraxio (étape de découverte outillée avant tout code d'import).
