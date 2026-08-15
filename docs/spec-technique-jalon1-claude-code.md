# Registre SI — Spécification technique d'implémentation (Jalon 1 : le journal)

Ce document complète le cahier des charges produit. Il est destiné à Claude Code.
Toute décision non couverte ici doit être posée comme question, pas inventée.

---

## 1. Stack imposée

| Élément | Choix | Justification |
|---|---|---|
| Langage | TypeScript strict (`"strict": true`, `noUncheckedIndexedAccess`) | |
| Runtime | Node.js ≥ 20 | |
| Serveur MCP | `@modelcontextprotocol/sdk` (officiel), transport **stdio** | S'enregistre dans Claude Desktop / ChatGPT via config |
| Base | SQLite via `better-sqlite3` (synchrone) | Un fichier, zéro service |
| Validation | `zod` — chaque outil MCP a un schéma zod strict | |
| Tests | `vitest` | |
| Rapport | Markdown généré, pas de moteur de template | |
| Interdits | ORM (Prisma/Drizzle), framework HTTP, base serveur, tout service à opérer | Critère de rejet §11 du CDC |

Structure du repo :

```
registre-si/
  src/
    db/
      schema.sql          # source de vérité du schéma
      migrate.ts          # applique schema.sql, gère PRAGMA user_version
      client.ts           # ouverture DB, chemin via env REGISTRE_DB_PATH
    tools/                # 1 fichier = 1 outil MCP
      enregistrer-demande.ts
      enregistrer-decision.ts
      enregistrer-changement.ts
      enregistrer-incident.ts
      rechercher-journal.ts
      constats-ouverts.ts
      generer-rapport.ts
    controles/
      pratique.ts         # les 6 contrôles §6.3, fonctions pures
    rapport/
      hebdo.ts
    server.ts             # enregistrement des outils, point d'entrée MCP
  tests/
    controles.test.ts
    outils.test.ts
    rapport.test.ts
  package.json
  tsconfig.json
  README.md               # installation + config Claude Desktop
```

## 2. Schéma SQLite (exact, à reprendre tel quel)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Toutes les dates en ISO 8601 UTC (TEXT). Tous les id en TEXT (nanoid 12).

CREATE TABLE demandes (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  demandeur     TEXT NOT NULL,              -- nom de la personne
  equipe        TEXT NOT NULL CHECK (equipe IN
                  ('CS','AE','Marketing','ADV','Produit','Communication','Direction','Autre')),
  expression_brute TEXT NOT NULL,           -- verbatim, jamais modifié après création
  reformulation TEXT,                       -- nullable : peut venir plus tard
  type          TEXT NOT NULL CHECK (type IN
                  ('evolution','correction','question','acces','incident')),
  priorite      TEXT CHECK (priorite IN ('P1','P2','P3')),
  priorite_arbitree_par TEXT,               -- obligatoire si priorite non nulle (contrôle applicatif)
  statut        TEXT NOT NULL DEFAULT 'recue' CHECK (statut IN
                  ('recue','qualifiee','arbitree','realisee','refusee','reportee')),
  maj_le        TEXT NOT NULL
);

CREATE TABLE decisions (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  contexte      TEXT NOT NULL,
  options       TEXT NOT NULL,              -- JSON: [{option, ecartee_car}]
  decision      TEXT NOT NULL,
  decideur      TEXT NOT NULL,              -- 'moi' | 'CEO' | nom
  consequences  TEXT,
  statut        TEXT NOT NULL DEFAULT 'proposee' CHECK (statut IN
                  ('proposee','validee','appliquee','remplacee')),
  remplacee_par TEXT REFERENCES decisions(id),
  maj_le        TEXT NOT NULL
);

CREATE TABLE changements (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  description   TEXT NOT NULL,
  perimetre     TEXT NOT NULL,              -- texte libre jalon 1 ; liens carto au jalon 2
  type          TEXT NOT NULL CHECK (type IN
                  ('parametrage','deluge','sql','javascript','config_api','habilitations','autre')),
  rollback      TEXT,                       -- nullable MAIS contrôlé par la vigie (C1)
  test_effectue TEXT,                       -- nullable MAIS contrôlé (C2)
  communication TEXT,
  demande_id    TEXT REFERENCES demandes(id),
  decision_id   TEXT REFERENCES decisions(id),
  maj_le        TEXT NOT NULL
);

CREATE TABLE incidents (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  symptome      TEXT NOT NULL,
  impact        TEXT NOT NULL,
  cause         TEXT,
  changement_id TEXT REFERENCES changements(id),  -- le changement fautif s'il existe
  resolution    TEXT,
  resolu_le     TEXT,
  action_preventive TEXT,
  prevention_faite  INTEGER NOT NULL DEFAULT 0,   -- booléen 0/1
  maj_le        TEXT NOT NULL
);

-- Recherche plein texte sur tout le journal
CREATE VIRTUAL TABLE journal_fts USING fts5(
  entite, entite_id UNINDEXED, contenu,
  tokenize = 'unicode61 remove_diacritics 2'
);
-- Peuplée par triggers AFTER INSERT/UPDATE sur les 4 tables :
-- contenu = concaténation des champs texte de la ligne.

CREATE TABLE constats (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  controle    TEXT NOT NULL,                -- code C1..C6
  entite      TEXT NOT NULL,                -- 'changement' | 'decision' | 'demande' | 'incident'
  entite_id   TEXT NOT NULL,
  consequence TEXT NOT NULL,                -- rédigée, voir §4
  statut      TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','traite','accepte')),
  traite_le   TEXT,
  UNIQUE (controle, entite, entite_id)      -- un constat par (contrôle, objet) : rejouer ne duplique pas
);
```

Règles :
- `expression_brute` est **immuable** : aucun outil ne doit permettre de la modifier.
- `maj_le` mis à jour à chaque écriture.
- Rejouer les contrôles fait un UPSERT sur `constats` ; un constat dont la condition a
  disparu passe automatiquement en `traite`.

## 3. Outils MCP — contrats exacts

Conventions communes :
- Tous les retours : `{ ok: true, ... }` ou `{ ok: false, erreur: string }`. Jamais
  d'exception qui traverse le transport.
- Chaque outil a une `description` MCP en français, rédigée pour qu'un LLM sache
  extraire les paramètres d'une phrase naturelle.

### 3.1 `enregistrer_demande`

```ts
entrée (zod): {
  demandeur: string,                // requis
  equipe: enum(...),                // requis — si l'utilisateur ne le dit pas, le LLM demande
  expression_brute: string,         // requis — les mots exacts
  reformulation?: string,
  type: enum('evolution','correction','question','acces','incident'),
  priorite?: enum('P1','P2','P3'),
  priorite_arbitree_par?: string
}
règle: si priorite fournie sans priorite_arbitree_par → ok:false,
       erreur "Une priorité doit être attribuable : qui l'a arbitrée ?"
sortie: { ok: true, id, resume: string }   // resume = 1 ligne relisible en conversation
```

### 3.2 `enregistrer_decision`

```ts
entrée: {
  contexte: string,
  options: Array<{ option: string, ecartee_car?: string }>,  // min 1
  decision: string,
  decideur: string,
  consequences?: string,
  statut?: enum('proposee','validee') = 'proposee'
}
sortie: { ok: true, id, resume }
```

### 3.3 `enregistrer_changement`

```ts
entrée: {
  description: string,
  perimetre: string,
  type: enum('parametrage','deluge','sql','javascript','config_api','habilitations','autre'),
  rollback?: string,
  test_effectue?: string,
  communication?: string,
  demande_id?: string,        // vérifié: existe, sinon ok:false
  decision_id?: string
}
comportement: si rollback absent → l'enregistrement RÉUSSIT, mais la sortie contient
  avertissement: "Aucun retour arrière déclaré. Le contrôle C1 restera ouvert."
  (on n'empêche jamais la saisie : la friction tue le registre — CDC §3.3)
sortie: { ok: true, id, resume, avertissements: string[] }
```

### 3.4 `enregistrer_incident` — même logique, lien `changement_id` vérifié.

### 3.5 `rechercher_journal`

```ts
entrée: { question: string, depuis?: string, jusqu_a?: string, entites?: string[] }
comportement:
  1. requête FTS5 sur journal_fts (question → MATCH, avec préfixe * sur chaque terme)
  2. filtre dates sur cree_le
  3. retourne max 20 résultats, ordonnés par pertinence FTS puis date desc
sortie: { ok: true, resultats: Array<{ entite, id, date, extrait, lien_conversationnel }> }
  // extrait = snippet FTS ; lien_conversationnel = "changement du 12/03 : …"
```

### 3.6 `lancer_controles` / `constats_ouverts`

```ts
lancer_controles: { perimetre?: enum('tous','pratique') = 'tous' }
  → exécute §4, upsert constats, sortie { ok, nouveaux: n, resolus: n, ouverts: [...] }
constats_ouverts: {} → { ok, constats: [{ controle, entite, resume, consequence, depuis }] }
```

### 3.7 `generer_rapport`

```ts
entrée: { type: enum('hebdo'), semaine?: string /* ISO ex 2026-W34, défaut courante */ }
sortie: { ok: true, markdown: string, chemin?: string }
```

## 4. Contrôles de pratique — définitions exécutables

Fonctions **pures** dans `controles/pratique.ts` : `(rows) => Finding[]`. Testables
sans DB.

| Code | Condition d'échec (SQL logique) | Conséquence (texte exact) |
|---|---|---|
| C1 | `changements.rollback IS NULL` et âge > 0 j | « Aucun retour arrière déclaré : un incident sur ce changement se traitera en improvisation. » |
| C2 | `changements.test_effectue IS NULL` | « Aucun test déclaré : la recette de ce changement, c'est l'utilisateur en production. » |
| C3 | `changements.demande_id IS NULL AND decision_id IS NULL` | « Changement sans origine : le SI dérive sans trace de qui a demandé quoi. » |
| C4 | `decisions.statut='appliquee'` sans passage par `validee` (voir note) | « Décision appliquée jamais validée : engagement pris sans couverture du décideur. » |
| C5 | `demandes.statut IN ('recue','qualifiee')` et âge > 14 j | « Demande en attente depuis N jours : la confiance de l'équipe {equipe} s'érode en silence. » |
| C6 | `incidents.resolu_le NOT NULL AND action_preventive IS NULL` | « Incident résolu sans action préventive : le même incident reviendra. » |

Note C4 : jalon 1, on ne trace pas l'historique de statut. Implémenter comme :
`statut='appliquee' AND decideur='moi'` → un engagement structurel auto-validé est le
signal recherché. Documenter cette simplification dans le code.

Seuils (14 j pour C5, etc.) dans un objet `SEUILS` exporté, pas en dur dans les requêtes.

## 5. Rapport hebdo — format exact

```markdown
# Revue SI — semaine {ISO}

## Demandes
{n} reçues ({répartition par équipe}), {n} traitées, {n} en attente
{si attente > 0 : liste "— {demandeur} ({equipe}) : {reformulation|expression_brute}, depuis {n} j"}

## Changements en production
{par changement : "— {date} · {type} · {description}" + "⚠ sans rollback" si C1}

## Incidents
{par incident : "— {symptome} · impact : {impact} · {résolu en Xh | en cours}"}
{si aucun : "Aucun incident cette semaine."}

## Points de vigilance
{constats ouverts, groupés par contrôle, avec conséquence}
{si aucun : "Aucun point de vigilance ouvert."}

## Semaine prochaine
{demandes arbitrées non réalisées, décisions validées non appliquées}
```

Ton : factuel, phrases complètes, pas de jargon de l'outil (jamais « C1 » dans le
rapport — la conséquence rédigée, oui).

## 6. Serveur et installation

- `server.ts` : instancie le SDK MCP, transport stdio, enregistre les 7 outils,
  applique les migrations au démarrage.
- Chemin DB : `process.env.REGISTRE_DB_PATH`, défaut `~/.registre-si/registre.db`
  (créer le dossier).
- README : bloc de config Claude Desktop prêt à coller :

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

## 7. Tests exigés (vitest)

1. **Contrôles** (prioritaire) : pour chacun de C1–C6, un cas qui déclenche et un cas
   qui ne déclenche pas. C5 : cas limite exactement au seuil (14 j = ne déclenche
   pas ; 15 j = déclenche). C4 : `decideur='CEO'` appliquée ne déclenche pas.
2. **Idempotence des constats** : lancer deux fois les contrôles ne crée pas de
   doublon ; corriger la cause passe le constat en `traite`.
3. **Immuabilité** : aucune voie pour modifier `expression_brute` après création.
4. **Outils** : `enregistrer_demande` avec priorité sans arbitre → `ok:false` ;
   `enregistrer_changement` sans rollback → `ok:true` + avertissement.
5. **FTS** : `rechercher_journal("devis")` retrouve une demande contenant « devis »,
   insensible aux accents (« délai » ↔ « delai »).
6. **Rapport** : semaine sans incident → « Aucun incident cette semaine. » ;
   snapshot du rendu complet sur un jeu de données fixe.

## 8. Ordre d'implémentation (pour Claude Code, étape par étape)

Chaque étape se termine par : `npm run typecheck && npm test` verts, et un commit.

1. Scaffold repo + tsconfig strict + schema.sql + migrate + client. Test : la DB se
   crée, `PRAGMA user_version` = 1.
2. `controles/pratique.ts` en fonctions pures + leurs 12+ tests. (Avant les outils :
   c'est le cœur, et c'est testable sans MCP.)
3. Outils d'enregistrement (3.1–3.4) + triggers FTS + tests outils/immuabilité.
4. `rechercher_journal` + tests FTS.
5. `lancer_controles` / `constats_ouverts` (upsert idempotent) + tests.
6. `generer_rapport` hebdo + tests snapshot.
7. `server.ts` + README + config Claude Desktop. Vérification manuelle : depuis
   Claude Desktop, « enregistre une demande de Sophie (CS) qui veut voir les factures
   dans la fiche client » crée bien la ligne.

## 9. Hors périmètre du Jalon 1 (ne pas implémenter)

Cartographie (tables, outils `decrire_*`, `impact`), import Zoho, contrôles §6.1/§6.2
du CDC, interface web, autre rapport que l'hebdo. Si une décision de conception du
Jalon 1 engage le Jalon 2 (ex. format de `perimetre`), choisir l'option la plus
simple et le noter en commentaire `// JALON2:`.
