# Registre SI — Spécification technique Jalon 3 : l'import Zoho et la vigie complète

Complète les specs des Jalons 1 et 2. Prérequis : Jalon 2 livré, carte partiellement
peuplée à la main, accès administrateur au Zoho d'Abraxio.

**Particularité de ce jalon** : il dépend de l'API réelle de Zoho et du périmètre
exact des licences d'Abraxio (CRM seul ? Books ? Desk ?). La spec impose donc une
étape de DÉCOUVERTE outillée avant tout code d'import, et des choix par défaut
prudents partout où l'API peut varier.

---

## 1. Objectif

1. Amorcer et synchroniser la carte depuis les métadonnées Zoho réelles — fini la
   saisie manuelle des champs.
2. Détecter la **dérive** : ce qui a changé dans Zoho sans passer par le registre.
3. Compléter la vigie et les rapports pour atteindre le critère J+90 du CDC :
   répondre en < 1 min à « pourquoi ce champ est comme ça », « qu'est-ce qui casse si
   je le change », « qu'est-ce qui s'est passé cette semaine ».

## 2. Authentification Zoho

- OAuth2 **Self Client** (grant code), le mode prévu par Zoho pour un outil personnel
  de développeur — pas de flux web à héberger.
- Scopes minimaux en lecture : `ZohoCRM.settings.modules.READ`,
  `ZohoCRM.settings.fields.READ`, `ZohoCRM.settings.profiles.READ`,
  `ZohoCRM.settings.ALL` en repli si les scopes fins échouent (à confirmer en
  découverte).
- Stockage : `~/.registre-si/zoho-credentials.json` (client_id, client_secret,
  refresh_token), permissions fichier 600, **jamais dans la DB ni dans un commit**.
  `.gitignore` dès le scaffold.
- Le refresh token Zoho n'expire pas à l'usage ; l'access token (1 h) est rafraîchi à
  la demande et gardé en mémoire seulement.
- Datacenter : l'URL d'API dépend de la région (`.eu` très probable pour Abraxio).
  Paramètre `ZOHO_API_DOMAIN`, défaut `https://www.zohoapis.eu`, à confirmer en
  découverte.

Outil MCP : `zoho_configurer(client_id, client_secret, grant_code)` — échange le code,
stocke le refresh token, retourne les organisations/le datacenter détectés.

## 3. Étape de découverte (OBLIGATOIRE avant l'import)

Outil `zoho_decouvrir()` :

1. Appelle `GET /crm/v8/settings/modules` (version d'API : commencer par v8, replier
   sur v6 si 404 — noter la version retenue dans la sortie).
2. Pour 2 modules (Accounts + 1 module custom s'il existe) :
   `GET /settings/fields?module=...`.
3. `GET /settings/profiles`, et pour 1 profil : le détail des permissions.
4. Écrit le tout, brut, dans `~/.registre-si/decouverte-zoho/{date}/*.json`.
5. Sortie : synthèse — version d'API retenue, nombre de modules, exemples de
   structures de champ et de profil rencontrées.

Règle pour Claude Code : **le mapping d'import (§4) doit être vérifié contre ces
fichiers de découverte réels**, pas contre la documentation seule. Si une structure
diverge de la spec, poser la question avec l'extrait JSON.

## 4. Import des métadonnées

### 4.1 Mapping (défauts prudents, à confirmer en découverte)

| Zoho | Registre | Notes |
|---|---|---|
| module (`api_name`, `plural_label`) | `modules` (upsert par `api_name`) | `systeme` = « Zoho CRM » créé si absent |
| champ (`api_name`, `field_label`, `data_type`) | `champs` | mapping `data_type` → notre enum ; inconnus → 'autre' + avertissement |
| champ `read_only` | `champs.editable = NOT read_only` | n'écrase PAS une valeur saisie à la main (voir 4.3) |
| profil (`name`) | `habilitations.profil` | |
| field-level security par profil | `habilitations.visible/editable` | si l'API des permissions de champ n'est pas accessible avec les licences d'Abraxio : importer seulement les profils, signaler la limite dans la sortie, ne rien inventer |

`source_de_verite`, `regle_metier`, `fraicheur`, `justification` : **jamais importés**
— c'est la connaissance humaine, Zoho ne la contient pas. L'import amorce, l'humain
qualifie.

### 4.2 Outil `zoho_importer`

```ts
entrée: { modules?: string[],            // défaut: tous
          mode: 'apercu' | 'appliquer' } // défaut: 'apercu'
'apercu'   → calcule le diff complet, n'écrit RIEN, retourne le résumé
'appliquer'→ applique le diff, journalise (voir 4.4)
sortie: { ok, version_api, resume: { modules: {crees,maj}, champs: {crees,maj,disparus},
          profils: {...} }, details_disparus: [...], avertissements: [...] }
```

Le mode aperçu par défaut respecte le principe « l'outil propose, l'humain valide ».

### 4.3 Règles de fusion (import vs saisie humaine)

- Un champ importé qui existe déjà (même `api_name` ou même nom) : les colonnes
  factuelles (`type`, `api_name`, `editable`) sont mises à jour ; les colonnes de
  connaissance (`source_de_verite`, `regle_metier`, `fraicheur`) ne sont **jamais**
  touchées par l'import.
- Conflit factuel (ex. `editable` saisi à la main ≠ Zoho) : Zoho gagne sur le
  factuel, ET un constat D3 (dérive, §5) est ouvert pour que l'écart soit examiné —
  il peut révéler une modification faite dans Zoho hors registre.
- Un champ présent dans le registre et disparu de Zoho : marqué (colonne
  `disparu_le`), jamais supprimé — l'historique et les liens restent.

Migration v3 : `ALTER TABLE champs ADD COLUMN disparu_le TEXT;` idem `modules`.
Table `imports (id, date, version_api, resume_json)` pour l'historique.

### 4.4 Journalisation

Chaque `zoho_importer(mode:'appliquer')` crée automatiquement un `changement` de type
`autre` avec description générée (« Import Zoho : 3 champs créés, 1 disparu… »),
rollback = « réimporter l'état précédent (imports/{id}) », lié aux éléments touchés
via `carte_journal`. L'import est un changement comme un autre — il apparaît dans le
rapport hebdo.

## 5. Contrôles de dérive (D)

La famille qui n'existe qu'avec l'import :

| Code | Condition | Conséquence (texte exact) |
|---|---|---|
| D1 | dernier import > 14 j | « La carte n'a pas été synchronisée depuis {n} jours : elle décrit peut-être un SI qui n'existe plus. » |
| D2 | champ `disparu_le` non nul avec liens actifs (intégration, automatisation ou habilitation) | « Le champ {nom} a disparu de Zoho mais {n} éléments s'y réfèrent encore : ils sont cassés ou le seront. » |
| D3 | conflit factuel détecté à l'import (4.3) | « {champ} : le registre disait {a}, Zoho dit {b}. Une modification a eu lieu hors registre. » |
| D4 | module Zoho présent à l'import mais aucune connaissance saisie (aucun champ qualifié) après 30 j | « Module {nom} importé mais jamais qualifié : la carte le voit, personne ne le comprend. » |

D3 est le contrôle le plus important du jalon : c'est lui qui détecte le travail fait
dans Zoho en oubliant le registre — le risque réel de l'opérateur solo pressé.

## 6. Rapports complétés

- **Hebdo** : section « Synchronisation Zoho » (dernier import, dérives D ouvertes).
- **`etat_si`** : taux de qualification par module (champs avec source de vérité /
  champs importés) — la mesure d'avancement de la cartographie, en % honnête.
- Nouveau : `generer_rapport('revue_habilitations')` — la matrice complète + les M3
  (droits sans justification) + les D2 (droits sur champs disparus), en HTML autonome.
  C'est le livrable d'audit périodique.

## 7. Tests exigés

L'API Zoho ne sera pas appelée dans les tests. Architecture imposée :
`zoho/client.ts` (HTTP réel) séparé de `zoho/mapper.ts` et `zoho/fusion.ts`
(fonctions pures sur des JSON). Les tests portent sur mapper et fusion, alimentés par
les **fichiers de découverte réels** copiés dans `tests/fixtures/zoho/`.

1. Mapper : un module et ses champs réels → structures registre attendues ;
   `data_type` inconnu → 'autre' + avertissement.
2. Fusion : import n'écrase jamais `source_de_verite` saisi ; conflit `editable` →
   Zoho gagne + constat D3 ; champ absent du payload → `disparu_le` posé, pas de
   suppression ; re-import identique → zéro écriture (idempotence).
3. Contrôles D1–D4 : déclenche / ne déclenche pas ; D2 exige un lien actif.
4. Aperçu : `mode:'apercu'` ne modifie aucune table (assertion sur les checksums des
   tables avant/après).
5. Sécurité : les credentials ne sont jamais lus par les modules purs ; test que le
   chemin credentials est bien dans `.gitignore` (lecture du fichier).
6. Snapshots : `revue_habilitations` sur jeu fixe.

## 8. Ordre d'implémentation

1. Migration v3 + table `imports` + tests migration.
2. `zoho_configurer` + `zoho/client.ts` (auth, refresh, GET générique avec gestion
   429/backoff simple).
3. `zoho_decouvrir` → **STOP : exécution réelle chez Abraxio, fixtures copiées** →
   validation du mapping contre les fixtures avant de continuer.
4. `zoho/mapper.ts` + tests sur fixtures.
5. `zoho/fusion.ts` (règles 4.3) + tests.
6. `zoho_importer` (aperçu puis appliquer) + journalisation 4.4 + tests d'idempotence.
7. Contrôles D + tests.
8. Rapports complétés + snapshots.

## 9. Critère de fin de projet (rappel du CDC §10)

À J+90 : « pourquoi ce champ est comme ça », « qu'est-ce qui casse si je le change »,
« qu'est-ce qui s'est passé cette semaine » — répondues en moins d'une minute, avec
des sources. Si l'un des trois échoue, le retour d'usage dit quoi corriger avant
d'ajouter quoi que ce soit.
