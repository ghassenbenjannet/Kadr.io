# Registre SI — Prompts séquencés pour Claude Code (Jalon 1)

Mode d'emploi : place `cahier-des-charges-registre-SI.md` et
`spec-technique-jalon1-claude-code.md` à la racine du projet (ou dans un dossier
`docs/`). Lance les prompts dans l'ordre, un par session ou par tâche. Chaque prompt
se termine par une vérification : ne passe au suivant que si elle est verte.

---

## Prompt 0 — Cadrage (à coller en premier, une seule fois)

```
Tu vas implémenter le Jalon 1 du projet "Registre SI" décrit dans deux documents à la
racine : cahier-des-charges-registre-SI.md (le produit, le pourquoi) et
spec-technique-jalon1-claude-code.md (le comment, contraignant).

Règles de travail :
- La spec technique est contraignante : stack, schéma SQL, contrats des outils,
  textes des conséquences, format du rapport sont à reprendre EXACTEMENT.
- Toute décision non couverte par la spec : pose-moi la question, n'invente pas.
- Interdits stricts (critères de rejet) : ORM, framework HTTP, base serveur, tout
  service à opérer, toute fonctionnalité de tracker (kanban, vues, tickets).
- Après chaque étape : npm run typecheck && npm test doivent être verts, puis commit
  avec un message décrivant ce qui est vérifié.
- Tout le contenu visible par l'utilisateur (descriptions d'outils MCP, messages
  d'erreur, rapport) est en français.

Confirme que tu as lu les deux documents en me résumant en 5 lignes : le problème,
les 3 blocs du produit, et ce qui est HORS périmètre du Jalon 1.
```

## Prompt 1 — Socle

```
Étape 1 de la spec (§8.1) : scaffold du repo selon l'arborescence §1, tsconfig strict
(strict + noUncheckedIndexedAccess), package.json avec les scripts typecheck / test /
build / start, db/schema.sql repris EXACTEMENT du §2, migrate.ts (applique schema.sql,
PRAGMA user_version=1, idempotent), client.ts (chemin via REGISTRE_DB_PATH, défaut
~/.registre-si/registre.db, création du dossier).

Test attendu : la DB se crée dans un répertoire temporaire, user_version vaut 1,
relancer migrate ne casse rien.
```

## Prompt 2 — Les contrôles (le cœur, avant les outils)

```
Étape 2 (§8.2) : implémente controles/pratique.ts — les 6 contrôles C1 à C6 du §4 de
la spec, en FONCTIONS PURES prenant des lignes en entrée et retournant des constats.
Les textes de conséquence sont repris mot pour mot du tableau §4. Les seuils vivent
dans un objet SEUILS exporté. Note la simplification de C4 en commentaire, comme
demandé.

Tests (§7.1) : pour chaque contrôle, un cas qui déclenche et un qui ne déclenche pas.
C5 : cas limite au seuil exact (14 j ne déclenche pas, 15 j déclenche).
C4 : décision appliquée avec decideur='CEO' ne déclenche pas.
```

## Prompt 3 — Enregistrement

```
Étape 3 (§8.3) : les 4 outils d'enregistrement (spec §3.1 à §3.4) avec schémas zod,
retours { ok, ... } sans exception traversante, et le comportement exact :
- priorité sans arbitre → ok:false avec le message de la spec
- changement sans rollback → ok:true + avertissement (on ne bloque jamais la saisie)
- expression_brute immuable : aucune voie de modification
Ajoute les triggers FTS5 du §2 (insert + update sur les 4 tables).

Tests (§7.3, §7.4) : les deux comportements ci-dessus + immuabilité.
```

## Prompt 4 — Recherche

```
Étape 4 (§8.4) : rechercher_journal selon §3.5 — FTS5 avec préfixes, filtres de dates,
max 20 résultats, extraits (snippet) et lien_conversationnel lisible.

Tests (§7.5) : retrouve « devis » dans une demande, insensible aux diacritiques.
```

## Prompt 5 — La vigie

```
Étape 5 (§8.5) : lancer_controles et constats_ouverts selon §3.6. L'upsert sur
constats respecte l'UNIQUE(controle, entite, entite_id) ; un constat dont la condition
a disparu passe en 'traite' automatiquement.

Tests (§7.2) : rejouer ne duplique pas ; corriger la cause résout le constat.
```

## Prompt 6 — Le rapport

```
Étape 6 (§8.6) : generer_rapport type 'hebdo', format EXACT du §5 de la spec, y
compris les phrases des cas vides. Jamais de code de contrôle (C1…) dans le rapport :
la conséquence rédigée.

Tests (§7.6) : cas « aucun incident » + snapshot complet sur jeu de données fixe.
```

## Prompt 7 — Serveur et installation

```
Étape 7 (§8.7) : server.ts (SDK MCP officiel, transport stdio, enregistrement des 7
outils, migration au démarrage), descriptions d'outils en français rédigées pour
qu'un LLM extraie les paramètres d'une phrase naturelle, README avec le bloc de
config Claude Desktop du §6.

Vérification finale : donne-moi la procédure exacte pour tester depuis Claude
Desktop, et la phrase de test : « Enregistre une demande de Sophie de l'équipe CS :
elle veut voir les factures directement dans la fiche client. » — dis-moi ce que je
dois observer dans la DB.
```

---

## Après le Jalon 1

Utilise l'outil en conditions réelles pendant tes premières semaines chez Abraxio
avant de lancer le Jalon 2 (cartographie). Le critère du CDC §10 s'applique : si le
registre ne t'apporte rien que la conversation seule n'apportait, on s'arrête et on
aura appris à peu de frais. Les prompts du Jalon 2 se rédigeront avec le retour
d'usage réel — notamment le format de `perimetre`, volontairement laissé libre.
