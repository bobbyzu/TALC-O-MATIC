# Tests publics — TALC-O-MATIC 0.2.2

Les vérifications ci-dessous sont exécutées sur des projets temporaires avec Node.js, sans deployment.

## Validation fonctionnelle

- Analyse syntaxique `node --check scripts/bbs.mjs`.
- `init` / `check` pour chacun des thèmes `bbs`, `editorial` et `technique`.
- Changement de thème puis validation du résultat.
- Ajout d’une page avec caractères HTML dans le titre et le texte : échappement vérifié.
- `rebuild` / `check`.
- Refus de thèmes inconnus ou de l’ancien identifiant `alpine`.
- Refus de remplacer un `style.css` par lien symbolique.
- Vérification du fonctionnement du menu interactif.
- Compatibilité avec un ancien manifeste sans champ `theme`.

## Périmètre

Le contre-audit indépendant de 0.2.1 a validé le moteur et les trois thèmes. La version 0.2.2 ne modifie pas le moteur. Les tests d’intégration dans Claude Code et une revue exhaustive d’accessibilité restent à effectuer.

Ces tests ne constituent pas une garantie générale de sécurité.
