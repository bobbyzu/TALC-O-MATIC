# TALC-O-MATIC 0.2.2 — 3 thèmes

Atelier local de prototypage de sites statiques (BBS, éditorial, minimal technique), sous forme de plugin pour Claude Code.

Œuvre dérivée du plugin Hypervibe 3.4.17 de Flavien Chervet (Copyright 2026 Hyper Wisdom, licence Apache 2.0). TALC-O-MATIC n'est ni affilié à Hyper Wisdom, ni approuvé par lui. Voir `NOTICE`, `ATTRIBUTION.md` et `MODIFICATIONS.md`.

## Statut

**Prototype expérimental.** À utiliser pour du prototypage local, sur des projets que vous avez créés vous-même. Ce logiciel n'est pas présenté comme sécurisé, n'est pas prêt pour une exposition réseau et ne doit pas servir à manipuler des projets reçus de tiers non fiables (voir `SECURITY.md`).

## Usage (Node.js, aucun paquet npm)

Depuis un répertoire parent de projets vide ou choisi explicitement, `<plugin>` désignant le dossier de ce dépôt :

```sh
node <plugin>/scripts/bbs.mjs menu
# ou directement :
node <plugin>/scripts/bbs.mjs init mon-bbs bbs
node <plugin>/scripts/bbs.mjs check mon-bbs
node <plugin>/scripts/bbs.mjs serve mon-bbs
```

Ouvrir http://127.0.0.1:8765/. Arrêt du serveur avec Ctrl+C.

Choisir directement un thème ou le changer dans un projet existant :

```sh
node <plugin>/scripts/bbs.mjs init ma-revue editorial
node <plugin>/scripts/bbs.mjs init ma-doc technique
node <plugin>/scripts/bbs.mjs theme mon-bbs technique
node <plugin>/scripts/bbs.mjs rebuild mon-bbs
```

Les styles disponibles sont `bbs` (inchangé par défaut), `editorial` (mise en page originale inspirée des principes éditoriaux contemporains) et `technique` (mise en page technique originale, inspirée de la clarté du site Alpine Linux). **Aucun code HTML/CSS, logo, police ou image d'Anthropic ou d'Alpine Linux n'est embarqué dans les thèmes.** Le dépôt public `alpine-mksite` a été consulté comme référence de structure ; aucun fichier, script ou dépendance de ce dépôt n’est intégré.

Pour essayer directement les trois modèles, ouvrir `previews/index.html` dans Firefox (dans l'archive de livraison) ; les sites de démonstration sont autonomes.

Ajouter une rubrique (dans ce même répertoire parent) :

```sh
node <plugin>/scripts/bbs.mjs add mon-bbs musique Musique 'Archives musicales du Renard.'
```

Régénérer toutes les pages depuis le manifeste `bbs.json` (après une interruption, par exemple) :

```sh
node <plugin>/scripts/bbs.mjs rebuild mon-bbs
```

`add`, `rebuild` et `theme` régénèrent les pages depuis le manifeste : les modifications faites à la main dans ces pages HTML sont écrasées. **`rebuild` et `theme` régénèrent également `site/style.css`** : conserver les personnalisations CSS dans un autre emplacement si nécessaire.

## Différences avec Hypervibe

- Remplace les skills `start` et `bootstrap` (T3/Vercel) par des skills locaux BBS.
- Retire les scripts, modèles, skills et hooks d'origine liés aux services externes.
- Retire le serveur MCP `context7` et les hooks d'ouverture de session.
- Aucun paquet npm à installer ; le moteur ne lance aucun programme externe.
- Aucun accès Internet requis ; le serveur d'aperçu écoute uniquement sur 127.0.0.1.
- Le nouveau menu CLI propose trois styles, sans dépendances npm supplémentaires.

**Ce n'est pas une migration des fonctions d'Hypervibe** : T3, Vercel, paiement, authentification, SQL, agents, etc. ont été exclus délibérément. Le générateur produit uniquement du HTML et du CSS statiques.

**Attention :** les skills sont des instructions données à un agent, pas des garanties techniques. Le confinement de l'agent (bac à sable, permissions de l'outil) relève de l'environnement de l'utilisateur.

## Licence

Apache License 2.0 (`LICENSE`). Avis d'attribution dans `NOTICE`.
