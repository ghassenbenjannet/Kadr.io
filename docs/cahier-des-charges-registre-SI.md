# Cahier des charges — Registre SI

**Outil personnel de l'opérateur SI solo chez Abraxio**
Version 1.0 · remplace tous les cahiers des charges précédents (« BA Integrator OS », « Couche BA »)

---

## 1. Contexte et problème

### Le poste

Business Analyst / Intégrateur ERP chez Abraxio, **seul sur le périmètre SI**, sous la
responsabilité directe du CEO. Le poste couvre l'intégralité du cycle : recueil des
besoins (CS, AE, Marketing, ADV, Produit, Communication), spécification, paramétrage et
développement (Deluge, SQL, JavaScript), mise en production, support, habilitations,
tickets éditeur Zoho, documentation et cartographie applicative.

Outillage existant côté Abraxio : **OneNote**. Pas de tracker, pas de wiki structuré,
pas d'équipe pour partager la mémoire.

### Le vrai risque

Quand tout le SI passe par une seule personne, le point de défaillance unique n'est pas
un serveur : c'est **la mémoire de cette personne**.

Les questions qui coûteront cher dans six mois :

- Pourquoi ce champ est-il en lecture seule pour le profil ADV ?
- Qu'est-ce que j'ai modifié la semaine où la synchro devis a cassé ?
- Qui a demandé cette règle, et qui l'a validée ?
- Ce workflow Deluge, il touche quels champs, et qu'est-ce qui casse si je le modifie ?
- Comment revenir en arrière sur la mise en prod de mardi ?

OneNote peut contenir des notes sur tout ça. Il ne peut ni le structurer, ni le
requêter, ni le **vérifier**. Une note n'a jamais dit « attention, ce champ éditable
contredit sa source de vérité ».

### Ce que cet outil n'est pas

Les tentatives précédentes ont reconstruit un tracker (kanban, tickets, vues). C'était
une erreur de cible : il n'y a pas d'équipe de delivery à outiller. Il y a **un
opérateur solo à protéger de sa propre mémoire**, et un SI à garder cohérent.

## 2. Thèse produit

> Le Registre SI est la mémoire structurée et vérifiable du SI d'Abraxio.
> Il enregistre pourquoi les choses sont comme elles sont, cartographie ce qui existe,
> et contrôle que l'ensemble reste cohérent.

Trois blocs, un seul outil :

```
DEMANDES → DÉCISIONS → CHANGEMENTS          (le journal : pourquoi)
        MODULES · CHAMPS · FLUX · DROITS     (la carte : quoi)
        CONTRÔLES → CONSTATS → RAPPORTS      (la vigie : est-ce cohérent)
```

## 3. Principes de conception

1. **MCP d'abord.** L'outil est un serveur MCP. Il s'utilise depuis Claude ou ChatGPT
   en conversation — le mode de travail déjà éprouvé (Jira + Confluence + projet
   ChatGPT). Pas de troisième solution à maintenir : la conversation EST l'interface
   de saisie et d'interrogation.
2. **Une interface web minimale, en lecture.** Uniquement pour ce qui ne se lit pas en
   conversation : matrices croisées, cartographie, rapports. Zéro formulaire.
3. **La saisie doit coûter moins cher qu'une note OneNote.** Sinon elle n'aura pas
   lieu. Une phrase en conversation suffit : « J'ai mis en prod le workflow de
   relance, rollback = désactiver la règle WF-12 » → le registre structure.
4. **Tout constat cite sa source et sa conséquence.** « Champ X éditable, source =
   App Devis → chaque modification côté CRM créera un écart silencieux. »
5. **L'outil propose, l'humain valide, tout est tracé.** Aucune écriture silencieuse.
6. **Portable.** Le jour où Abraxio grandit et adopte un tracker, le registre exporte
   tout ; il ne prend rien en otage.

## 4. Bloc 1 — Le journal (demandes, décisions, changements)

### 4.1 Demande

Une sollicitation d'un utilisateur ou d'une équipe.

| Champ | Contenu |
|---|---|
| id, date | |
| demandeur | personne + équipe (CS, AE, Marketing, ADV, Produit, Com, Direction) |
| expression brute | les mots exacts du demandeur — jamais réécrits |
| reformulation | le besoin tel que compris, après échange |
| type | évolution / correction / question / accès / incident |
| priorité arbitrée | et **par qui** — en solo sous le CEO, l'arbitrage doit être attribuable |
| statut | reçue / qualifiée / arbitrée / réalisée / refusée / reportée |
| liens | décisions, changements, éléments de carto concernés |

L'expression brute est conservée verbatim : c'est la source en cas de « ce n'est pas
ce que j'avais demandé ».

### 4.2 Décision

Un arbitrage qui engage la structure du SI.

| Champ | Contenu |
|---|---|
| contexte | le problème posé |
| options considérées | y compris celles écartées, avec la raison |
| décision | |
| décideur | soi-même / CEO / équipe concernée — critique en solo |
| date, conséquences attendues | |
| statut | proposée / validée / appliquée / remplacée par → |

Une décision remplacée pointe vers celle qui la remplace : l'histoire ne s'efface pas.

### 4.3 Changement (mise en production)

Toute modification du SI en production.

| Champ | Contenu |
|---|---|
| date, description | |
| périmètre | modules, champs, workflows, intégrations touchés (liens carto) |
| type | paramétrage / Deluge / SQL / JS / config API / habilitations |
| procédure de retour arrière | **obligatoire** — un changement sans rollback déclaré est signalé |
| test effectué | quoi, avec qui |
| communication | qui a été prévenu |
| demande et décision d'origine | liens |

C'est le champ « retour arrière » qui sauve à 22h un soir d'incident.

### 4.4 Incident

| Champ | Contenu |
|---|---|
| date, symptôme, impact | |
| cause identifiée | avec lien vers le changement fautif s'il y en a un |
| résolution, durée | |
| action préventive | et son statut de mise en œuvre |

Le lien incident → changement est la boucle d'apprentissage : « les trois derniers
incidents viennent de changements sans test déclaré » est une phrase qui change une
pratique.

## 5. Bloc 2 — La carte (cartographie applicative)

La fiche de poste l'exige (« maintenir la cartographie applicative et des processus
métier »). La carte n'est pas un schéma : c'est une base interrogeable.

### 5.1 Entités

| Entité | Champs clés |
|---|---|
| **Système** | nom, rôle, éditeur, criticité, contact support, contrat |
| **Module** | système parent, rôle métier, équipes utilisatrices |
| **Champ** | module, type, **source de vérité**, éditable, règle métier, fraîcheur |
| **Profil / habilitation** | profil × champ : visible / éditable / masqué + justification |
| **Intégration** | source → cible, auth, stratégie de synchro, clé d'idempotence, règles d'erreur, métriques, procédure de reprise |
| **Automatisation** | workflow / fonction Deluge / règle : déclencheur, champs touchés, dernier changement |
| **Référentiel** | nomenclatures, listes de valeurs, propriétaire métier |

### 5.2 Le graphe d'impact

Toutes les entités sont reliées : un champ appartient à un module, est touché par des
automatisations, alimente des intégrations, apparaît dans des rapports.

La question à laquelle la carte doit répondre en une requête :

> « Si je modifie ce champ, qu'est-ce qui casse ? »

Réponse attendue : les workflows qui le lisent, les intégrations qui le mappent, les
profils qui le voient, les rapports qui l'agrègent — avec les liens vers les
changements qui les ont créés.

### 5.3 Peuplement

La carte se remplit par trois canaux, du plus prioritaire au moins :

1. **En conversation**, au fil de l'eau : « le champ Statut_Client est alimenté par
   l'app Devis, lecture seule partout sauf Admin » → structuré en une phrase.
2. **Import** depuis les métadonnées Zoho (API REST `settings/fields`,
   `settings/modules`) — à construire au jalon 3, pour amorcer la carte sans saisie.
3. **Interface web** en dernier recours.

## 6. Bloc 3 — La vigie (contrôles)

Les contrôles tournent sur la carte et le journal. Chaque contrôle a une conséquence
rédigée — un constat sans conséquence ne fait agir personne.

### 6.1 Contrôles d'intégrité du modèle

| Contrôle | Conséquence si échec |
|---|---|
| Champ sans source de vérité | Aucun arbitrage possible en cas d'écart entre systèmes |
| Champ éditable contredisant sa source | Chaque saisie CRM crée un écart silencieux |
| Habilitation non déclarée (champ × profil) | Comportement par défaut du module, rarement l'intention |
| Référentiel sans propriétaire métier | Les valeurs divergeront sans que personne n'arbitre |

### 6.2 Contrôles d'intégration

| Contrôle | Conséquence si échec |
|---|---|
| Pas de clé d'idempotence | Un rejeu après incident crée des doublons |
| Champ obligatoire sans règle de vide | Rejet silencieux ou null en cible |
| Erreurs sans nature (fonctionnelle/technique) | Traitement improvisé à chaque incident |
| Métrique sans seuil | La panne sera signalée par un utilisateur, pas par la supervision |
| Pas de procédure de reprise | Reprise improvisée hors heures ouvrées |

### 6.3 Contrôles de pratique (le miroir)

Ceux-là surveillent l'opérateur lui-même — c'est le rôle qu'aurait tenu un pair :

| Contrôle | Conséquence si échec |
|---|---|
| Changement sans retour arrière déclaré | Incident un soir = improvisation |
| Changement sans test déclaré | La recette, c'est l'utilisateur en prod |
| Changement sans demande d'origine | SI qui dérive au fil de l'eau, inauditables |
| Décision appliquée jamais validée | Engagement pris sans couverture du CEO |
| Demande en attente > seuil | Confiance des équipes qui s'érode en silence |
| Incident sans action préventive | Le même incident reviendra |

### 6.4 Rapports

- **Revue hebdo** : demandes reçues/traitées, changements, incidents, constats ouverts
  — prêt à envoyer au CEO. C'est aussi l'outil de visibilité du travail solo.
- **État du SI** : synthèse de la carte + constats — le document d'onboarding si un
  deuxième arrive un jour, ou de passation.
- **Rapport d'impact** : avant un changement — tout ce que le périmètre touche.

## 7. Architecture

```
Claude / ChatGPT (+ skill Shadow PO adapté)
        ↕ MCP
┌─────────────────────────────────────┐
│           REGISTRE SI                │
│  serveur MCP (Node/TS)              │
│  · outils : journal, carto, vigie   │
│  · SQLite (un fichier, sauvegardable │
│    par simple copie)                │
│  · moteur de contrôles (TS pur,     │
│    déjà écrit et testé en partie)   │
├─────────────────────────────────────┤
│  Web en lecture (matrices, rapports)│
└─────────────────────────────────────┘
        ↕ (jalon 3)
   API Zoho — import métadonnées
```

Choix assumés :

- **SQLite, pas Postgres.** Un utilisateur, une machine. Sauvegarde = copie d'un
  fichier. Zéro service à opérer — l'opérateur SI n'a pas besoin d'un SI pour son
  outil.
- **Pas d'authentification au jalon 1.** Outil personnel, local. À revoir seulement
  si l'outil est partagé un jour.
- **Le skill existant (Shadow PO) est conservé** et adapté : il gagne des outils
  exécutables au lieu de raisonner à vide.

## 8. Outils MCP exposés (contrat)

```
# Journal
enregistrer_demande(demandeur, equipe, expression_brute, ...)
enregistrer_decision(contexte, options, decision, decideur, ...)
enregistrer_changement(description, perimetre, rollback, test, ...)
enregistrer_incident(symptome, impact, cause?, ...)
rechercher_journal(question)          # « qu'ai-je changé en octobre sur les devis ? »

# Carte
decrire_champ(module, nom, source_de_verite, editable, ...)
decrire_integration(source, cible, idempotence, ...)
decrire_habilitation(profil, champ, droits, justification)
impact(cible)                         # « si je modifie X, qu'est-ce qui casse ? »

# Vigie
lancer_controles(perimetre?)          # tout ou un sous-ensemble
constats_ouverts()
generer_rapport(type)                 # hebdo / etat_si / impact
```

Chaque outil accepte du langage naturel structuré par le LLM — la friction de saisie
est portée par la conversation, pas par des formulaires.

## 9. Réutilisation de l'existant

Du travail précédent, survivent (TypeScript pur, testé) :

| Élément | Devient |
|---|---|
| Audit d'intégration (11 contrôles, 9 tests) | §6.2 tel quel |
| Détection contradiction source/éditabilité | §6.1 |
| Matrice habilitations champ × profil | §6.1 + vue web |
| Classification sémantique des statuts (22 tests) | rendu des rapports |
| Résolution d'ascendance tolérante | graphe d'impact §5.2 |

Est abandonné : tout le reste (registre d'objets, formulaires, kanban, vues,
navigation). C'était la reconstruction d'un tracker dont personne n'a besoin ici.

## 10. Jalons

### Jalon 1 — Le journal (objectif : prêt AVANT la prise de poste)

Serveur MCP + SQLite + les quatre outils d'enregistrement + `rechercher_journal` +
les contrôles de pratique (§6.3). Rapport hebdo en markdown.

**Critère de succès** : dès le premier jour chez Abraxio, chaque demande reçue entre
dans le registre en une phrase de conversation, et le vendredi le rapport hebdo part
au CEO sans travail supplémentaire.

### Jalon 2 — La carte à la main

Entités de cartographie + `impact()` + contrôles §6.1 + matrices web (habilitations,
champs par source de vérité). Se remplit au fil des découvertes des premières
semaines — la phase d'exploration du SI existant EST le moment idéal de peuplement.

### Jalon 3 — L'import Zoho et la vigie complète

Import des métadonnées via l'API Zoho (modules, champs, profils), contrôles §6.2 sur
les intégrations décrites, rapport « État du SI ».

**Critère de succès global** : à J+90, pouvoir répondre en moins d'une minute à
« pourquoi ce champ est comme ça », « qu'est-ce qui casse si je le change », et
« qu'est-ce qui s'est passé cette semaine » — avec des sources, pas des souvenirs.

## 11. Critères de rejet

- L'outil réimplémente un tracker, un kanban ou un wiki.
- La saisie demande plus d'effort qu'une note OneNote.
- Un constat n'indique pas sa conséquence.
- L'outil écrit quelque part sans validation explicite.
- L'outil exige un service à opérer (base serveur, file, cache) pour fonctionner.
- Les données ne sont pas exportables intégralement en un format ouvert.
