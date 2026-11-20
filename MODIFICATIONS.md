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

## 0.2.0 — sélection de trois thèmes (Aël, 2026-11-20)

- `scripts/bbs.mjs` : ajout des thèmes `editorial` et `alpine`, du menu CLI `menu`, de `init <projet> [theme]`, de `theme <projet> <theme>`.
- Le thème est persisté dans `bbs.json`; absence de champ `theme` = compatibilité BBS avec les anciens manifestes.
- Mise à jour de `rebuild` pour régénérer aussi la feuille de style du thème actif.
- Rendu en HTML statique avec échappement des entrées; aucune bibliothèque tierce, aucun JavaScript sur les sites générés.
- `README.md`, skills et métadonnées du plugin mis à jour.
- Références visuelles : prototype HTML original de TALC-O-MATIC et dépôt public `alpine-mksite` consulté comme référence. Aucun fichier tiers réemployé.
- Tests de fonctionnement et limites dans `AUDIT_AEL_0.2.0.md`. Validation indépendante par Silus restant à faire.

## 0.2.1 — retouches après contre-audit Silus (Aël, 2026-11-20)

- Identifiant du thème `alpine` renommé en `technique` dans le moteur, le menu, les instructions et la galerie ; aucun alias (version 0.2.0 non publiée).
- Symbole de bannière changé de triangle en losange pour différencier l'identité visuelle.
- Mention du dépôt `alpine-mksite` clarifiée : consulté comme référence, non inclus.
- Textes de bienvenue adaptés à chaque thème, métadonnées du marketplace harmonisées, chemin d'aperçu explicitement affiché.
- Voir `AUDIT_AEL_0.2.1.md` et `TESTS_0.2.1.md` pour résultats et limites.

## 0.2.2 — préparation de la publication (Aël, 2026-11-20)

- Suppression de l’aperçu obsolète `previews/alpine/` (seuls les thèmes `bbs`, `editorial` et `technique` sont publiés).
- Retrait des rapports de contre-audit et notes internes de la distribution publique.
- Ajout d’un `TESTS.md` public résumant les validations reproductibles.
- Versions des manifestes de plugin harmonisées sur `0.2.2`.
- Aucun changement au moteur de génération par rapport à la version 0.2.1 auditée.
