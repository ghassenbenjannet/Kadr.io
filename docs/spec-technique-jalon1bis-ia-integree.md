# Registre SI — Jalon 1 bis : IA intégrée (correctif d'architecture)

Ce document **corrige** la spec du Jalon 1. L'application n'est plus un serveur MCP
consommé par un client externe : elle embarque son propre agent IA et sa propre
interface.

Les specs des Jalons 2 et 3 restent valables intégralement — seule leur section
« outils MCP » se lit désormais comme « outils de l'agent ».

---

## 1. Ce qui est conservé, ce qui change

| Composant | Sort |
|---|---|
| `db/schema.sql`, `migrate.ts`, `client.ts` | **conservé tel quel** |
| `controles/pratique.ts` (C1–C6) et ses tests | **conservé tel quel** |
| `rapport/hebdo.ts` et ses tests | **conservé tel quel** |
| `tools/*.ts` (logique + schémas zod) | **conservés**, mais ne sont plus exposés en MCP |
| `server.ts` (transport stdio MCP) | **supprimé** |
| Interdit « pas de framework HTTP » | **levé** (§2) |
| Interdits ORM / base serveur / service à opérer | **maintenus** |

Règle de refactorisation : les fichiers `tools/*.ts` doivent exporter des **fonctions
pures d'effet** `(db, params) => Resultat`, avec leur schéma zod et leur description
en français. Aucun import du SDK MCP ne doit subsister. Si ce n'est pas déjà le cas,
extraire la logique avant toute autre étape.

## 2. Architecture cible

```
┌──────────────────────────────────────────────┐
│  Application Registre SI (un seul processus) │
│                                              │
│  React + Vite  ──build──►  dist/ (statique)  │
│      · conversation avec streaming           │
│      · validation des écritures proposées    │
│      · vues lecture (journal, constats)      │
│                    ▲                         │
│                    │ HTTP + SSE              │
│  Hono (serveur)    ▼                         │
│      · /api/chat        (SSE, boucle agent)  │
│      · /api/confirm     (validation d'écriture)│
│      · /api/journal, /api/constats, /api/rapport│
│                    ▲                         │
│  Agent  ───────────┘                         │
│      · prompt système = skill Shadow PO      │
│      · outils = tools/*.ts                   │
│      · API Anthropic (@anthropic-ai/sdk)     │
│                    ▲                         │
│  Métier (inchangé) ▼                         │
│      outils · contrôles · rapports · SQLite  │
└──────────────────────────────────────────────┘
```

Un seul `npm start` : build du front si absent, serveur sur `localhost:3737`.

### Stack ajoutée

| Élément | Choix | Justification |
|---|---|---|
| Serveur HTTP | `hono` | ~15 ko, TypeScript natif, SSE intégré, zéro dépendance |
| Client LLM | `@anthropic-ai/sdk` | streaming + tool use natifs |
| Front | React 18 + Vite + TypeScript | demandé |
| État front | `useState` / `useReducer` | pas de librairie d'état pour une app mono-utilisateur |
| Styles | CSS avec variables, aucun framework | §7 |

Interdits maintenus : pas d'ORM, pas de base serveur, pas de Redis/file d'attente,
pas de tracker réimplémenté.

## 3. Configuration et secrets

`~/.registre-si/config.json`, permissions 600, dans `.gitignore` :

```json
{
  "anthropicApiKey": "sk-ant-...",
  "model": "claude-sonnet-4-6",
  "maxTokens": 4096
}
```

Variables d'environnement prioritaires si présentes (`ANTHROPIC_API_KEY`,
`REGISTRE_MODEL`). Au démarrage, si aucune clé : le serveur démarre quand même, les
vues lecture fonctionnent, et la conversation affiche un message expliquant comment
configurer la clé. **Jamais de plantage au démarrage pour une clé manquante.**

## 4. Migration v1.5 — persistance des conversations

C'est la réponse directe à « les sorties ne persistent pas » : une conversation n'est
plus perdue à la fermeture de l'onglet.

```sql
CREATE TABLE conversations (
  id        TEXT PRIMARY KEY,
  cree_le   TEXT NOT NULL,
  titre     TEXT,                 -- généré depuis le 1er message utilisateur
  maj_le    TEXT NOT NULL
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  cree_le         TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','tool_result')),
  contenu         TEXT NOT NULL,   -- JSON : blocs Anthropic (text, tool_use, tool_result)
  tokens_entree   INTEGER,
  tokens_sortie   INTEGER
);

CREATE TABLE ecritures_proposees (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  message_id      TEXT NOT NULL REFERENCES messages(id),
  tool_use_id     TEXT NOT NULL,   -- id du bloc tool_use Anthropic
  outil           TEXT NOT NULL,
  parametres      TEXT NOT NULL,   -- JSON, éditable par l'utilisateur avant validation
  statut          TEXT NOT NULL DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente','validee','rejetee','modifiee_validee')),
  resultat        TEXT,            -- JSON du retour après exécution
  tranche_le      TEXT
);
```

Les colonnes de tokens permettent de suivre le coût réel sans outil externe.

## 5. L'agent

### 5.1 Prompt système

Fichier `agent/prompt-systeme.md`, chargé au démarrage, composé de :

1. **Le skill Shadow PO** (existant, à coller — c'est le cœur : comment cadrer,
   dériver, qualifier, arbitrer).
2. **Le contexte du registre** : les trois blocs, la distinction demande / décision /
   changement / incident, et la règle absolue « une demande n'est pas une tâche ».
3. **Les consignes d'usage des outils** : enregistrer plutôt que résumer, toujours
   demander le demandeur et l'équipe si absents, ne jamais reformuler
   `expression_brute`.
4. La date du jour, injectée à chaque requête.

Ce fichier est modifiable sans recompiler : c'est ton skill, il doit rester vivant.

### 5.2 Boucle

```
1. Message utilisateur → historique de la conversation (depuis SQLite)
2. Appel Anthropic (stream) avec tools = catalogue (§5.3)
3. Streaming du texte vers le front (SSE, événement 'texte')
4. Si bloc tool_use :
     - outil de LECTURE  → exécution immédiate, tool_result renvoyé, retour en 2
     - outil d'ÉCRITURE  → enregistrement dans ecritures_proposees,
                           événement SSE 'validation_requise', PAUSE de la boucle
5. Sur POST /api/confirm → exécution (ou rejet), tool_result renvoyé, reprise en 2
6. Fin quand la réponse ne contient plus de tool_use
```

Garde-fou : maximum 8 tours de boucle par message utilisateur. Au-delà, arrêt avec un
message explicite — évite les boucles infinies coûteuses en tokens.

### 5.3 Catalogue d'outils

| Outil | Nature | Validation |
|---|---|---|
| `rechercher_journal` | lecture | auto |
| `constats_ouverts` | lecture | auto |
| `lancer_controles` | lecture (calcul, upsert de constats seulement) | auto |
| `generer_rapport` | lecture | auto |
| `enregistrer_demande` | écriture | **requise** |
| `enregistrer_decision` | écriture | **requise** |
| `enregistrer_changement` | écriture | **requise** |
| `enregistrer_incident` | écriture | **requise** |

Adaptateur `agent/outils.ts` : convertit chaque schéma zod en `input_schema` JSON
Schema pour l'API Anthropic (via `zod-to-json-schema`), et associe la description
française déjà écrite au Jalon 1.

`lancer_controles` est classé en lecture bien qu'il écrive dans `constats` : c'est un
calcul déterministe et idempotent, sans effet sur le journal. Le noter en commentaire.

## 6. API HTTP

```
POST /api/chat            { conversationId?, message }  → SSE
     événements : 'texte' | 'outil_lecture' | 'validation_requise' | 'fin' | 'erreur'
POST /api/confirm         { ecritureId, action: 'valider'|'rejeter', parametres? }
GET  /api/conversations   liste
GET  /api/conversations/:id  historique complet
GET  /api/journal         { entite?, depuis?, jusqu_a?, q? }
GET  /api/constats
GET  /api/rapport/hebdo   { semaine? }  → markdown
```

`parametres` dans `/api/confirm` permet à l'utilisateur de **corriger** ce que l'IA a
proposé avant validation — cas fréquent : elle a mal deviné l'équipe du demandeur.

## 7. Interface

Direction visuelle : reprise de celle déjà arrêtée pour ce domaine — **chrome
achromatique, couleur strictement sémantique**. Vert / ambre / rouge sont réservés aux
états (constat ouvert, changement sans rollback, incident) ; aucune couleur de marque
ne vient les concurrencer. Encre brun-noir sur papier légèrement chaud, IBM Plex Sans
pour l'interface, IBM Plex Mono pour tout identifiant (clés, dates, noms techniques).

### Écrans

**1. Conversation (écran principal)**
Zone de saisie en bas, historique au-dessus, streaming du texte au fil de l'eau.

Les appels d'outils sont **visibles mais discrets** : une ligne mono grisée
« recherche dans le journal… » puis « 3 résultats ». L'utilisateur doit voir ce que
l'agent fait sans que ça noie sa réponse.

**2. Carte de validation (dans le fil)**
Quand une écriture est proposée, une carte s'insère dans la conversation :

- le nom de l'action en clair (« Enregistrer une demande »)
- les paramètres en champs **éditables**
- les avertissements du Jalon 1 (« Aucun retour arrière déclaré » sur un changement)
- deux boutons : *Enregistrer* / *Rejeter*

La conversation reste bloquée sur cette carte tant qu'elle n'est pas tranchée — c'est
le point où « l'IA propose, l'humain valide » devient structurel.

**3. Journal** — liste filtrable des quatre entités, lecture seule.

**4. Constats** — regroupés par contrôle, avec la conséquence rédigée en évidence.

**5. Rapport hebdo** — markdown rendu, bouton de copie pour l'envoi au CEO.

Navigation : barre latérale sobre, cinq entrées, plus la liste des conversations
récentes.

## 8. Tests

Les tests du Jalon 1 restent valables et doivent continuer de passer.

Ajouts :

1. **Adaptateur d'outils** : chaque schéma zod produit un JSON Schema valide ; la
   description française est présente et non vide.
2. **Boucle agent** avec client Anthropic **simulé** (aucun appel réel) :
   - un tool_use de lecture s'exécute et relance la boucle
   - un tool_use d'écriture crée une `ecriture_proposee` et **arrête** la boucle
   - après validation, la boucle reprend et se termine
   - après rejet, un `tool_result` d'annulation est renvoyé au modèle
   - 9 tours → arrêt avec message explicite
3. **Correction avant validation** : `/api/confirm` avec `parametres` modifiés
   enregistre bien les valeurs corrigées, pas celles proposées.
4. **Persistance** : une conversation rechargée depuis SQLite restitue exactement les
   blocs, y compris les tool_use et tool_result.
5. **Clé absente** : le serveur démarre, `/api/journal` répond, `/api/chat` retourne
   une erreur explicative.

## 9. Ordre d'implémentation

Chaque étape : `npm run typecheck && npm test` verts, puis commit.

1. **Nettoyage** : supprimer `server.ts` et la dépendance MCP ; extraire la logique
   des `tools/*.ts` en fonctions pures si nécessaire. Les tests du Jalon 1 passent
   toujours.
2. Migration v1.5 (conversations, messages, ecritures_proposees) + tests de migration.
3. `agent/outils.ts` (adaptateur zod → Anthropic) + tests.
4. `agent/boucle.ts` avec client injectable + tests avec client simulé. **Aucun appel
   réel dans les tests.**
5. Serveur Hono : routes lecture d'abord (`/api/journal`, `/api/constats`,
   `/api/rapport/hebdo`), puis `/api/chat` en SSE, puis `/api/confirm`.
6. Front React : coquille + vues lecture (Journal, Constats, Rapport).
7. Front : conversation avec streaming.
8. Front : carte de validation éditable.
9. `agent/prompt-systeme.md` : structure et emplacements à remplir. **Me demander le
   contenu du skill Shadow PO** plutôt que d'en inventer un.
10. README : installation, configuration de la clé, `npm start`, et la routine
    hebdomadaire.

## 10. Impact sur les Jalons 2 et 3

Aucun changement de fond. Les outils `decrire_*`, `impact`, `zoho_*` s'ajoutent au
catalogue §5.3 avec leur nature :

- lecture : `impact`, `zoho_decouvrir`, `zoho_importer(mode:'apercu')`
- écriture : tous les `decrire_*`, `lier_changement`, `zoho_configurer`,
  `zoho_importer(mode:'appliquer')`

Les vues web du Jalon 2 (matrice d'habilitations, carte des intégrations) deviennent
des écrans React de cette même application au lieu d'un serveur statique séparé.
