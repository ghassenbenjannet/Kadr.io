# Registre SI — Jalon 4 : transport MCP + gel du périmètre

Objectif : rendre l'outil utilisable depuis Claude Desktop (couvert par l'abonnement Max, zéro coût au token) tout en gardant l'app intégrée. Le chat mûr devient claude.ai ; l'app garde ce qu'elle seule fait. Aucune fonctionnalité existante n'est retirée.

Prérequis : branche `claude/registre-si-specs-6lo1ab` (auditée : 212 tests verts). Mêmes règles que les jalons précédents : spec contraignante, questions plutôt qu'inventions, français partout, `typecheck + test` verts à chaque étape.

## 1. Directives de gel (valables pour tous les jalons suivants)

* Aucune nouvelle feature sur les vues `Conversation`, `Projets`, `ProjetDetail`, `Tickets`, `TicketDetail`, `DocumentEditor`, `BaseConnaissances`. Corrections de bug uniquement. Ces écrans concurrencent Jira/Confluence et ne gagneront jamais — la conversation mûre est désormais Claude Desktop.
* Tout investissement UI futur va exclusivement aux vues uniques : `Journal`, `Constats`, `Habilitations`, `Integrations`, `ChampsSourceVerite`, `RapportHebdo`.
* Interdits inchangés : ORM, base serveur, service à opérer, suppression d'entités primaires, modification d'`expression_brute`.

## 2. Principe du transport MCP

Le serveur MCP expose les mêmes outils que l'agent intégré (catalogue de `agent/outils.ts`), avec la même règle :

* Outil de lecture → exécution directe, résultat retourné.
* Outil d'écriture → PAS d'exécution : création d'une `ecriture_proposee` (statut `en_attente`) et réponse texte : « Écriture proposée #id — voici les paramètres et les avertissements. Confirme, corrige, ou rejette. »
* Deux nouveaux outils MCP tranchent : `confirmer_ecriture` (exécute, éventuellement avec paramètres corrigés) et `rejeter_ecriture`.

Le principe « l'IA propose, l'humain valide » survit donc au changement de client : la validation passe par la conversation (« mets ADV comme équipe puis confirme ») au lieu de la carte cliquable.

Interdits spécifiques à ce jalon — à vérifier par grep en fin de travail :

* `src/mcp/**` n'importe JAMAIS `@anthropic-ai/sdk`, `agent/client.ts`, `agent/boucle.ts` ni `agent/prompt.ts`. Le serveur MCP est un fournisseur d'outils : le raisonnement, c'est Claude Desktop qui le fait, couvert par l'abonnement.
* `confirmer_ecriture` exécute la fonction d'outil directement puis tranche. Il ne rappelle aucune boucle, ne reprend aucune conversation, ne touche pas à l'API Anthropic.

## 3. Migration v8 — écritures hors conversation

`ecritures_proposees` exige aujourd'hui `conversation_id` et `message_id` NOT NULL. Une écriture née en MCP n'a ni l'un ni l'autre.

SQLite ne sait pas retirer un NOT NULL par ALTER : reconstruction de table (pattern : CREATE nouvelle table → INSERT SELECT → DROP → RENAME), en suivant le style des migrations v2–v7 existantes :

```sql
-- v8-mcp.sql
CREATE TABLE ecritures_proposees_v8 (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),   -- nullable désormais
  message_id      TEXT REFERENCES messages(id),        -- nullable désormais
  origine         TEXT NOT NULL DEFAULT 'app' CHECK (origine IN ('app','mcp')),
  tool_use_id     TEXT NOT NULL,
  outil           TEXT NOT NULL,
  parametres      TEXT NOT NULL,
  statut          TEXT NOT NULL DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente','validee','rejetee','modifiee_validee')),
  resultat        TEXT,
  tranche_le      TEXT
);
INSERT INTO ecritures_proposees_v8
  SELECT id, conversation_id, message_id, 'app', tool_use_id, outil, parametres,
         statut, resultat, tranche_le
  FROM ecritures_proposees;
DROP TABLE ecritures_proposees;
ALTER TABLE ecritures_proposees_v8 RENAME TO ecritures_proposees;
```

Pour une écriture MCP : `tool_use_id = 'mcp-' + nanoid()`, `origine='mcp'`.

Adaptation de `trancherEcriture` / du flux de confirmation : quand `conversation_id` est NULL, ne pas insérer de message `tool_result` dans `messages` (il n'y a pas de conversation). Le comportement app existant reste inchangé.

## 4. Avertissements partagés

La logique d'avertissements à la proposition vit côté front (`front/src/lib/avertissements-proposition.ts`). La porter dans `src/agent/avertissements.ts` (fonctions pures : `(outil, parametres) => string[]`), la faire consommer par le front (import ou duplication assumée si le build front ne peut pas importer src — dans ce cas le noter en commentaire) et par le serveur MCP, pour que « Aucun retour arrière déclaré… » apparaisse dans la réponse de proposition que Claude relaie.

## 5. Serveur MCP — `src/mcp/server.ts`

* SDK : `@modelcontextprotocol/sdk` (à ajouter aux dépendances), transport stdio.
* Nom du serveur : `registre-si`.
* Au démarrage : ouvrir la DB via `REGISTRE_DB_PATH` (même défaut que l'app), appliquer les migrations (réutiliser `migrate.ts`).
* Outils exposés : tout le catalogue de `agent/outils.ts` sauf `charger_mode` (spécifique à l'agent intégré), plus trois outils propres au transport :

### 5.1 `confirmer_ecriture`

```ts
entrée: { ecriture_id: string, parametres?: object }
comportement:
  - introuvable → ok:false "Écriture introuvable."
  - statut ≠ en_attente → ok:false "Écriture déjà tranchée (statut)."
  - parametres fournis → validation zod contre le schéma de l'outil d'origine ;
    échec → ok:false avec les erreurs lisibles
  - exécution de la fonction d'outil ; tranche en 'validee' ou 'modifiee_validee'
  - conversation_id non nul → insérer le tool_result (compat app) ; sinon rien
sortie: { ok: true, statut, resultat }   // resultat = sortie de l'outil (resume inclus)
```

### 5.2 `rejeter_ecriture`

```ts
entrée: { ecriture_id: string, raison?: string }
→ tranche 'rejetee' (raison stockée dans resultat), ok:true
```

### 5.3 `ecritures_en_attente`

```ts
entrée: {}
→ { ok:true, ecritures: [{ id, outil, parametres, origine, cree_le?, avertissements }] }
```

(Si `cree_le` n'existe pas dans la table, l'omettre — ne pas l'ajouter au schéma.)

### 5.4 Format des réponses MCP

Réponses = bloc(s) `text` en français, lisibles tels quels par l'utilisateur dans Claude Desktop :

* Lecture : le `resume` de l'outil, puis les données utiles (compactes, pas de dump JSON brut si un résumé suffit ; `rechercher_journal` liste ses extraits).
* Proposition d'écriture : « Écriture proposée `#id` (outil) », les paramètres en JSON indenté, puis les avertissements, puis la phrase d'attente de validation.
* `ok:false` → le message d'erreur, sans stack trace.

### 5.5 Script et build

* `package.json` : script `"mcp": "node dist/mcp/server.js"`.
* `tsconfig.build.json` : inclure `src/mcp`.
* La DB est partagée avec l'app (WAL déjà actif) : app et serveur MCP peuvent tourner en même temps pour un usage solo. Le noter dans le README.

## 6. Documentation livrée

### 6.1 README — section « Utiliser depuis Claude Desktop »

Bloc prêt à coller (adapter le chemin) :

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

Plus : le rappel que la conversation est alors couverte par l'abonnement claude.ai (aucune clé API requise pour ce mode), et que l'app intégrée reste disponible pour les vues et l'agent embarqué.

### 6.2 `docs/projet-claude-desktop.md`

Les instructions à coller dans un Projet Claude (claude.ai / Desktop), dérivées de `src/agent/prompt-systeme.md` — ne pas réinventer : condenser le rôle, les quatre natures, les principes (expression_brute intouchable, priorité attribuable, challenges systématiques), et ajouter la consigne propre au transport :

> Les outils d'écriture ne font que proposer. Après chaque proposition, présente-moi les paramètres et les avertissements, attends ma décision, puis utilise `confirmer_ecriture` (avec mes corrections éventuelles) ou `rejeter_ecriture`. Ne confirme jamais de ta propre initiative.

Conserver tels quels les deux blocs `<<< À COMPLÉTER >>>`.

## 7. Tests exigés

Sans processus stdio réel : instancier le serveur et invoquer les handlers directement (ou via le transport in-memory du SDK).

1. Migration v8 : DB v7 avec écritures existantes → reconstruite sans perte, `origine='app'` partout, remigrer sans effet.
2. Lecture via MCP : `rechercher_journal` exécute et répond (pas d'écriture proposée).
3. Écriture via MCP : `enregistrer_changement` sans rollback → AUCUNE ligne dans `changements`, une `ecriture_proposee` `origine='mcp'`, réponse contenant l'avertissement rollback.
4. `confirmer_ecriture` : exécute, ligne créée, statut `validee` ; avec `parametres` corrigés → `modifiee_validee` et les valeurs corrigées en base ; deuxième confirmation → ok:false « déjà tranchée » ; paramètres invalides (zod) → ok:false, écriture toujours `en_attente`.
5. `rejeter_ecriture` : statut `rejetee`, aucune ligne métier créée.
6. Écriture MCP tranchée (`conversation_id` NULL) → aucune ligne dans `messages`.
7. Flux app inchangé : le test existant de la boucle (proposition → confirm → reprise) passe sans modification.
8. Garde d'imports : test qui lit `src/mcp/*.ts` et échoue si `@anthropic-ai/sdk`, `agent/client`, `agent/boucle` ou `agent/prompt` y est importé.

## Prompts pour Claude Code

### Prompt H — Cadrage

```
Nouveau jalon : lis docs/spec-jalon4-mcp.md (ce document, à placer dans le repo).

Résume-moi avant de coder : (1) ce que le transport MCP ajoute et ce qu'il n'importe
JAMAIS, (2) comment « l'IA propose, l'humain valide » survit sans carte cliquable,
(3) les directives de gel du §1. Mêmes règles de travail que les jalons précédents.
```

### Prompt I — Migration v8 et tranchage hors conversation

```
Étapes §3 : migration v8 par reconstruction de table (pattern des migrations
existantes), origine 'app'/'mcp', puis adaptation du tranchage pour qu'une écriture
sans conversation_id ne crée aucun message tool_result.

Tests : §7.1, §7.6, et le §7.7 (les tests existants de la boucle passent sans
modification).
```

### Prompt J — Avertissements partagés et serveur MCP

```
Étapes §4 et §5 : porte les avertissements en src/agent/avertissements.ts (fonctions
pures), puis crée src/mcp/server.ts : catalogue complet sauf charger_mode, lecture
directe, écriture → proposition, et les trois outils confirmer_ecriture /
rejeter_ecriture / ecritures_en_attente selon les contrats exacts du §5. Réponses en
français lisibles (§5.4). Script npm "mcp", build inclus.

Tests : §7.2 à §7.5, §7.8 (garde d'imports).
```

### Prompt K — Documentation et vérification finale

```
Étape §6 : section README « Utiliser depuis Claude Desktop » avec le bloc de config,
et docs/projet-claude-desktop.md dérivé de src/agent/prompt-systeme.md (blocs
<<< À COMPLÉTER >>> conservés, consigne de validation ajoutée).

Puis donne-moi la procédure de test manuel de bout en bout : config Claude Desktop,
redémarrage, et la phrase « Enregistre : Sophie du CS veut voir les factures dans la
fiche client » — en me décrivant exactement ce que je dois voir (proposition,
avertissements éventuels, confirmation, ligne en base).
```
