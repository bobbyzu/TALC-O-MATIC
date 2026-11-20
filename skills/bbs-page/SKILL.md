---
name: bbs-page
description: "Ajout de rubriques statiques au BBS"
compatibility: "Claude Code / Agent Skills. Node.js requis, sans paquet npm."
---

<!-- Modifié par Silex le 2026-11-09 : règle de citation des arguments, reprise après interruption. -->

# bbs-page

Demande le slug, le titre et le texte. Montre la commande exacte, puis, après validation explicite, lance :

`node "${CLAUDE_PLUGIN_ROOT}/scripts/bbs.mjs" add '<projet>' '<slug>' '<titre>' '<texte>'`

**Citation des arguments (obligatoire) :** chaque argument est entre apostrophes simples. Toute apostrophe contenue dans le titre ou le texte s'écrit `'\''`. Ne jamais utiliser de guillemets doubles : `$`, `` ` `` et `\` y seraient interprétés par le shell.

Si le moteur répond « Manifeste à jour mais pages incomplètes », proposer `node "${CLAUDE_PLUGIN_ROOT}/scripts/bbs.mjs" rebuild '<projet>'`. Pas de code distant.

**Politique :** jamais de `sudo`, d'installation, d'accès réseau sortant, de déploiement, de modification hors du dossier validé ni de contournement des permissions. Toujours demander un accord avant les écritures et préciser les fichiers touchés.

Depuis la version 0.2.1, styles disponibles : `bbs`, `editorial`, `technique`. Conserver l’accord explicite de l’utilisateur avant toute écriture ou régénération de pages/CSS.
