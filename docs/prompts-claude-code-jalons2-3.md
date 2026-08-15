# Registre SI — Prompts séquencés Jalons 2 et 3

Suite de `prompts-claude-code-jalon1.md`. Même règle : un prompt à la fois,
`npm run typecheck && npm test` verts avant de passer au suivant, commit par étape.

Documents à la racine du projet : les trois specs techniques + le cahier des charges.

---

# JALON 2 — La carte

## Prompt 8 — Cadrage Jalon 2

```
Le Jalon 1 est livré. Tu passes au Jalon 2, spécifié dans
spec-technique-jalon2-carte.md. Mêmes règles de travail que le Prompt 0 (spec
contraignante, questions plutôt qu'inventions, interdits, français, typecheck+test
verts par étape).

Confirme en me résumant : les entités de la carte, la question à laquelle impact()
doit répondre, et les deux familles de contrôles ajoutées avec un exemple chacune.
```

## Prompt 9 — Migration v2

```
Étape 1 (§8.1) : migration v2 selon le schéma EXACT du §2 — toutes les tables de la
carte, l'extension FTS aux entités carte, user_version 1→2.

Tests : migrer une DB v1 contenant des données de journal → rien n'est perdu,
user_version=2, remigrer est sans effet.
```

## Prompt 10 — Contrôles M et I

```
Étape 2 (§8.2) : les contrôles M1–M4 et I1–I7 en fonctions pures, textes de
conséquence repris MOT POUR MOT des tableaux §4. La logique I existe dans l'ancien
projet (audit d'intégration) : adapte-la au schéma actuel et porte ses tests.

Tests : déclenche / ne déclenche pas pour chacun. M2 : la comparaison de source est
insensible à la casse (« zoho crm » vs « Zoho CRM » ne déclenche pas).
```

## Prompt 11 — Les outils decrire_*

```
Étape 3 (§8.3) : decrire_systeme, decrire_module, decrire_champ,
decrire_habilitation, decrire_integration, decrire_automatisation — contrats §3,
comportement upsert par nom, création à la volée des parents manquants avec
avertissement, sous-listes d'intégration qui REMPLACENT.

Tests : upsert complète sans dupliquer ; parents créés à la volée signalés ;
remplacement des sous-listes vérifié.
```

## Prompt 12 — impact()

```
Étape 4 (§8.4) : l'outil impact selon §3.7 — automatisations (avec sens lit/écrit),
intégrations, habilitations, historique via carte_journal, et le résumé rédigé en
une phrase. Profondeur 1, agrégation pour un module.

Tests : le cas complet du §7.2 ; cible inconnue → ok:false avec suggestions de noms
proches.
```

## Prompt 13 — Lien carte ↔ journal

```
Étape 5 (§8.5) : lier_changement + l'intégration avec enregistrer_changement (les
liens sont PROPOSÉS dans la sortie, jamais écrits sans validation — principe du CDC).

Tests : lier deux fois = une ligne ; la proposition apparaît quand le périmètre
contient un nom résolu.
```

## Prompt 14 — Rapports et web

```
Étapes 6 et 7 (§8.6, §8.7) : rapports etat_si et impact en markdown, extension du
hebdo (section Carte), puis l'interface web lecture seule du §5 — module http de
Node uniquement, 4 pages, matrice d'habilitations avec la distinction
« non déclaré » ≠ « masqué ».

Tests : snapshots des rapports. Puis donne-moi la procédure de vérification manuelle
des 4 pages web.
```

---

# JALON 3 — L'import Zoho

⚠ Prérequis réels : accès admin au Zoho d'Abraxio, création d'un Self Client dans la
console développeur Zoho (client_id + secret + grant code). Le Prompt 17 s'exécute
en conditions réelles, pas en local seul.

## Prompt 15 — Cadrage Jalon 3

```
Jalon 2 livré. Tu passes au Jalon 3 : spec-technique-jalon3-zoho.md. Ce jalon dépend
d'une API externe : la règle supplémentaire est que le mapping d'import se valide
contre les fichiers de DÉCOUVERTE réels (§3), jamais contre la seule documentation.
Toute divergence entre la spec et l'API réelle : tu me montres l'extrait JSON et tu
poses la question.

Confirme en me résumant : le principe aperçu/appliquer, les règles de fusion
(qu'est-ce que l'import ne touche JAMAIS), et le rôle du contrôle D3.
```

## Prompt 16 — Auth et client HTTP

```
Étapes 1 et 2 (§8.1, §8.2) : migration v3 (disparu_le, table imports),
zoho_configurer (Self Client OAuth2, stockage credentials en ~/.registre-si avec
permissions 600, .gitignore vérifié), zoho/client.ts (refresh token → access token en
mémoire, GET générique, backoff sur 429, ZOHO_API_DOMAIN paramétrable défaut .eu).

Tests : migration v2→v3 sans perte ; le chemin credentials est ignoré par git ;
client testé avec un transport injecté (pas d'appel réel).
```

## Prompt 17 — Découverte (EN RÉEL)

```
Étape 3 (§8.3) : implémente zoho_decouvrir selon §3 (modules, champs de 2 modules,
profils, écriture brute dans ~/.registre-si/decouverte-zoho/{date}/).

Puis donne-moi la procédure pas à pas pour l'exécuter contre le Zoho d'Abraxio
depuis Claude Desktop, et la liste exacte des fichiers que je dois copier dans
tests/fixtures/zoho/ une fois la découverte faite.

STOP après ce prompt : je reviens avec les fixtures réelles avant la suite.
```

## Prompt 18 — Mapper et fusion (sur fixtures réelles)

```
Les fixtures réelles sont dans tests/fixtures/zoho/. Étapes 4 et 5 (§8.4, §8.5) :
zoho/mapper.ts et zoho/fusion.ts en fonctions pures, validés CONTRE CES FIXTURES.
Règles de fusion §4.3 strictes : l'import ne touche jamais source_de_verite,
regle_metier, fraicheur, justification ; conflit factuel → Zoho gagne + constat D3 ;
disparition → disparu_le, jamais de suppression.

Si une structure des fixtures diverge de la spec, montre-moi l'extrait et attends ma
réponse.

Tests : la liste complète du §7.1 et §7.2, y compris l'idempotence du re-import.
```

## Prompt 19 — Import et journalisation

```
Étape 6 (§8.6) : zoho_importer avec mode 'apercu' par défaut (AUCUNE écriture) et
'appliquer' (diff appliqué + changement auto-journalisé selon §4.4, lié via
carte_journal).

Tests : l'aperçu ne modifie aucune table (checksums avant/après) ; l'application
crée exactement un changement avec le rollback pointant l'import précédent.
```

## Prompt 20 — Dérive et livrables finaux

```
Étapes 7 et 8 (§8.7, §8.8) : contrôles D1–D4 (textes exacts du §5, D2 exige un lien
actif), extension du rapport hebdo (section Synchronisation Zoho), taux de
qualification dans etat_si, et le rapport revue_habilitations en HTML autonome.

Tests : D1–D4 déclenche/ne déclenche pas ; snapshot de revue_habilitations.

Termine par un README de fin de projet : installation complète des 3 jalons, la
routine hebdomadaire recommandée (import lundi, contrôles au fil de l'eau, rapport
vendredi), et le critère J+90 du cahier des charges pour évaluer si l'outil tient
sa promesse.
```

---

## Récapitulatif du dossier complet

| Document | Rôle |
|---|---|
| `cahier-des-charges-registre-SI.md` | Le produit : problème, thèse, 3 blocs, critères |
| `spec-technique-jalon1-claude-code.md` | Le journal : schéma, outils, contrôles C, rapport hebdo |
| `spec-technique-jalon2-carte.md` | La carte : cartographie, impact(), contrôles M/I, web |
| `spec-technique-jalon3-zoho.md` | L'import : OAuth, découverte, fusion, contrôles D |
| `prompts-claude-code-jalon1.md` | Prompts 0–7 |
| `prompts-claude-code-jalons2-3.md` | Prompts 8–20 (ce document) |

Deux points de passage en conditions réelles, à ne pas sauter :
- **Entre Jalon 1 et 2** : quelques jours d'usage du journal chez Abraxio.
- **Prompt 17** : la découverte contre le vrai Zoho, avant d'écrire le mapper.
