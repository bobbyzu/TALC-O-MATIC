# Politique de sécurité du prototype

<!-- Fichier remplaçant le SECURITY.md d'Hypervibe 3.4.17 ; contenu réécrit pour TALC-O-MATIC. -->

**Ce logiciel est un prototype expérimental.** Il n'est pas présenté comme sécurisé, n'est pas conçu pour être exposé sur un réseau et ne doit pas être utilisé sur des projets contrôlés par un tiers non fiable.

## Ce que fait le moteur

Aucun hook n'est exécuté automatiquement. Aucune connexion à un serveur MCP, aucun déploiement, aucun installateur, aucun compte requis. Le serveur d'aperçu se lie à 127.0.0.1, n'accepte que les méthodes GET et HEAD et les en-têtes Host `127.0.0.1:8765` et `localhost:8765`, sert uniquement les fichiers `.html` et `.css` du dossier `site`, vérifie le chemin brut de la requête avant toute normalisation, et refuse les autres chemins ainsi que les liens symboliques. Les textes saisis sont échappés lors de la génération du HTML.

Le moteur refuse les liens symboliques (dossier du projet, `site`, manifeste, pages). Il remplace chaque fichier de façon atomique (fichier temporaire, synchronisation sur disque, renommage) et ne crée jamais de page par-dessus un fichier existant hors manifeste.

## Limites connues

- Le contenu du manifeste est validé mais pas authentifié.
- Les vérifications puis écritures ne sont pas protégées contre une modification concurrente ou malveillante pendant l'opération (TOCTOU) ; deux commandes lancées en même temps sur le même projet ne sont pas coordonnées.
- `add` n'est pas une transaction multi-fichiers : une interruption peut laisser des pages en retard sur le manifeste, que `rebuild` répare.
- `add` et `rebuild` écrasent les modifications manuelles des pages déclarées.
- Les liens ne sont vérifiés que pour les pages déclarées. Le dossier `site` peut être édité à la main : `check` signale la présence de JavaScript et la CSP du serveur d'aperçu l'empêche de s'exécuter, mais une page exportée ailleurs n'a pas cette protection.
- Le moteur n'intègre aucun contrôle d'autorisations : l'environnement local (agent, bac à sable, permissions) doit lui-même être confiné.

Ne pas exposer le serveur HTTP sur un réseau.
