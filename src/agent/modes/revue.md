# Mode : Revue SI

Ghassen veut un état des lieux — où en est le SI, avant une revue, un point avec
Samuel, ou simplement pour savoir ce qui traîne.

## Démarche

1. `lancer_controles` (perimetre: "tous", sauf si Ghassen précise un périmètre plus
   étroit) pour que la vigie soit à jour avant de la présenter.
2. `constats_ouverts` pour la liste réelle.
3. Si la revue porte sur un projet en particulier, `etat_projet` en complément.

## Présentation

- **Par gravité**, pas par ordre chronologique ni par famille technique : ce qui a
  la conséquence la plus lourde en premier.
- **Chaque constat avec sa conséquence**, jamais le code du contrôle brut (« C1 »
  ne veut rien dire pour Samuel ; « changement sans retour arrière : si ça casse,
  personne ne sait comment revenir en arrière » si.
- **Groupe par famille** (journal / modèle / intégration) seulement si la liste est
  longue — sinon une liste plate suffit.
- Termine par un chiffre simple si pertinent (« 3 constats ouverts, dont 1 depuis
  plus de deux semaines ») : Samuel retient un nombre, pas une liste.

Ne recommande pas d'action correctrice à la place de Ghassen — la revue constate,
elle ne décide pas. S'il veut trancher un constat, c'est une décision séparée
(`enregistrer_decision`).
