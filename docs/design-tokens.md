# Système de tokens visuels — primitifs / sémantique / thèmes

> Jalon 4, Prompt M. Ce document existe pour qu'une session Claude Code future
> n'ait pas à redécouvrir la règle à chaque fois. Si tu modifies une couleur
> dans `front/src/`, relis ce fichier avant de commencer.

## La règle non négociable : couleur = état, jamais décoration

`--etat-succes`, `--etat-attention`, `--etat-danger` ne représentent **que**
des états métier — un constat ouvert, un changement sans retour arrière, un
incident, une écriture validée ou rejetée. Jamais une décoration, jamais un
choix esthétique.

`--accent` est **unique** : réservé à la navigation active et aux liens.
Ce n'est jamais un "brand primary" au sens marketing — un composant ne
l'utilise pas juste parce que c'est "la couleur de la marque".

**Aucun composant n'a le droit d'utiliser une couleur en dehors des
variables nommées.** Pas de hex, pas de `rgb()`/`rgba()` en dur dans
`front/src/**/*.tsx` ni dans un fichier CSS autre que `primitives.css` /
`semantique.css`. C'est vérifié par `tests/design-tokens.test.ts`, qui scanne
tous les fichiers et échoue si une couleur littérale apparaît ailleurs que
dans les deux fichiers de tokens.

Cette règle existe depuis le tout premier relooking (v75-83) et a traversé
tous les jalons depuis — elle ne se rouvre pas au prétexte d'un skill de
design externe (voir plus bas) ou d'une nouvelle palette qui « rendrait
mieux ».

## Deux couches, une seule direction de dépendance

```
front/src/tokens.css       (typographie, espacement, rayons — jamais de couleur)
  @import primitives.css   (COUCHE PRIMITIVE — varie par thème)
  @import semantique.css   (COUCHE SÉMANTIQUE — mapping fixe, un seul fichier)
```

### Primitifs (`front/src/primitives.css`)

Valeurs brutes qui varient par thème : surfaces, encre, filets, température
(chaud/froid), clarté. Chaque thème redéclare l'**intégralité** des
primitifs sous son propre sélecteur `:root[data-theme="..."]` — jamais une
fusion implicite par cascade où un thème ne corrigerait que quelques
valeurs. Un thème est un jeu de valeurs complet et autonome ; on peut lire
le bloc d'un thème sans consulter les autres.

Nommage : `--primitif-<rôle-visuel>`, ex. `--primitif-etat-danger`,
`--primitif-accent`, `--primitif-surface-app`.

### Sémantique (`front/src/semantique.css`)

Mapping **fixe**, un seul fichier pour tous les thèmes — jamais de
sélecteur `[data-theme]` dedans (`tests/design-tokens.test.ts` l'interdit
explicitement). Chaque token pointe vers un primitif :

```css
:root {
  --etat-danger: var(--primitif-etat-danger);
  --accent: var(--primitif-accent);
  --ink: var(--primitif-encre-1);
  /* … */
}
```

La valeur *résolue* de `--etat-danger` change avec le thème actif (parce
que `--primitif-etat-danger` change), mais le token `--etat-danger`
lui-même, ce qu'il signifie, et quels composants s'en servent — ça, ça ne
bouge jamais. C'est la propriété qu'on vérifie dans `tests/tone.test.ts` :
rejouer le mapping de tonalité sous chaque thème donne le même résultat
sémantique — un « No-Go » reste visuellement `danger` (famille rouge) dans
les deux thèmes, jamais autre chose.

### Composants

Les composants (`.tsx`, `app.css`) n'utilisent que les tokens sémantiques
(`var(--etat-danger)`, `var(--accent)`, `var(--ink)`…). Ils n'importent
jamais `primitives.css` directement et ne testent jamais quel thème est
actif — le thème n'existe que dans `<html data-theme="...">` et dans la
résolution CSS des variables, jamais dans la logique React.

## Thèmes enregistrés

| Thème | Rôle | Direction |
|---|---|---|
| `console` (défaut) | Neutres froids, encre presque noire | Direction "console technique" livrée en v75-83 |
| `papier` | Kraft d'archive, encre brun-noir sur papier légèrement chaud | Reconstruite depuis l'esprit du tout premier jet ("dossier d'instruction", densité d'établi), jamais livrée jusqu'ici — pas une palette copiée d'un skill externe |

Basculer de thème change **uniquement** `primitives.css` (via l'attribut
`data-theme` sur `<html>`). `semantique.css` et tous les composants restent
inchangés — c'est ce qui garantit qu'un badge "danger" reste rouge dans les
deux thèmes plutôt que de dériver vers autre chose.

Ajouter un thème : dupliquer un bloc `:root[data-theme="..."]` dans
`primitives.css` avec l'intégralité des primitifs, l'enregistrer dans
`front/src/lib/themes.ts` (`THEMES`), et s'assurer que
`tests/design-tokens.test.ts` / `tests/tone.test.ts` passent — ces deux
fichiers itèrent automatiquement sur les thèmes déclarés, sauf le mapping
`selecteur` en tête de `tests/tone.test.ts` qui doit être tenu à jour
manuellement (miroir volontairement explicite du sélecteur CSS, pas de
parsing générique).

**Un thème inspiré d'une palette du skill `ui-ux-pro-max` ne s'ajoute pas au
registre sans validation explicite** (nom, valeurs primitives, rendu
présentés d'abord) — voir plus bas.

## Sélecteur de thème (UI)

`front/src/components/ThemeSelector.tsx` : un bouton icône dans la sidebar
(pas un écran dédié), visible sur tous les écrans — y compris les écrans
gelés du §1 Jalon 4, puisque c'est de l'infrastructure transverse et non une
fonctionnalité ajoutée à un écran gelé. Persistance en `localStorage`
(`front/src/lib/themes.ts`, clé `registre-si-theme`) : app mono-utilisateur,
aucune justification pour une table DB. Le thème est appliqué de façon
synchrone dans `main.tsx`, avant le premier rendu React, pour éviter un
flash du thème par défaut.

## Rôle du skill `ui-ux-pro-max`

Le skill installé dans `.claude/skills/ui-ux-pro-max/` (styles, palettes,
typographie) est un outil d'aide à la **rédaction** — jamais une dépendance
du produit. Aucune de ses propositions n'entre directement dans
`tokens.css` : tout passe par ce filtre (rôle sémantique fixe, deux couches,
tests de garde). Aucun script du skill ne s'exécute au build ou au
démarrage ; rien dans `src/` ou `front/src/` n'importe quoi que ce soit
depuis `.claude/skills/`.

## Tests de garde

- `tests/design-tokens.test.ts` : aucune couleur hex/rgb en dur hors de
  `primitives.css`/`semantique.css` ; `semantique.css` ne contient aucun
  `[data-theme]` et ne déclare chaque token de rôle qu'une seule fois ; pour
  chaque thème enregistré, les 3 couleurs d'état et l'accent sont valides,
  et mutuellement distinctes.
- `tests/tone.test.ts` : pour chaque thème, succès/attention/danger/accent
  restent chacun dans leur bande de teinte (vert/ambre/rouge/bleu) — la
  température et la luminosité peuvent varier, la famille de teinte jamais.
