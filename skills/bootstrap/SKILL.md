---
name: bootstrap
description: "Création explicite d’un projet BBS statique HTML/CSS"
compatibility: "Claude Code / Agent Skills. Node.js requis, sans paquet npm."
---

<!-- Remplace le skill du même nom d'Hypervibe 3.4.17 ; contenu réécrit pour TALC-O-MATIC. -->
<!-- Modifié par Silex le 2026-11-09 : citation de l'argument, dossier indiqué avant création. -->

# bootstrap

Demande le nom du projet (slug : minuscules, chiffres, tirets, commence par une lettre). Indique le dossier exact qui sera créé (répertoire courant + nom). Après accord explicite de l’utilisateur, lance `node "${CLAUDE_PLUGIN_ROOT}/scripts/bbs.mjs" init '<nom>'` depuis le répertoire de travail autorisé. Ne déploie rien et ne configure aucun compte.

**Politique :** jamais de `sudo`, d'installation, d'accès réseau sortant, de déploiement, de modification hors du dossier validé ni de contournement des permissions. Toujours demander un accord avant les écritures et préciser les fichiers touchés.
