# Registre SI

Mémoire structurée et vérifiable du SI d'Abraxio — outil personnel de l'opérateur SI
solo. Une seule application : agent IA intégré (Anthropic par défaut, ou tout modèle
compatible OpenAI) + interface web, un seul processus, `npm start`.

Voir `docs/cahier-des-charges-registre-SI.md` pour le produit et les
`docs/spec-technique-*.md` pour l'implémentation détaillée de chaque jalon —
notamment `docs/spec-technique-jalon1bis-ia-integree.md`, le correctif d'architecture
qui remplace le serveur MCP initial par cette application autonome.

## État actuel

- **Jalon 1 (le journal)** et **Jalon 2 (la carte)** : livrés en totalité — demandes,
  décisions, changements, incidents, cartographie applicative, `impact()`, vigie
  complète (contrôles de pratique, de modèle, d'intégration), rapports.
- **Jalon 1 bis (IA intégrée)** : livré. L'outil n'est plus un serveur MCP consommé
  par un client externe : il embarque son propre agent (streaming, appel d'outils,
  validation humaine avant toute écriture) et sa propre interface (conversation,
  journal, constats, rapport hebdo).
- **Portage de la cartographie (Jalon 2) dans l'app principale** : la matrice
  d'habilitations, les champs par source de vérité et la carte des intégrations —
  jusque-là des pages HTML statiques séparées — sont maintenant des écrans React de
  la même application, dans la même navigation. Le serveur web statique et
  `npm run web` ont été retirés : une seule interface, à jour en temps réel.
- **Écran Tickets (demandes)** : le schéma des demandes portait déjà un vrai cycle de
  vie (`recue` → `qualifiee` → `arbitree` → `realisee`, ou `refusee`/`reportee`) sans
  aucun moyen de le faire avancer. L'outil `mettre_a_jour_demande` et l'écran
  Tickets (colonnes par statut) comblent ce trou — sans assignation utilisateur,
  l'équipe demandeuse suffit pour un opérateur solo.
- **Suivi de projet** : un second axe, volontairement séparé du registre (qui garde
  son rôle de mémoire). Hiérarchie **demande → projet → epic → ticket** (analyse,
  documentation, atelier, bug, task), avec une **suite de recette** — des plans de
  test (listes de cas à cocher) liés aux tickets qui en ont besoin. 8 outils agent
  (`creer_projet`, `creer_epic`, `creer_ticket`, `mettre_a_jour_ticket`,
  `creer_plan_test`, `executer_cas_test`, `lier_ticket_plan_test`, `etat_projet`) et
  l'écran **Projets** (liste, puis détail par projet : epics/tickets et suite de
  recette).
- **Direction visuelle « console technique »** : neutres froids, encre presque
  noire, un seul bleu de signal réservé à la navigation active — remplace la
  direction « papier chaud » initiale, suite au retour que la palette d'origine ne
  convenait pas.
- **Jalon 3 (import Zoho)** : amorcé (migration, `zoho_configurer`, client HTTP Zoho
  testé sur transport injecté). La suite (découverte, mapper, fusion, import,
  contrôles de dérive) est **délibérément arrêtée** : elle exige une exécution réelle
  contre le Zoho d'Abraxio avant d'écrire le moindre code de mapping. Voir
  « Continuer le Jalon 3 » plus bas.
- **Jalon 4 (transport MCP)** : livré. Second point d'entrée conversationnel — voir
  [Utiliser depuis Claude Desktop](#utiliser-depuis-claude-desktop) — qui expose le
  même catalogue d'outils sans passer par l'agent intégré ni l'API Anthropic. Gel de
  périmètre associé : Conversation, Projets/ProjetDetail, Tickets/TicketDetail,
  DocumentEditor et Base de connaissances (dont l'écran Kanban livré juste avant ce
  jalon) ne reçoivent plus que des corrections de bug ; tout nouvel investissement
  d'écran va vers Journal, Constats, Habilitations, Intégrations, Champs et Rapport
  hebdo.

303 tests verts (`npm test`).

## Installation

```bash
npm install
npm run build   # compile le serveur ET construit l'interface (front/)
```

`npm run build` installe aussi les dépendances de `front/` si nécessaire. Si vous
sautez cette étape, `npm start` la fait à votre place au premier lancement (voir
plus bas).

## Configuration du modèle

Par défaut, l'application appelle l'API Anthropic. Créez `~/.registre-si/config.json`
(permissions 600, jamais commité — déjà dans `.gitignore`) :

```json
{
  "anthropicApiKey": "sk-ant-...",
  "model": "claude-sonnet-5",
  "maxTokens": 4096
}
```

`ANTHROPIC_API_KEY` et `REGISTRE_MODEL` (variables d'environnement) sont prioritaires
sur le fichier si présents. **Sans clé configurée, l'application démarre quand même** :
les vues de lecture (Journal, Constats, Rapport hebdo) fonctionnent normalement, et la
conversation affiche une erreur explicative tant que la clé n'est pas renseignée.

### Utiliser un autre modèle (n'importe quel endpoint compatible OpenAI)

L'application n'est pas verrouillée sur Anthropic : `REGISTRE_PROVIDER=compatible_openai`
bascule sur n'importe quel endpoint exposant l'API "chat completions" standard
(NVIDIA NIM — [build.nvidia.com/models](https://build.nvidia.com/models), Together,
Groq, un serveur vLLM auto-hébergé, etc.).

```json
{
  "provider": "compatible_openai",
  "baseUrl": "https://integrate.api.nvidia.com/v1",
  "apiKey": "nvapi-...",
  "model": "meta/llama-3.1-405b-instruct"
}
```

Ou par variables d'environnement (prioritaires sur le fichier) :
`REGISTRE_PROVIDER`, `REGISTRE_BASE_URL`, `REGISTRE_API_KEY`, `REGISTRE_MODEL`.
`baseUrl` est l'URL de base de l'API (sans `/chat/completions`, ajouté automatiquement) ;
`model` est le nom du modèle tel qu'attendu par cet endpoint précis — il n'y a pas de
valeur par défaut, chaque fournisseur ayant sa propre nomenclature. Les outils (tool
calling), le streaming et l'usage de tokens sont traduits automatiquement vers/depuis le
format Anthropic interne ; le comportement de l'agent (validation des écritures, modes de
travail, etc.) est identique quel que soit le fournisseur.

## Sécurité et authentification

L'application n'a pas de comptes utilisateurs (elle est pensée pour un seul
opérateur) : la protection est un **mot de passe partagé**, à définir dès que
l'app est accessible ailleurs qu'en local.

Ajoutez `password` à `~/.registre-si/config.json`, ou définissez la variable
d'environnement `REGISTRE_PASSWORD` (prioritaire sur le fichier) :

```json
{
  "anthropicApiKey": "sk-ant-...",
  "password": "change-moi"
}
```

**Sans mot de passe configuré, l'application reste accessible sans
authentification** — un avertissement s'affiche dans les logs au démarrage.
Acceptable en local strict ; à corriger avant toute exposition réseau.

Une fois le mot de passe défini : connexion par cookie de session signé
(HMAC, sans stockage côté serveur — les sessions expirent après 30 jours ou
au redémarrage du serveur, puisque la clé de signature est régénérée à
chaque démarrage), et limite de 10 tentatives échouées par IP sur 15 minutes
avant blocage temporaire.

Si l'app tourne derrière un reverse proxy HTTPS, définissez
`REGISTRE_COOKIE_SECURE=true` pour que le cookie de session ne soit jamais
envoyé en clair. Laissez-le à `false` (par défaut) tant que l'accès se fait
en HTTP direct (ex. `localhost`), sans quoi le navigateur refuse le cookie.

## Démarrage

```bash
npm start
```

Ouvre le serveur sur `http://localhost:3737` (port réglable via `PORT`). La base
SQLite est créée automatiquement au premier démarrage
(`~/.registre-si/registre.db`, réglable via `REGISTRE_DB_PATH`).

## Docker

```bash
cp .env.example .env   # renseigne ANTHROPIC_API_KEY et REGISTRE_PASSWORD dedans
docker compose up --build
```

Ouvre `http://localhost:3737`. Le build compile le backend et le front dans une
étape séparée (image de build avec la chaîne de compilation, au cas où
`better-sqlite3` doive être reconstruit) ; l'image finale ne contient que le
résultat, tourne avec un utilisateur non-root, et persiste tout
(`registre.db`, `config.json`, les identifiants Zoho une fois configurés) dans
un volume nommé (`registre_data`, monté sur `/data`, qui sert de `$HOME` au
conteneur) — les données survivent à un `docker compose down` (pas à un `-v`).

Sans `docker compose`, l'équivalent :

```bash
docker build -t registre-si .
docker run -p 3737:3737 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e REGISTRE_PASSWORD=change-moi \
  -v registre_data:/data registre-si
```

`REGISTRE_MODEL`, `REGISTRE_PROVIDER`/`REGISTRE_BASE_URL` (pour un fournisseur
compatible OpenAI — voir [Utiliser un autre modèle](#utiliser-un-autre-modèle-nimporte-quel-endpoint-compatible-openai))
et `PORT` sont aussi surchargeables via `-e`. Sans clé API, le conteneur
démarre quand même — mêmes garanties qu'en local (lecture disponible,
conversation désactivée). **`REGISTRE_PASSWORD` mérite la même attention que
la clé API** : dès que le conteneur est exposé au-delà de `localhost`
(déploiement, reverse proxy), définissez-le — voir
[Sécurité et authentification](#sécurité-et-authentification). Derrière un
reverse proxy HTTPS, ajoutez aussi `-e REGISTRE_COOKIE_SECURE=true`.

## Utiliser depuis Claude Desktop

Alternative à l'agent intégré : un serveur MCP (`src/mcp/server.ts`) expose le même
catalogue d'outils à Claude Desktop, en transport stdio. La conversation est alors
couverte par votre abonnement claude.ai — **aucune clé API Anthropic requise pour ce
mode**. Le principe « l'IA propose, l'humain valide » reste inchangé : les outils
d'écriture ne font que proposer, `confirmer_ecriture` / `rejeter_ecriture` restent les
seuls chemins d'exécution, à votre décision explicite en conversation.

```bash
npm run build:server   # compile dist/mcp/server.js (inclus dans `npm run build`)
```

Dans la configuration de Claude Desktop (`claude_desktop_config.json`) :

```json
{
  "mcpServers": {
    "registre-si": {
      "command": "node",
      "args": ["<chemin-absolu>/dist/mcp/server.js"],
      "env": { "REGISTRE_DB_PATH": "<home>/.registre-si/registre.db" }
    }
  }
}
```

Redémarrez Claude Desktop après modification. `REGISTRE_DB_PATH` doit pointer vers la
même base que l'app (même défaut si omis : `~/.registre-si/registre.db`) — app et
serveur MCP peuvent tourner en même temps, la base SQLite est déjà en mode WAL. Les
instructions à coller dans un Projet Claude sont dans
`docs/projet-claude-desktop.md`.

L'app intégrée (`npm start`, ce README) reste disponible en parallèle pour les écrans
(Journal, Constats, Projets...) et pour l'agent embarqué — le MCP est un second point
d'entrée conversationnel, pas un remplacement.

### Vérification manuelle (MCP)

1. `npm run build`, renseignez la config Claude Desktop ci-dessus avec le chemin
   absolu de votre clone, **redémarrez Claude Desktop**.
2. Dans un nouveau chat (ou le Projet créé avec `docs/projet-claude-desktop.md`),
   vérifiez que l'outil `🔨` liste bien les outils `registre-si` — signe que le
   serveur MCP est connecté.
3. Écrivez :

   > Enregistre : Sophie du CS veut voir les factures dans la fiche client.

4. Claude doit appeler `enregistrer_demande` puis vous répondre en présentant les
   paramètres proposés (demandeur, équipe, expression brute, type) en JSON indenté,
   suivis d'une phrase d'attente de validation — **sans avoir rien écrit en base à ce
   stade**.
5. Répondez pour valider (ex. « confirme »). Claude doit appeler `confirmer_ecriture`
   et vous confirmer l'enregistrement.
6. Ouvrez l'app intégrée (`npm start`, `http://localhost:3737`) sur l'écran
   **Journal** : la demande apparaît, avec `expression_brute` reprenant exactement vos
   mots — même base que celle utilisée par le MCP, pas de synchronisation à faire.
7. Testez le rejet : redemandez un enregistrement, puis répondez « non, annule ».
   Claude doit appeler `rejeter_ecriture` ; rien ne doit apparaître dans le Journal.

## Vérification manuelle

1. `npm run build && npm start`, puis ouvrez `http://localhost:3737`.
2. Dans l'écran Conversation, écrivez :

   > Sophie de l'équipe CS veut voir les factures directement dans la fiche client.

3. L'agent doit répondre puis faire apparaître une **carte de validation** proposant
   `enregistrer_demande`, avec les champs pré-remplis (demandeur, équipe, expression
   brute, type) — éditables avant confirmation.
4. Cliquez *Enregistrer*. La conversation reprend et confirme l'écriture.
5. Ouvrez l'écran **Journal** : la demande apparaît. Ouvrez `registre.db` (ex. avec
   `sqlite3`) et contrôlez la table `demandes` : `expression_brute` contient
   exactement les mots de la phrase, `statut = 'recue'`.
6. Testez ensuite, toujours en conversation : « Décris le système Zoho CRM, module
   Comptes, champ Statut_Client » (`decrire_champ`, proposé puis à valider), « Si je
   modifie Statut_Client, qu'est-ce qui casse ? » (`impact`, lecture directe, pas de
   validation), et ouvrez l'écran **Rapport hebdo**.
7. Ouvrez **Habilitations** et **Champs** : le champ Statut_Client décrit à l'étape 6
   y apparaît aussitôt — même base, mêmes données, pas de synchronisation à faire.

## Écrans

| Écran | Contenu |
|---|---|
| Conversation | Écran principal : streaming, trace discrète des outils de lecture, carte de validation pour toute écriture |
| Tickets | Les demandes en colonnes par statut (reçue → qualifiée → arbitrée → réalisée, écartées à part) — cliquables vers leur fiche complète ; le statut avance via `mettre_a_jour_demande`, proposé puis validé comme toute écriture |
| Journal | Demandes, décisions, changements, incidents — filtrable, cliquable vers la fiche complète de chaque entrée (contexte/options d'une décision, cause/résolution d'un incident, etc.) |
| Constats | La vigie, groupée par famille, conséquence toujours visible |
| Rapport hebdo | Rendu du rapport de la semaine, bouton copier pour l'envoi au CEO |
| Habilitations | Matrice champs × profils — distinction « non déclaré » ≠ « masqué » ≠ « visible » ≠ « édite », filtrable par module |
| Champs | Champs groupés par source de vérité déclarée, contradictions (contrôle M2) en tête de groupe |
| Intégrations | Flux source → cible avec le nombre de constats ouverts rattachés |
| Projets | Liste des projets, puis détail par projet : epics avec leurs tickets (cliquables vers leur fiche : description, plans de test liés), la suite de recette, et la documentation (pages markdown typées, éditeur en page) |
| Base de connaissances | Pages markdown sans projet — l'existant de l'entreprise, des spécifications de référence — même éditeur que la documentation de projet |

Les écrans sont groupés dans la navigation en quatre sections : **Registre**
(Conversation, Tickets, Journal, Constats, Rapport hebdo), **Projets** (Projets,
Base de connaissances), et **Cartographie** (Habilitations, Champs, Intégrations).

## Outils de l'agent

Outils de **lecture** (exécutés immédiatement, jamais de validation) :
`rechercher_journal`, `constats_ouverts`, `lancer_controles`, `generer_rapport`,
`impact`, `etat_projet`, `lire_document`, `rechercher_connaissance`, `charger_mode`.

Outils d'**écriture** (toujours proposés, jamais exécutés sans validation) :
`enregistrer_demande`, `mettre_a_jour_demande`, `enregistrer_decision`,
`mettre_a_jour_decision`, `enregistrer_changement`, `mettre_a_jour_changement`,
`enregistrer_incident`, `mettre_a_jour_incident`, `decrire_systeme`, `decrire_module`,
`decrire_champ`, `decrire_habilitation`, `decrire_integration`,
`decrire_automatisation`, `lier_changement`, `zoho_configurer`, `creer_projet`,
`mettre_a_jour_projet`, `creer_epic`, `mettre_a_jour_epic`, `creer_ticket`,
`mettre_a_jour_ticket`, `creer_plan_test`, `executer_cas_test`,
`lier_ticket_plan_test`, `creer_document`, `mettre_a_jour_document`.

Volontairement absent : aucun outil de suppression, pour aucune entité. Le registre
n'efface pas ce qui s'est passé — corriger une erreur de saisie se fait par une
mise à jour qui garde la trace, pas par un retrait silencieux.

### Documentation et base de connaissances : deux chemins d'écriture

Les pages de documentation (`GET/POST /api/documents`, `PUT /api/documents/:id`,
`GET /api/connaissances`) sont la seule exception au principe « rien sans
validation ». Deux chemins coexistent, volontairement différents :

- **En conversation** : l'agent propose `creer_document` / `mettre_a_jour_document`
  comme n'importe quel autre outil d'écriture — carte de validation obligatoire.
- **Dans l'éditeur en page** (écran Projets → un projet → Documentation, ou écran
  Base de connaissances) : enregistrement direct, sans carte de validation. La
  validation existe pour rattraper l'agent quand il interprète mal ce qu'on lui
  dit ; quand c'est Ghassen qui tape le texte lui-même dans l'éditeur, il n'y a
  rien à valider.

Une page créée avec `projet` appartient à ce projet ; une page créée sans `projet`
rejoint la **base de connaissances** — l'existant de l'entreprise, des
spécifications de référence, indépendants de tout projet en cours. L'agent la
consulte avec `rechercher_connaissance` (recherche plein texte) et `lire_document`
(contenu complet d'une page dont il a l'id — fonctionne aussi pour une page de
projet, qui n'avait jusque-là aucun moyen d'être relue en conversation).

### Modes de travail spécialisés

Le prompt système reste volontairement petit : les instructions détaillées de
quatre modes (analyse d'une demande, architecture de solution, revue SI,
préparation d'un livrable) vivent dans leurs propres fichiers
(`src/agent/modes/*.md`), chargés à la demande par l'outil de lecture
`charger_mode` — jamais injectés en permanence dans la conversation. Le prompt
système contient la table de routage ; c'est l'agent qui décide, à la lecture de
la demande, quel mode charger avant de répondre en profondeur. Pas de mode pour un
échange bref ou une capture rapide au fil de l'eau — c'est le comportement par
défaut, déjà dans le prompt de base.

## Routine hebdomadaire recommandée

- **Au fil de l'eau** : chaque demande reçue, décision prise, changement mis en
  production ou incident constaté s'enregistre en une phrase dans la conversation.
  C'est le seul geste qui rend le registre moins cher qu'une note OneNote.
- **Régulièrement** : « Lance les contrôles » (ou laissez l'agent le faire de
  lui-même avant une revue) pour tenir la vigie à jour.
- **Le vendredi** : ouvrez l'écran Rapport hebdo, copiez, envoyez au CEO. Aucun
  travail supplémentaire si le registre a été alimenté dans la semaine.

## Le critère à J+90 (rappel du CDC §10)

L'outil tient sa promesse si, en moins d'une minute et avec des sources (pas des
souvenirs), il permet de répondre à :

- « Pourquoi ce champ est comme ça ? » — `rechercher_journal` / la carte.
- « Qu'est-ce qui casse si je le change ? » — `impact`.
- « Qu'est-ce qui s'est passé cette semaine ? » — le rapport hebdo.

Si l'un des trois échoue en usage réel, c'est un signal à traiter avant d'ajouter quoi
que ce soit d'autre.

## Développement

```bash
npm run typecheck   # tsc --noEmit (backend)
npm test             # vitest run
npm run build         # backend + front
```

Structure : `src/db` (schéma, migrations), `src/controles` (C/M/I), `src/tools`
(logique des outils, fonctions pures `(db, params) => Resultat`), `src/agent`
(catalogue d'outils, boucle, client Anthropic/compatible OpenAI, prompt système), `src/server` (Hono,
routes API), `src/rapport`, `src/web` (requêtes de cartographie partagées avec l'API
+ rendu HTML autonome utilisé par `generer_rapport(type: "matrice_habilitations")`),
`src/zoho` (Jalon 3) ; `front/` (React + Vite, tous les écrans y compris
cartographie, buildé vers `dist/public`).

## Sauvegarde

La base est un unique fichier SQLite (`registre.db`, plus les fichiers WAL pendant
l'exécution) — y compris l'historique des conversations. Sauvegarder = copier ce
fichier. Les identifiants (clé Anthropic, credentials Zoho une fois configurés)
vivent séparément dans `~/.registre-si/*.json` (permissions 600) — ne jamais les
commiter.

## Continuer le Jalon 3

Le reste de l'import Zoho (`docs/spec-technique-jalon3-zoho.md`) nécessite une étape
en conditions réelles :

1. Créer un Self Client dans la console développeur Zoho (client_id, client_secret,
   grant code), puis proposer `zoho_configurer` depuis la conversation.
2. Implémenter et exécuter `zoho_decouvrir` contre le vrai Zoho d'Abraxio (§3 de la
   spec) — écrit des fichiers bruts dans `~/.registre-si/decouverte-zoho/{date}/`.
3. Copier ces fichiers réels dans `tests/fixtures/zoho/`.
4. Écrire `zoho/mapper.ts` et `zoho/fusion.ts` **validés contre ces fixtures**, pas
   contre la seule documentation (toute divergence structurelle doit être vérifiée
   avec l'extrait JSON réel avant d'écrire le code).
5. `zoho_importer` (aperçu puis appliquer), contrôles de dérive D1-D4, rapport
   `revue_habilitations`.

C'est un arrêt volontaire, pas un oubli : `docs/prompts-claude-code-jalons2-3.md`
(Prompt 17) est explicite là-dessus — « STOP après ce prompt : je reviens avec les
fixtures réelles avant la suite. »
