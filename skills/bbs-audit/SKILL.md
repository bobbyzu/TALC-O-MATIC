---
name: bbs-audit
description: "Vérification locale des pages BBS"
compatibility: "Claude Code / Agent Skills. Node.js requis, sans paquet npm."
---

<!-- Modifié par Silex le 2026-11-09 : citation des arguments, rebuild, détection de JavaScript. -->

# bbs-audit

Après demande, exécute `node "${CLAUDE_PLUGIN_ROOT}/scripts/bbs.mjs" check '<projet>'`. Il s’agit d’une vérification basique, pas d’un audit de sécurité complet : elle contrôle les pages déclarées, la navigation, la feuille de style, la présence de JavaScript et les liens symboliques.

Si des pages manquent ou sont incomplètes, proposer (sans le lancer d'office) `node "${CLAUDE_PLUGIN_ROOT}/scripts/bbs.mjs" rebuild '<projet>'`, qui les régénère depuis `bbs.json`.

**Politique :** jamais de `sudo`, d'installation, d'accès réseau sortant, de déploiement, de modification hors du dossier validé ni de contournement des permissions. Toujours demander un accord avant les écritures et préciser les fichiers touchés.
