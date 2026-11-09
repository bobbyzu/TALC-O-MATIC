# Modifications par rapport à l'original

Œuvre d'origine : Hypervibe 3.4.17 de Flavien Chervet (Copyright 2026 Hyper Wisdom, licence Apache 2.0). Ce fichier répond à la section 4(b) de la licence : il signale les fichiers modifiés.

## 0.1 (Aël, 2026-11-09)

| Fichier ou dossier | Changement |
|---|---|
| `skills/`, `scripts/`, `templates/`, `hooks/` d'origine | Retirés en entier |
| `.mcp.json` | Retiré (serveur context7) |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Remplacés : nom `hypervibe-bbs`, nouvelle description et version |
| `hooks/hooks.json` | Remplacé : aucun hook |
| `skills/start/SKILL.md`, `skills/bootstrap/SKILL.md` | Remplacés par des versions BBS locales |
| `skills/bbs-page/SKILL.md`, `skills/bbs-audit/SKILL.md` | Ajoutés |
| `scripts/bbs.mjs` | Ajouté : nouveau générateur BBS |
| `templates/bbs/README.md` | Ajouté |
| `README.md`, `SECURITY.md` | Remplacés |
| `ATTRIBUTION.md`, `RAPPORT_POUR_SILEX.md` | Ajoutés |
| `LICENSE`, `.gitignore` | Inchangés |

## 0.1.1 (Silex, 2026-11-09, contre-audit)

| Fichier | Changement |
|---|---|
| `scripts/bbs.mjs` | Liens symboliques refusés, écritures atomiques, manifeste validé et écrit en premier, commande `rebuild`, serveur durci (en-tête Host, Referrer-Policy, port occupé signalé), détection de JavaScript dans `check` |
| `skills/*/SKILL.md` (les 4) | Chemin du moteur via `${CLAUDE_PLUGIN_ROOT}` (`start`), arguments entre apostrophes simples, mention de `rebuild` |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Version 0.1.1-bbs |
| `README.md`, `SECURITY.md`, `ATTRIBUTION.md` | Mis à jour |
| `NOTICE`, `MODIFICATIONS.md`, `CONTRE_AUDIT_SILEX.md` | Ajoutés |

## 0.1.2 — vérification Aël (2026-11-09)
- Précontrôle de toutes les pages avant écriture du manifeste dans `add`.
- Validation de l’URL brute avant normalisation dans le serveur local.
- Tests réels Node.js décrits dans `REVUE_FINALE_AEL.md`.

## 0.1.2 — préparation de la publication (Silex, 2026-11-09)

| Fichier | Changement |
|---|---|
| Dossier racine | Renommé `talc-o-matic-bbs` |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Nom `talc-o-matic-bbs`, version `0.1.2`, mention de l'origine et de la non-affiliation |
| `scripts/bbs.mjs` | Titre affiché `TALC-O-MATIC BBS 0.1.2` ; en-tête précisant que le fichier est nouveau |
| `skills/start/SKILL.md`, `skills/bootstrap/SKILL.md` | Mention du remplacement du fichier d'origine |
| `README.md`, `SECURITY.md`, `ATTRIBUTION.md` | Réécrits pour la publication : nom, statut expérimental, limites connues |
| `RAPPORT_POUR_SILEX.md`, `CONTRE_AUDIT_SILEX.md`, `REVUE_FINALE_AEL.md` | Rapports internes de travail, retirés de la distribution publique |
