# Référentiel RGESN 2024 — Couverture projet

## Formule de score

- **Par thématique** : `(OUI / (OUI + NON)) × 100`
- **Score global** : moyenne pondérée des thématiques (pondération par nombre de critères applicables)
- Statuts : `OUI` / `NON` / `N/A` / `NT` (Non Testé)
- `N/A` est exclu du calcul (critère non applicable au service)
- `NT` compte comme `NON` dans le score (non conforme par défaut)

## Statuts d'automatisation dans ce projet

- `✅ Auto` — implémenté et fiable dans `public/audit.js`
- `⚠️ Partiel` — heuristique faible ou faux positifs possibles
- `❌ NT` — non automatisable, présent comme NT dans l'audit
- `➕ Manquant` — absent du moteur (priorité d'implémentation)

## Thème 1 — Stratégie (10 critères)

| Critère | Titre | ID règle | Statut |
|---------|-------|----------|--------|
| 1.1 | Utilité du service évaluée | `eco-strat-1.1` | ❌ NT |
| 1.2 | Démarche d'écoconception formalisée | `eco-strat-1.2` | ❌ NT |
| 1.3 | Référent écoconception désigné | `eco-strat-1.3` | ❌ NT |
| 1.4 | Critères environnementaux dans appels d'offres | `eco-strat-1.4` | ❌ NT |
| 1.5 | Terminaux cibles identifiés | `eco-strat-1.5` | ❌ NT |
| 1.6 | Collecte de données responsable | `eco-strat-local-storage` | ✅ Auto — localStorage + cookies |
| 1.7 | Système de mesure d'impact | `eco-strat-1.7` | ❌ NT |
| 1.8 | Objectifs partagés aux équipes | `eco-strat-1.8` | ❌ NT |
| 1.9 | Démarche révisée régulièrement | `eco-strat-1.9` | ❌ NT |
| 1.10 | Déclaration d'écoconception publiée | `eco-strat-1.10` | ❌ NT |

## Thème 2 — Spécifications (9 critères)

| Critère | Titre | ID règle | Statut |
|---------|-------|----------|--------|
| 2.1 | Fonctionnalités définies et documentées | `eco-spec-2.1` | ❌ NT |
| 2.2 | Fonctionnalités peu utilisées identifiées | `eco-spec-2.2` | ❌ NT |
| 2.3 | Fonctionnalités limitées au nécessaire | `eco-spec-2.3` | ❌ NT |
| 2.4 | Fonctionnement en connexion dégradée | `eco-spec-service-worker` | ✅ Auto — détecte Service Worker actif |
| 2.5 | Adaptation aux terminaux | `eco-spec-viewport` | ✅ Auto — meta viewport + zoom |
| 2.6 | Tests sur terminaux anciens | `eco-spec-2.6` | ❌ NT |
| 2.7 | Politique support anciens navigateurs | `eco-spec-2.7` | ❌ NT |
| 2.8 | Alternative textuelle ou basse résolution | `eco-spec-2.8` | ❌ NT |
| 2.9 | Tests en connectivité dégradée | `eco-spec-2.9` | ❌ NT |

## Thème 3 — Architecture (7 critères)

| Critère | Titre | ID règle | Statut |
|---------|-------|----------|--------|
| 3.1 | Formats de données adaptés | `eco-arch-3.1` | ❌ NT |
| 3.2 | Nombre domaines tiers réduit | `eco-arch-third-party` | ✅ Auto — ResourceTiming API |
| 3.3 | Protocoles efficaces HTTP/2+ | `eco-arch-http2` | ✅ Auto — nextHopProtocol |
| 3.4 | Ressources statiques hébergées en propre | `eco-arch-same-domain` | ✅ Auto |
| 3.5 | Redondance de stockage évitée | — | ➕ Manquant |
| 3.6 | Stratégie de cache ressources | `eco-arch-cache` | ✅ Auto — transferSize === 0 |
| 3.7 | Adoption d'IPv6 | `eco-arch-3.7` | ❌ NT |

## Thème 4 — Expérience et interface utilisateur (15 critères)

| Critère | Titre | ID règle | Statut |
|---------|-------|----------|--------|
| 4.1 | Parcours adaptés aux besoins | `eco-ux-4.1` | ❌ NT |
| 4.2 | Parcours utilisateurs optimisés | `eco-ux-4.2` | ❌ NT |
| 4.3 | Lecture automatique désactivée | `eco-ux-video-autoplay` | ✅ Auto |
| 4.4 | Absence de défilement infini | `eco-ux-infinite-scroll` | ⚠️ Partiel — heuristique hauteur page |
| 4.5 | Alternatives carte/géolocalisation | `eco-ux-4.5` | ❌ NT |
| 4.6 | Contenus affichés limités au nécessaire | `eco-ux-4.6` | ❌ NT |
| 4.7 | Système de design utilisé | `eco-ux-4.7` | ❌ NT |
| 4.8 | Fonctionnalités orientées sobriété | `eco-ux-4.8` | ❌ NT |
| 4.9 | Animations non essentielles limitées | `eco-ux-animations` | ✅ Auto — @keyframes + prefers-reduced-motion |
| 4.10 | Visuels e-mails optimisés | `eco-ux-4.10` | ❌ NT |
| 4.11 | Adaptation préférences système | `eco-ux-prefers-motion` | ✅ Auto — prefers-reduced-motion + color-scheme |
| 4.12 | Popups/notifications non sollicitées | `eco-ux-notifications` | ✅ Auto — dialogs ouverts au chargement |
| 4.13 | Mode sombre ou économiseur d'énergie | `eco-ux-dark-mode` | ✅ Auto — prefers-color-scheme ou toggle |
| 4.14 | Données géolocalisation non conservées | `eco-ux-4.14` | ❌ NT |
| 4.15 | Bilan carbone ou mesure d'impact | `eco-ux-4.15` | ❌ NT |

## Thème 5 — Contenus (12 critères)

| Critère | Titre | ID règle | Statut |
|---------|-------|----------|--------|
| 5.1 | Stratégie de contenu sobre définie | `eco-cont-5.1` | ❌ NT |
| 5.2 | Images au format optimisé | `eco-cont-images-format` | ✅ Auto — JPEG/PNG vs WebP/AVIF |
| 5.3 | Images aux bonnes dimensions | `eco-cont-images-oversized` | ✅ Auto — naturalWidth vs clientWidth |
| 5.4 | Vidéos format et préchargement | `eco-cont-video-format` | ✅ Auto — WebM + preload |
| 5.5 | Stratégie compression vidéo | `eco-cont-5.5` | ❌ NT |
| 5.6 | Vidéos limitées au nécessaire | `eco-cont-5.6` | ❌ NT |
| 5.7 | Stratégie cache contenus | `eco-cont-5.7` | ❌ NT |
| 5.8 | Documents bureautiques optimisés | `eco-cont-5.8` | ❌ NT |
| 5.9 | Durée de vie et archivage contenus | `eco-cont-5.9` | ❌ NT |
| 5.10 | Contenus créés dans formats recommandés | `eco-cont-5.10` | ❌ NT |
| 5.11 | Polices web format et nombre | `eco-cont-font-format` | ✅ Auto — WOFF2 + nombre polices |
| 5.12 | Images avec dimensions explicites | `eco-front-img-dim` | ✅ Auto — (corrigé depuis 5.3b) |

## Thème 6 — Frontend (14 critères)

| Critère | Titre | ID règle | Statut |
|---------|-------|----------|--------|
| 6.1 | Volume et minification CSS | `eco-front-css-weight` | ✅ Auto |
| 6.2 | Volume et minification JS | `eco-front-js-weight` | ✅ Auto |
| 6.3 | Frameworks JS détectés | `eco-front-frameworks` | ✅ Auto — window.React/Vue/Angular… |
| 6.4 | CSS inutilisé supprimé | `eco-front-6.4` | ❌ NT |
| 6.5 | Mise en cache locale des données | `eco-front-local-cache` | ✅ Auto — Service Worker + Cache API |
| 6.6 | Lazy loading images | `eco-front-lazy` | ✅ Auto — loading="lazy" |
| 6.7 | Appels API externes limités | `eco-front-6.7` | ❌ NT |
| 6.8 | Ressources bloquant le rendu | `eco-front-render-blocking` | ✅ Auto — scripts sync dans <head> |
| 6.9 | Ressources chargées en double | `eco-front-duplicates` | ✅ Auto — ResourceTiming dédupliqué |
| 6.10 | Fonctionnalités non utilisées supprimées | `eco-front-6.10` | ❌ NT |
| 6.11 | Volume total données transférées | `eco-front-page-weight` | ✅ Auto — encodedBodySize total |
| 6.12 | Compression transferts (gzip/brotli) | `eco-front-compression` | ✅ Auto — encodedBodySize vs decodedBodySize |
| 6.13 | Taille du DOM | `eco-front-dom` | ✅ Auto — (corrigé depuis 6.3b) |
| 6.14 | Nombre de requêtes HTTP | `eco-front-http-requests` | ✅ Auto — (corrigé depuis 6.2b) |

## Thème 7 — Backend (14 critères)

| Critère | Titre | ID règle | Statut |
|---------|-------|----------|--------|
| 7.1 | Temps de réponse serveur (TTFB) | `eco-back-ttfb` | ⚠️ Partiel — NavigationTiming responseStart |
| 7.2–7.14 | Optimisation serveur, BDD, cache, logs… | — | ❌ NT (tous) |

## Thème 8 — Hébergement (9 critères)

| Critère | Titre | Statut |
|---------|-------|--------|
| 8.1–8.9 | Politique environnementale, PUE, énergies renouvelables… | ❌ NT (tous) |

## Thème 9 — Algorithmie (12 critères)

| Critère | Titre | Statut |
|---------|-------|--------|
| 9.1–9.12 | Complexité algo, IA/ML, critères de sortie… | ❌ NT (tous) |

## Synthèse

| Statut | Nombre |
|--------|--------|
| ✅ Auto | 20 |
| ⚠️ Partiel | 3 (4.4, 7.1, heuristiques) |
| ❌ NT | 55 |
| ➕ Manquant | 1 (3.5 — redondance stockage) |
| **Total** | **79** |

## Points d'attention pour `public/audit.js`

- Les critères NT retournent `{ status: 'NT', message: '...' }` — ne jamais les forcer en NC
- Les heuristiques partielles (⚠️) peuvent générer des faux positifs — documenter clairement
- Numérotation interne : 5.12, 6.13, 6.14 sont des IDs internes (correspondance RGESN officielle à confirmer)
- Critère 3.5 (redondance stockage) est le seul manquant implémentable
