# Registre SI — Spécification technique Jalon 2 : la carte

Complète la spec du Jalon 1. Même stack, mêmes interdits, mêmes conventions
(`{ ok, ... }`, français partout, fonctions pures testables). Prérequis : Jalon 1
livré et utilisé au moins quelques jours.

---

## 1. Objectif

La cartographie applicative exigée par la fiche de poste, sous forme de base
interrogeable, et la question centrale : **« si je modifie X, qu'est-ce qui casse ? »**

Au Jalon 2 la carte se remplit à la main (conversation). L'import Zoho est au Jalon 3.

## 2. Schéma SQLite (migration v2)

`migrate.ts` passe `user_version` de 1 à 2 en appliquant :

```sql
CREATE TABLE systemes (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  nom         TEXT NOT NULL UNIQUE,          -- 'Zoho CRM', 'App Devis', 'Zoho Books'…
  role        TEXT NOT NULL,                 -- une phrase
  editeur     TEXT,
  criticite   TEXT NOT NULL DEFAULT 'moyenne' CHECK (criticite IN ('haute','moyenne','basse')),
  contact_support TEXT,
  maj_le      TEXT NOT NULL
);

CREATE TABLE modules (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  systeme_id  TEXT NOT NULL REFERENCES systemes(id),
  nom         TEXT NOT NULL,
  api_name    TEXT,                          -- rempli par l'import Zoho au jalon 3
  role_metier TEXT,
  equipes     TEXT,                          -- JSON: ["CS","ADV"]
  maj_le      TEXT NOT NULL,
  UNIQUE (systeme_id, nom)
);

CREATE TABLE champs (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  module_id     TEXT NOT NULL REFERENCES modules(id),
  nom           TEXT NOT NULL,
  api_name      TEXT,
  type          TEXT,                        -- 'texte','liste','devise','nombre','date','booleen','lookup','formule','autre'
  source_de_verite TEXT,                     -- nom de système, texte libre. NULL = non déclaré (contrôlé M1)
  editable      INTEGER,                     -- 0/1, NULL = non déclaré
  regle_metier  TEXT,
  fraicheur     TEXT,                        -- 'temps réel','J+1','manuelle'…
  maj_le        TEXT NOT NULL,
  UNIQUE (module_id, nom)
);

CREATE TABLE habilitations (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  profil      TEXT NOT NULL,                 -- 'CSM','ADV','Manager CS','Admin'…
  champ_id    TEXT NOT NULL REFERENCES champs(id),
  visible     INTEGER NOT NULL DEFAULT 1,
  editable    INTEGER NOT NULL DEFAULT 0,
  justification TEXT,                        -- contrôlé M3 si absente sur un champ sensible
  maj_le      TEXT NOT NULL,
  UNIQUE (profil, champ_id)
);

CREATE TABLE integrations (
  id            TEXT PRIMARY KEY,
  cree_le       TEXT NOT NULL,
  nom           TEXT NOT NULL UNIQUE,        -- 'Devis → CRM'
  source_id     TEXT NOT NULL REFERENCES systemes(id),
  cible_id      TEXT NOT NULL REFERENCES systemes(id),
  auth          TEXT,                        -- 'OAuth2','clé API'…
  strategie     TEXT,                        -- 'event','batch delta','batch complet'
  idempotence   TEXT,                        -- clé/règle. NULL contrôlé I1
  matching      TEXT,                        -- règle de rapprochement. NULL contrôlé I2
  regle_vide    TEXT,                        -- NULL contrôlé I3
  regle_suppression TEXT,
  procedure_reprise TEXT,                    -- NULL contrôlé I5
  maj_le        TEXT NOT NULL
);

CREATE TABLE integration_champs (             -- mapping N-N intégration ↔ champs
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  champ_id       TEXT NOT NULL REFERENCES champs(id),
  sens           TEXT NOT NULL CHECK (sens IN ('lit','ecrit')),
  PRIMARY KEY (integration_id, champ_id, sens)
);

CREATE TABLE erreurs_integration (
  id             TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  titre          TEXT NOT NULL,
  nature         TEXT CHECK (nature IN ('fonctionnelle','technique')),  -- NULL contrôlé I4
  traitement     TEXT,
  rejeu          TEXT,
  maj_le         TEXT NOT NULL
);

CREATE TABLE metriques (
  id             TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  nom            TEXT NOT NULL,
  seuil          TEXT,                       -- NULL contrôlé I6
  maj_le         TEXT NOT NULL
);

CREATE TABLE automatisations (
  id          TEXT PRIMARY KEY,
  cree_le     TEXT NOT NULL,
  module_id   TEXT REFERENCES modules(id),
  nom         TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('workflow','deluge','blueprint','regle_validation','planifie','autre')),
  declencheur TEXT,
  maj_le      TEXT NOT NULL
);

CREATE TABLE automatisation_champs (          -- quels champs une automatisation touche
  automatisation_id TEXT NOT NULL REFERENCES automatisations(id),
  champ_id          TEXT NOT NULL REFERENCES champs(id),
  sens              TEXT NOT NULL CHECK (sens IN ('lit','ecrit')),
  PRIMARY KEY (automatisation_id, champ_id, sens)
);

-- Lien générique carte ↔ journal : quel changement a touché quel élément
CREATE TABLE carte_journal (
  entite_carte  TEXT NOT NULL,               -- 'champ','module','integration','automatisation','habilitation'
  carte_id      TEXT NOT NULL,
  changement_id TEXT NOT NULL REFERENCES changements(id),
  PRIMARY KEY (entite_carte, carte_id, changement_id)
);
```

Extension du FTS : les entités de la carte entrent aussi dans `journal_fts`
(entite = 'champ', 'integration'…), pour que `rechercher_journal` couvre tout.

## 3. Outils MCP ajoutés

### 3.1 `decrire_systeme` / `decrire_module`
Upsert par nom (les descriptions se complètent au fil de l'eau, ne se dupliquent pas).

### 3.2 `decrire_champ`
```ts
entrée: {
  systeme: string, module: string, nom: string,     // résolution par nom, création à la volée
  type?: enum(...), source_de_verite?: string,
  editable?: boolean, regle_metier?: string, fraicheur?: string
}
comportement: upsert. Si le module ou le système n'existe pas → créés avec le minimum,
  et sortie.avertissements le signale ("Système 'App Devis' créé, complète son rôle").
sortie: { ok, id, resume, avertissements: string[] }
```

### 3.3 `decrire_habilitation`
```ts
entrée: { profil: string, systeme: string, module: string, champ: string,
          visible?: boolean, editable?: boolean, justification?: string }
```

### 3.4 `decrire_integration`
```ts
entrée: { nom: string, source: string, cible: string, auth?, strategie?,
          idempotence?, matching?, regle_vide?, regle_suppression?, procedure_reprise?,
          champs?: Array<{ systeme, module, champ, sens: 'lit'|'ecrit' }>,
          erreurs?: Array<{ titre, nature?, traitement?, rejeu? }>,
          metriques?: Array<{ nom, seuil? }> }
comportement: upsert par nom ; les sous-listes REMPLACENT (pas d'append silencieux),
  et la sortie récapitule ce qui a changé.
```

### 3.5 `decrire_automatisation` — même logique, avec `champs: [{...， sens}]`.

### 3.6 `lier_changement(entite_carte, systeme?, module?, nom, changement_id)`
Peuple `carte_journal`. Aussi appelé automatiquement : si `enregistrer_changement`
reçoit un `perimetre` contenant des noms résolus dans la carte, proposer les liens
dans la sortie (l'humain valide en rappelant `lier_changement` — jamais d'écriture
silencieuse).

### 3.7 `impact`
```ts
entrée: { cible: { type: 'champ'|'module'|'integration'|'automatisation',
                   systeme?: string, module?: string, nom: string } }
sortie: {
  ok: true,
  cible: { ... },
  impacts: {
    automatisations: [{ nom, type, sens }],        // qui lit/écrit ce champ
    integrations:    [{ nom, sens }],
    habilitations:   [{ profil, droits }],
    champs?:         [...],                         // si cible = module/automatisation/intégration
  },
  historique: [{ changement_id, date, description }],  // via carte_journal
  resume: string      // « Modifier "Statut_Client" touche 2 workflows, 1 intégration,
                      //   4 profils. Dernier changement : 12/03 (WF relance). »
}
```
Pour un module : agréger les impacts de tous ses champs. Profondeur 1 seulement au
Jalon 2 (pas de propagation transitive) — le noter `// JALON3?` si l'usage le demande.

## 4. Contrôles ajoutés (vigie étendue)

Mêmes conventions que C1–C6 (fonctions pures, textes exacts, upsert idempotent dans
`constats`). `lancer_controles` gagne `perimetre: 'tous'|'pratique'|'modele'|'integration'`.

### Modèle (M)

| Code | Condition | Conséquence (texte exact) |
|---|---|---|
| M1 | `champs.source_de_verite IS NULL` | « Champ sans source de vérité : aucun arbitrage possible en cas d'écart entre systèmes. » |
| M2 | `champs.editable=1` ET `source_de_verite` renseignée ET différente du système du module | « Champ éditable alors que sa source de vérité est {source} : chaque saisie locale créera un écart silencieux. » |
| M3 | champ avec ≥1 habilitation `editable=1` sans `justification` | « Droit de modification accordé sans justification : indéfendable en revue d'habilitations. » |
| M4 | module sans aucun champ décrit depuis > 30 j | « Module déclaré mais jamais cartographié : angle mort du SI. » |

Note M2 : « différente du système du module » = comparaison insensible à la casse
entre `champs.source_de_verite` et `systemes.nom` du module parent.

### Intégration (I)

| Code | Condition | Conséquence |
|---|---|---|
| I1 | `integrations.idempotence IS NULL` | « Pas de clé d'idempotence : un rejeu après incident créera des doublons. » |
| I2 | `matching IS NULL` | « Pas de règle de rapprochement : l'upsert ne peut pas savoir si l'objet existe déjà. » |
| I3 | `regle_vide IS NULL` | « Pas de règle de valeur vide : rejet silencieux ou null en cible. » |
| I4 | `erreurs_integration.nature IS NULL` | « Erreur sans nature : on ne sait pas si elle se corrige (fonctionnelle) ou se rejoue (technique). » |
| I5 | `procedure_reprise IS NULL` | « Pas de procédure de reprise : la reprise sera improvisée hors heures ouvrées. » |
| I6 | `metriques.seuil IS NULL` | « Métrique sans seuil : elle se regarde, elle n'avertit pas. » |
| I7 | intégration sans aucune métrique | « Aucune supervision : la panne sera signalée par un utilisateur. » |

Réutilisation : la logique I1–I7 existe déjà (audit API du projet précédent, 9 tests).
La porter en l'adaptant au schéma, et porter les tests.

## 5. Interface web (lecture seule)

Un seul binaire optionnel : `npm run web` → serveur statique local (le module `http`
de Node, PAS de framework — les interdits tiennent) sur `localhost:3737`, qui rend
4 pages HTML générées côté serveur depuis SQLite :

1. **Matrice d'habilitations** : champs × profils, cellules Visible/Édite/Masqué/
   « non déclaré » (distinction non déclaré ≠ interdit, comme dans l'ancien Zoho
   Studio). Filtre par module.
2. **Champs par source de vérité** : regroupés, contradictions M2 en tête.
3. **Carte des intégrations** : source → cible, constats I ouverts par intégration.
4. **Constats ouverts** : la vigie complète, groupée par famille.

CSS inline minimal (~100 lignes), pas de JS client sauf le filtre de la matrice.
Ces pages sont aussi exportables : `generer_rapport(type:'matrice_habilitations')`
retourne le HTML autonome (à envoyer tel quel au CEO ou à un auditeur).

## 6. Rapports ajoutés

- `generer_rapport('etat_si')` : synthèse markdown — systèmes, modules, champs
  couverts/non couverts, intégrations et leur état de contrôle, constats ouverts par
  famille. C'est le document de passation.
- `generer_rapport('impact', cible)` : la sortie d'`impact()` en markdown, à joindre
  à une demande de validation avant changement.
- Le rapport hebdo (Jalon 1) gagne une section « Carte » : éléments décrits cette
  semaine, constats M/I nouveaux.

## 7. Tests exigés

1. Contrôles M1–M4, I1–I7 : déclenche / ne déclenche pas, y compris M2 avec casse
   différente (« zoho crm » vs « Zoho CRM » ne déclenche pas).
2. `impact()` : un champ touché par 2 automatisations (1 lit, 1 écrit), 1 intégration,
   2 profils → sortie complète ; un champ inconnu → ok:false avec suggestion des noms
   proches (LIKE).
3. Upserts `decrire_*` : rappeler avec les mêmes noms complète, ne duplique pas ;
   les sous-listes d'intégration remplacent.
4. `carte_journal` : lier deux fois = une ligne.
5. Snapshot du rapport `etat_si` sur jeu de données fixe.

## 8. Ordre d'implémentation

1. Migration v2 + tests de migration (v1 → v2 sans perte).
2. Contrôles M et I portés + tests (avant les outils, comme au Jalon 1).
3. Outils `decrire_*` + upserts + tests.
4. `impact()` + tests.
5. `lier_changement` + intégration avec `enregistrer_changement` + tests.
6. Rapports `etat_si` / `impact` + extension hebdo + snapshots.
7. Interface web lecture + vérification manuelle des 4 pages.
