# TALC-O-MATIC BBS 0.1.2

Atelier local de prototypage de sites statiques au style BBS, sous forme de plugin pour Claude Code.

Œuvre dérivée du plugin Hypervibe 3.4.17 de Flavien Chervet (Copyright 2026 Hyper Wisdom, licence Apache 2.0). TALC-O-MATIC n'est ni affilié à Hyper Wisdom, ni approuvé par lui. Voir `NOTICE`, `ATTRIBUTION.md` et `MODIFICATIONS.md`.

## Statut

**Prototype expérimental.** À utiliser pour du prototypage local, sur des projets que vous avez créés vous-même. Ce logiciel n'est pas présenté comme sécurisé, n'est pas prêt pour une exposition réseau et ne doit pas servir à manipuler des projets reçus de tiers non fiables (voir `SECURITY.md`).

## Usage (Node.js, aucun paquet npm)

Depuis un répertoire parent de projets vide ou choisi explicitement, `<plugin>` désignant le dossier de ce dépôt :

```sh
node <plugin>/scripts/bbs.mjs init mon-bbs
node <plugin>/scripts/bbs.mjs check mon-bbs
node <plugin>/scripts/bbs.mjs serve mon-bbs
```

Ouvrir http://127.0.0.1:8765/. Arrêt du serveur avec Ctrl+C.

Ajouter une rubrique (dans ce même répertoire parent) :

```sh
node <plugin>/scripts/bbs.mjs add mon-bbs musique Musique 'Archives musicales du Renard.'
```

Régénérer toutes les pages depuis le manifeste `bbs.json` (après une interruption, par exemple) :

```sh
node <plugin>/scripts/bbs.mjs rebuild mon-bbs
```

`add` et `rebuild` régénèrent les pages depuis le manifeste : les modifications faites à la main dans ces pages HTML sont écrasées.

## Différences avec Hypervibe

- Remplace les skills `start` et `bootstrap` (T3/Vercel) par des skills locaux BBS.
- Retire les scripts, modèles, skills et hooks d'origine liés aux services externes.
- Retire le serveur MCP `context7` et les hooks d'ouverture de session.
- Aucun paquet npm à installer ; le moteur ne lance aucun programme externe.
- Aucun accès Internet requis ; le serveur d'aperçu écoute uniquement sur 127.0.0.1.

**Ce n'est pas une migration des fonctions d'Hypervibe** : T3, Vercel, paiement, authentification, SQL, agents, etc. ont été exclus délibérément. Le générateur produit uniquement du HTML et du CSS statiques.

**Attention :** les skills sont des instructions données à un agent, pas des garanties techniques. Le confinement de l'agent (bac à sable, permissions de l'outil) relève de l'environnement de l'utilisateur.

## Licence

Apache License 2.0 (`LICENSE`). Avis d'attribution dans `NOTICE`.
