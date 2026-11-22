# Tests publics — TALC-O-MATIC 0.3.0

Exécuter `python3 -I tests/test_portable.py` dans `TALC-O-MATIC/` depuis une extraction neuve (Node.js requis). Ce test utilise exclusivement des dossiers temporaires.

Il contrôle : anciens thèmes BBS/éditorial/technique ; refus de `alpine` ; cinq vues d’un seul manifeste ; navigation équivalente sans script ; génération déterministe ; `add`, `theme`, `rebuild`, `check` ; préservation et signalement d’un fichier orphelin ; rejet d’un SVG exécutant un script.

Vérifications supplémentaires recommandées : revue visuelle clavier/mobile, sécurité des chemins/symlinks et entrée hostile XML/SVG. Les tests ne constituent pas une garantie exhaustive de sécurité.
