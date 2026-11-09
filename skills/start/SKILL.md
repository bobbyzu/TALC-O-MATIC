---
name: start
description: "Découverte de l’atelier BBS, sans installation ni réseau"
compatibility: "Claude Code / Agent Skills. Node.js requis, sans paquet npm."
---

<!-- Remplace le skill du même nom d'Hypervibe 3.4.17 ; contenu réécrit pour TALC-O-MATIC. -->
<!-- Modifié par Silex le 2026-11-09 : chemin du moteur via ${CLAUDE_PLUGIN_ROOT}, commande rebuild. -->

# start

Présente les commandes locales du moteur `node "${CLAUDE_PLUGIN_ROOT}/scripts/bbs.mjs"` : `init`, `add`, `rebuild`, `check`, `serve`. N’exécute aucune commande sans demande explicite. Aucune installation automatique : si Node.js manque, le signaler sans l’installer.

**Politique :** jamais de `sudo`, d'installation, d'accès réseau sortant, de déploiement, de modification hors du dossier validé ni de contournement des permissions. Toujours demander un accord avant les écritures et préciser les fichiers touchés.
