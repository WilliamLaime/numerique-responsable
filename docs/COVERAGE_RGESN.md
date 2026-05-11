# Couverture RGESN 2024 — 78 critères

> Légende des statuts :
> - `✅ Auto` — implémenté et fiable
> - `⚠️ Partiel` — implémenté mais heuristique faible
> - `❌ NT` — non automatisable, présent comme NT
> - `➕ Manquant` — absent du moteur (ni auto ni NT)

## Corrections de numérotation appliquées

Les trois règles suivantes avaient des numéros temporaires incorrects. Corrigés dans audit.js :

| ID règle | Ancien num | Nouveau num | Raison |
|----------|-----------|-------------|--------|
| `eco-front-dom` | `6.3b` | `6.13` | 6.3 = Frameworks JS (existant) |
| `eco-front-img-dim` | `5.3b` | `5.12` | 5.3 = Images surdimensionnées (existant) |
| `eco-front-http-requests` | `6.2b` | `6.14` | 6.2 = Volume JS (existant) |

> Note : Le RGESN 2024 officiel comporte des numéros qui peuvent varier selon la version. Les numéros 6.13, 5.12 et 6.14 sont des numéros internes en attendant la correspondance officielle.

---

| Critère | Titre court | ID règle | Statut | Automatisable | Action |
|---------|-------------|----------|--------|---------------|--------|
| **Thème 1 — Stratégie** |
| 1.1 | Utilité du service évaluée | `eco-strat-1.1` | ❌ NT | Non | — |
| 1.2 | Démarche d'écoconception formalisée | `eco-strat-1.2` | ❌ NT | Non | — |
| 1.3 | Référent écoconception désigné | `eco-strat-1.3` | ❌ NT | Non | — |
| 1.4 | Critères environnementaux dans appels d'offres | `eco-strat-1.4` | ❌ NT | Non | — |
| 1.5 | Terminaux cibles identifiés | `eco-strat-1.5` | ❌ NT | Non | — |
| 1.6 | Collecte de données responsable | `eco-strat-local-storage` | ✅ Auto | Partiel | localStorage + cookies |
| 1.7 | Système de mesure d'impact | `eco-strat-1.7` | ❌ NT | Non | — |
| 1.8 | Objectifs partagés aux équipes | `eco-strat-1.8` | ❌ NT | Non | — |
| 1.9 | Démarche révisée régulièrement | `eco-strat-1.9` | ❌ NT | Non | — |
| 1.10 | Déclaration d'écoconception publiée | `eco-strat-1.10` | ❌ NT | Non | — |
| **Thème 2 — Spécifications** |
| 2.1 | Fonctionnalités définies et documentées | `eco-spec-2.1` | ❌ NT | Non | — |
| 2.2 | Fonctionnalités peu utilisées identifiées | `eco-spec-2.2` | ❌ NT | Non | — |
| 2.3 | Fonctionnalités limitées au nécessaire | `eco-spec-2.3` | ❌ NT | Non | — |
| 2.4 | Fonctionnement en connexion dégradée | `eco-spec-service-worker` | ✅ Auto | Partiel | Détecte Service Worker actif |
| 2.5 | Adaptation aux terminaux | `eco-spec-viewport` | ✅ Auto | Oui | Meta viewport + zoom |
| 2.6 | Tests sur terminaux anciens | `eco-spec-2.6` | ❌ NT | Non | — |
| 2.7 | Politique support anciens navigateurs | `eco-spec-2.7` | ❌ NT | Non | — |
| 2.8 | Alternative textuelle ou basse résolution | `eco-spec-2.8` | ❌ NT | Non | — |
| 2.9 | Tests en connectivité dégradée | `eco-spec-2.9` | ❌ NT | Non | — |
| **Thème 3 — Architecture** |
| 3.1 | Formats de données adaptés | `eco-arch-3.1` | ❌ NT | Non | — |
| 3.2 | Nombre domaines tiers réduit | `eco-arch-third-party` | ✅ Auto | Oui | ResourceTiming API |
| 3.3 | Protocoles efficaces HTTP/2+ | `eco-arch-http2` | ✅ Auto | Partiel | nextHopProtocol |
| 3.4 | Ressources statiques hébergées en propre | `eco-arch-same-domain` | ✅ Auto | Oui | — |
| 3.5 | Redondance de stockage évitée | ➕ Manquant | Non | — |
| 3.6 | Stratégie de cache ressources | `eco-arch-cache` | ✅ Auto | Partiel | transferSize === 0 |
| 3.7 | Adoption d'IPv6 | `eco-arch-3.7` | ❌ NT | Non | — |
| **Thème 4 — Expérience et interface utilisateur** |
| 4.1 | Parcours adaptés aux besoins | `eco-ux-4.1` | ❌ NT | Non | — |
| 4.2 | Parcours utilisateurs optimisés | `eco-ux-4.2` | ❌ NT | Non | — |
| 4.3 | Lecture automatique désactivée | `eco-ux-video-autoplay` | ✅ Auto | Oui | — |
| 4.4 | Absence de défilement infini | `eco-ux-infinite-scroll` | ⚠️ Partiel | Partiel | Heuristique hauteur page |
| 4.5 | Alternatives carte/géolocalisation | `eco-ux-4.5` | ❌ NT | Non | — |
| 4.6 | Contenus affichés limités au nécessaire | `eco-ux-4.6` | ❌ NT | Non | — |
| 4.7 | Système de design utilisé | `eco-ux-4.7` | ❌ NT | Non | — |
| 4.8 | Fonctionnalités orientées sobriété | `eco-ux-4.8` | ❌ NT | Non | — |
| 4.9 | Animations non essentielles limitées | `eco-ux-animations` | ✅ Auto | Partiel | @keyframes + prefers-reduced-motion |
| 4.10 | Visuels e-mails optimisés | `eco-ux-4.10` | ❌ NT | Non | — |
| 4.11 | Adaptation préférences système | `eco-ux-prefers-motion` | ✅ Auto | Partiel | prefers-reduced-motion + color-scheme |
| 4.12 | Popups/notifications non sollicitées | `eco-ux-notifications` | ✅ Auto | Partiel | Dialogs ouverts au chargement |
| 4.13 | Mode sombre ou économiseur d'énergie | `eco-ux-dark-mode` | ✅ Auto | Partiel | prefers-color-scheme ou toggle |
| 4.14 | Données géolocalisation non conservées | `eco-ux-4.14` | ❌ NT | Non | — |
| 4.15 | Bilan carbone ou mesure d'impact | `eco-ux-4.15` | ❌ NT | Non | — |
| **Thème 5 — Contenus** |
| 5.1 | Stratégie de contenu sobre définie | `eco-cont-5.1` | ❌ NT | Non | — |
| 5.2 | Images au format optimisé | `eco-cont-images-format` | ✅ Auto | Oui | JPEG/PNG vs WebP/AVIF |
| 5.3 | Images aux bonnes dimensions | `eco-cont-images-oversized` | ✅ Auto | Oui | naturalWidth vs clientWidth |
| 5.4 | Vidéos format et préchargement | `eco-cont-video-format` | ✅ Auto | Oui | WebM + preload |
| 5.5 | Stratégie compression vidéo | `eco-cont-5.5` | ❌ NT | Non | — |
| 5.6 | Vidéos limitées au nécessaire | `eco-cont-5.6` | ❌ NT | Non | — |
| 5.7 | Stratégie cache contenus | `eco-cont-5.7` | ❌ NT | Non | — |
| 5.8 | Documents bureautiques optimisés | `eco-cont-5.8` | ❌ NT | Non | — |
| 5.9 | Durée de vie et archivage contenus | `eco-cont-5.9` | ❌ NT | Non | — |
| 5.10 | Contenus créés dans formats recommandés | `eco-cont-5.10` | ❌ NT | Non | — |
| 5.11 | Polices web format et nombre | `eco-cont-font-format` | ✅ Auto | Oui | WOFF2 + nombre polices |
| 5.12 | Images avec dimensions explicites | `eco-front-img-dim` | ✅ Auto | Oui | Corrigé depuis 5.3b |
| **Thème 6 — Frontend** |
| 6.1 | Volume et minification CSS | `eco-front-css-weight` | ✅ Auto | Oui | — |
| 6.2 | Volume et minification JS | `eco-front-js-weight` | ✅ Auto | Oui | — |
| 6.3 | Frameworks JS détectés | `eco-front-frameworks` | ✅ Auto | Partiel | Détection window.React/Vue/Angular… |
| 6.4 | CSS inutilisé supprimé | `eco-front-6.4` | ❌ NT | Non | — |
| 6.5 | Mise en cache locale des données | `eco-front-local-cache` | ✅ Auto | Partiel | Service Worker + Cache API |
| 6.6 | Lazy loading images | `eco-front-lazy` | ✅ Auto | Oui | loading="lazy" |
| 6.7 | Appels API externes limités | `eco-front-6.7` | ❌ NT | Non | — |
| 6.8 | Ressources bloquant le rendu | `eco-front-render-blocking` | ✅ Auto | Oui | Scripts sync dans \<head\> |
| 6.9 | Ressources chargées en double | `eco-front-duplicates` | ✅ Auto | Oui | ResourceTiming dédupliqué |
| 6.10 | Fonctionnalités non utilisées supprimées | `eco-front-6.10` | ❌ NT | Non | — |
| 6.11 | Volume total données transférées | `eco-front-page-weight` | ✅ Auto | Oui | encodedBodySize total |
| 6.12 | Compression transferts (gzip/brotli) | `eco-front-compression` | ✅ Auto | Oui | encodedBodySize vs decodedBodySize |
| 6.13 | Taille du DOM | `eco-front-dom` | ✅ Auto | Oui | Corrigé depuis 6.3b |
| 6.14 | Nombre de requêtes HTTP | `eco-front-http-requests` | ✅ Auto | Oui | Corrigé depuis 6.2b |
| **Thème 7 — Backend** |
| 7.1 | Temps de réponse serveur (TTFB) | `eco-back-ttfb` | ✅ Auto | Partiel | NavigationTiming responseStart |
| 7.2 | Serveur web optimisé | `eco-back-7.2` | ❌ NT | Non | — |
| 7.3 | Requêtes BDD optimisées | `eco-back-7.3` | ❌ NT | Non | — |
| 7.4 | Traitements serveur limités | `eco-back-7.4` | ❌ NT | Non | — |
| 7.5 | Données calculées mises en cache | `eco-back-7.5` | ❌ NT | Non | — |
| 7.6 | Cache HTTP configuré | `eco-back-7.6` | ❌ NT | Non | — |
| 7.7 | Architecture serverless/mutualisée | `eco-back-7.7` | ❌ NT | Non | — |
| 7.8 | Stockage données optimisé | `eco-back-7.8` | ❌ NT | Non | — |
| 7.9 | API efficace | `eco-back-7.9` | ❌ NT | Non | — |
| 7.10 | Logs serveur raisonnés | `eco-back-7.10` | ❌ NT | Non | — |
| 7.11 | Emails transactionnels limités | `eco-back-7.11` | ❌ NT | Non | — |
| 7.12 | Médias optimisés côté serveur | `eco-back-7.12` | ❌ NT | Non | — |
| 7.13 | Outils de build adaptés | `eco-back-7.13` | ❌ NT | Non | — |
| 7.14 | Durée rétention données définie | `eco-back-7.14` | ❌ NT | Non | — |
| **Thème 8 — Hébergement** |
| 8.1 | Hébergeur avec politique environnementale | `eco-host-8.1` | ❌ NT | Non | — |
| 8.2 | PUE datacenter faible | `eco-host-8.2` | ❌ NT | Non | — |
| 8.3 | Alimentation renouvelable | `eco-host-8.3` | ❌ NT | Non | — |
| 8.4 | Localisation géographique adaptée | `eco-host-8.4` | ❌ NT | Non | — |
| 8.5 | Certification environnementale | `eco-host-8.5` | ❌ NT | Non | — |
| 8.6 | Hébergement mutualisé si pertinent | `eco-host-8.6` | ❌ NT | Non | — |
| 8.7 | Consommation énergétique optimisée | `eco-host-8.7` | ❌ NT | Non | — |
| 8.8 | Ressources adaptées à la charge | `eco-host-8.8` | ❌ NT | Non | — |
| 8.9 | Politique fin de vie serveurs | `eco-host-8.9` | ❌ NT | Non | — |
| **Thème 9 — Algorithmie** |
| 9.1 | Complexité algorithmique maîtrisée | `eco-algo-complexity` | ❌ NT | Non | — |
| 9.2 | Algorithmes adaptés aux besoins | `eco-algo-9.2` | ❌ NT | Non | — |
| 9.3 | Recours à l'IA limité | `eco-algo-9.3` | ❌ NT | Non | — |
| 9.4 | Impact IA évalué | `eco-algo-9.4` | ❌ NT | Non | — |
| 9.5 | Modèles IA optimisés | `eco-algo-9.5` | ❌ NT | Non | — |
| 9.6 | Modèles pré-entraînés réutilisés | `eco-algo-9.6` | ❌ NT | Non | — |
| 9.7 | Modèles IA obsolètes supprimés | `eco-algo-9.7` | ❌ NT | Non | — |
| 9.8 | Critères de sortie définis | `eco-algo-9.8` | ❌ NT | Non | — |
| 9.9 | Résultats de calculs mis en cache | `eco-algo-9.9` | ❌ NT | Non | — |
| 9.10 | Stockage et traitement données optimisés | `eco-algo-9.10` | ❌ NT | Non | — |
| 9.11 | Données traitées à proximité source | `eco-algo-9.11` | ❌ NT | Non | — |
| 9.12 | Pertinence chaque traitement évaluée | `eco-algo-9.12` | ❌ NT | Non | — |

## Synthèse

| Statut | Nombre |
|--------|--------|
| ✅ Auto | 20 |
| ⚠️ Partiel | 3 |
| ❌ NT | 55 |
| ➕ Manquant | 1 (3.5) |
| **Total** | **79** |

> La grande majorité des critères RGESN concernent des décisions d'architecture, de gouvernance et d'hébergement qui ne sont pas automatisables par inspection du DOM ou des ressources réseau.
