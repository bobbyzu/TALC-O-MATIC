# Politique de sécurité du prototype

<!-- Fichier remplaçant le SECURITY.md d'Hypervibe 3.4.17 ; contenu réécrit pour TALC-O-MATIC. -->

**Ce logiciel est un prototype expérimental.** Il n'est pas présenté comme sécurisé, n'est pas conçu pour être exposé sur un réseau et ne doit pas être utilisé sur des projets contrôlés par un tiers non fiable.

## Ce que fait le moteur

Aucun hook n'est exécuté automatiquement. Aucune connexion à un serveur MCP, aucun déploiement, aucun installateur, aucun compte requis. Le serveur d'aperçu se lie à 127.0.0.1, n'accepte que les méthodes GET et HEAD et les en-têtes Host `127.0.0.1:8765` et `localhost:8765`, sert uniquement les fichiers `.html`, `.css` et `.svg` du dossier `site`, vérifie le chemin brut de la requête avant toute normalisation, et refuse les autres chemins ainsi que les liens symboliques. Les textes saisis sont échappés lors de la génération du HTML.

Le moteur refuse les liens symboliques (dossier du projet, `site`, manifeste, pages). Il remplace chaque fichier de façon atomique (fichier temporaire, synchronisation sur disque, renommage) et ne crée jamais de page par-dessus un fichier existant hors manifeste.

## Limites connues

- Le contenu du manifeste est validé mais pas authentifié.
- Les vérifications puis écritures ne sont pas protégées contre une modification concurrente ou malveillante pendant l'opération (TOCTOU) ; deux commandes lancées en même temps sur le même projet ne sont pas coordonnées.
- `add` n'est pas une transaction multi-fichiers : une interruption peut laisser des pages en retard sur le manifeste, que `rebuild` répare.
- `add` et `rebuild` écrasent les modifications manuelles des pages déclarées.
- Les liens ne sont vérifiés que pour les pages déclarées. Le dossier `site` peut être édité à la main : `check` signale la présence de JavaScript et la CSP du serveur d'aperçu l'empêche de s'exécuter, mais une page exportée ailleurs n'a pas cette protection.
- Le moteur n'intègre aucun contrôle d'autorisations : l'environnement local (agent, bac à sable, permissions) doit lui-même être confiné.

- **SVG : fichiers de confiance seulement.** `check` refuse les motifs dangereux courants (scripts, gestionnaires d'événements, entités, ressources externes, styles), et ne tolère que le DOCTYPE public SVG 1.1 écrit par Graphviz. Ce filtre n'est pas un analyseur XML : il ne garantit rien pour des SVG fournis par des tiers. Les pages affichent les SVG avec `<img>`, mode dans lequel les navigateurs n'exécutent aucun script.

Ne pas exposer le serveur HTTP sur un réseau.


### Limites du générateur expérimental (0.3.0)

Le filtre SVG accepte uniquement des fichiers créés et contrôlés par l'utilisateur. Il ne constitue **pas** un assainisseur de SVG tiers ; ne pas utiliser des SVG non fiables. Les dossiers `site/` et `vues/` contiennent des sorties générées et peuvent remplacer des pages homonymes lors d'un `rebuild`. Aucune suppression silencieuse de fichier orphelin dans `vues/` ne doit avoir lieu.

## Limites de la génération multi-interface (0.3.0)

Le filtre SVG est limité aux fichiers **locaux, produits et contrôlés par le propriétaire** du site. Ne pas lui transmettre des SVG de tiers non fiables. Le serveur de prévisualisation historique ne sert que `site/`, pas les cinq vues. `check` doit être lancé avant toute mise en ligne ; les fichiers orphelins des répertoires de vues entraînent un échec du contrôle et ne sont jamais effacés automatiquement. La génération écrase les fichiers portant les noms gérés par le moteur.
