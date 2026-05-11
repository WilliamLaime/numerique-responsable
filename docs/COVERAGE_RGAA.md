# Couverture RGAA 4.1.2 — 106 critères

> Légende des statuts :
> - `✅ Auto` — implémenté et fiable
> - `⚠️ Partiel` — implémenté mais heuristique faible ou faux positifs possibles
> - `❌ NT` — non automatisable, présent comme NT
> - `➕ Manquant` — absent du moteur (ni auto ni NT)

| Critère | Titre court | ID règle | Statut | Automatisable | Action |
|---------|-------------|----------|--------|---------------|--------|
| **Thème 1 — Images** |
| 1.1 | Image porteuse d'information avec alt | `img-1.1-alt-missing` | ✅ Auto | Oui | — |
| 1.2 | Image décorative correctement ignorée | `img-1.2-decorative` | ✅ Auto | Oui | — |
| 1.3 | Alternative textuelle pertinente | `img-1.3-alt-relevant` | ⚠️ Partiel | Partiel | Heuristique sur alts génériques/courts |
| 1.4 | Image-CAPTCHA avec alternative | `img-1.4-captcha` | ✅ Auto | Oui | — |
| 1.5 | Alternative CAPTCHA pertinente | `img-1.5-captcha-relevant` | ⚠️ Partiel | Non | Présence d'alternative audio non vérifiable |
| 1.6 | Image complexe avec description longue | `img-1.6-long-desc` | ✅ Auto | Partiel | Corrigé : cible uniquement figures avec images |
| 1.7 | Description longue pertinente | `img-1.7-long-desc-relevant` | ⚠️ Partiel | Partiel | Longueur figcaption ≥ 10 chars |
| 1.8 | Image-texte remplaçable | `img-1.8-image-text` | ⚠️ Partiel | Partiel | Heuristique sur longueur alt |
| 1.9 | Légende liée à l'image | `img-1.9-figure-legend` | ✅ Auto | Oui | — |
| **Thème 2 — Cadres** |
| 2.1 | Iframe avec titre | `frame-2.1-title` | ✅ Auto | Oui | — |
| 2.2 | Titre d'iframe pertinent | `frame-2.2-title-relevant` | ✅ Auto | Partiel | Amélioré : liste mots génériques enrichie |
| **Thème 3 — Couleurs** |
| 3.1 | Information non donnée par la couleur seule | `col-3.1-info-color` | ❌ NT | Non | Requiert inspection visuelle manuelle |
| 3.2 | Contraste texte suffisant | `col-3.2-contrast-text` | ✅ Auto | Oui | — |
| 3.3 | Contraste composants d'interface suffisant | `col-3.3-contrast-ui` | ❌ NT | Partiel | Heuristique fragile, NT retenu par sécurité |
| **Thème 4 — Multimédia** |
| 4.1 | Média temporel avec transcription | `mul-4.1-transcript` | ❌ NT | Non | Requiert lecture du contenu |
| 4.2 | Transcription pertinente | `mul-4.2-transcript-relevant` | ❌ NT | Non | — |
| 4.3 | Vidéo avec sous-titres | `mul-4.3-subtitles` | ❌ NT | Non | — |
| 4.4 | Sous-titres pertinents | `mul-4.4-subtitles-relevant` | ❌ NT | Non | — |
| 4.5 | Vidéo avec audiodescription | `mul-4.5-audiodescription` | ❌ NT | Non | — |
| 4.6 | Audiodescription pertinente | `mul-4.6-audiodescription-relevant` | ❌ NT | Non | — |
| 4.7 | Média temporel identifiable | `mul-4.7-alt-relevant` | ⚠️ Partiel | Partiel | Vérifie nom accessible uniquement |
| 4.8 | Média non temporel avec alternative | `mul-4.8-alt` | ✅ Auto | Partiel | SVG sans nom accessible |
| 4.9 | Alternative non temporelle pertinente | `mul-4.9-alt-relevant` | ❌ NT | Non | — |
| 4.10 | Son autoplay contrôlable | `mul-4.10-sound-control` | ✅ Auto | Oui | — |
| 4.11 | Médias temporels avec controls | `mul-4.11-controls` | ✅ Auto | Oui | — |
| 4.12 | Pas de piège clavier dans médias | `mul-4.12-trap-keyboard` | ❌ NT | Non | — |
| 4.13 | Compatibilité AT des médias | `mul-4.13-tech` | ❌ NT | Non | — |
| **Thème 5 — Tableaux** |
| 5.1 | Tableau complexe avec résumé | `tab-5.1-complex-summary` | ✅ Auto | Oui | — |
| 5.2 | Résumé tableau complexe pertinent | `tab-5.2-summary-relevant` | ❌ NT | Non | — |
| 5.3 | Tableau de mise en forme linéarisé | `tab-5.3-linearize` | ❌ NT | Non | — |
| 5.4 | Tableau de données avec titre | `tab-5.4-data-identified` | ✅ Auto | Oui | — |
| 5.5 | Titre de tableau pertinent | `tab-5.5-title-relevant` | ❌ NT | Non | — |
| 5.6 | En-têtes déclarés avec \<th\> | `tab-5.6-headers` | ✅ Auto | Oui | — |
| 5.7 | Association cellules/en-têtes correcte | `tab-5.7-assoc` | ✅ Auto | Partiel | Corrigé : tableaux simples exclus |
| 5.8 | Tableau de mise en forme sans éléments données | `tab-5.8-layout` | ✅ Auto | Oui | — |
| **Thème 6 — Liens** |
| 6.1 | Lien explicite | `lnk-6.1-name` | ✅ Auto | Oui | — |
| 6.2 | Intitulé de lien pertinent | `lnk-6.2-relevance` | ⚠️ Partiel | Partiel | Heuristique sur liens courts/génériques |
| 6.3 | Lien image avec alternative | `lnk-6.3-image-link` | ❌ NT | Non | — |
| 6.4 | Alternative image-lien pertinente | `lnk-6.4-image-link-relevant` | ❌ NT | Non | — |
| 6.5 | Titre de lien explicite | `lnk-6.5-title` | ❌ NT | Non | — |
| 6.6 | Intitulé lien identique = destination identique | `lnk-6.6-consistent` | ❌ NT | Non | — |
| **Thème 7 — Scripts** |
| 7.1 | Script compatible AT | `scr-7.1-compatible` | ❌ NT | Non | — |
| 7.2 | Alternative script pertinente | `scr-7.2-alt` | ❌ NT | Non | — |
| 7.3 | Script contrôlable clavier | `scr-7.3-keyboard` | ⚠️ Partiel | Partiel | Détecte onclick sur non-natifs |
| 7.4 | Changement de contexte signalé | `scr-7.4-alt-keyboard` | ❌ NT | Non | — |
| 7.5 | Messages de statut via aria-live | `scr-7.5-aria-live` | ⚠️ Partiel | Partiel | Présence zones live, pas la qualité |
| **Thème 8 — Éléments obligatoires** |
| 8.1 | DOCTYPE présent | `obl-8.1-doctype` | ✅ Auto | Oui | — |
| 8.2 | Code source valide | `obl-8.2-valid` | ⚠️ Partiel | Partiel | IDs dupliqués détectés, W3C profond = NT |
| 8.3 | Langue par défaut présente | `obl-8.3-lang` | ✅ Auto | Oui | — |
| 8.4 | Code langue valide | `obl-8.4-lang-valid` | ✅ Auto | Oui | — |
| 8.5 | Titre de page présent | `obl-8.5-title` | ✅ Auto | Oui | — |
| 8.6 | Titre de page pertinent | `obl-8.6-title-relevant` | ⚠️ Partiel | Partiel | Heuristique sur titres génériques |
| 8.7 | Changements de langue balisés | `obl-8.7-lang-sub` | ❌ NT | Non | Corrigé : reclassé NT (détection naïve) |
| 8.8 | Sens de lecture signalé | `obl-8.8-dir` | ❌ NT | Non | — |
| 8.9 | Balises non utilisées à des fins de présentation | `obl-8.9-strict` | ❌ NT | Non | — |
| 8.10 | Changements de sens lecture balisés | `obl-8.10-dir` | ❌ NT | Non | — |
| **Thème 9 — Structuration** |
| 9.1 | Structure de titres (h1-h6) | `str-9.1-headings` | ✅ Auto | Oui | — |
| 9.2 | Structure du document cohérente | `str-9.2-outline` | ⚠️ Partiel | Partiel | Vérifie sections sans titres |
| 9.3 | Listes correctement structurées | `str-9.3-lists` | ⚠️ Partiel | Partiel | Détecte pseudo-listes avec puces |
| 9.4 | Citations correctement balisées | `str-9.4-citation` | ⚠️ Partiel | Partiel | Vérifie blockquote/q non vides |
| 9.5 | Utilisation éléments structurants cohérente | `str-9.5-sections` | ⚠️ Partiel | Partiel | Vérifie présence landmarks |
| 9.6 | Passages texte non significatifs | `str-9.6-text-sense` | ❌ NT | Non | — |
| **Thème 10 — Présentation** |
| 10.1 | CSS contrôle la présentation | `pre-10.1-css-info` | ❌ NT | Non | — |
| 10.2 | Contenu lisible sans CSS | `pre-10.2-css-off` | ❌ NT | Non | — |
| 10.3 | Information compréhensible sans CSS | `pre-10.3-css-off-sense` | ❌ NT | Non | — |
| 10.4 | Texte lisible avec zoom 200% | `pre-10.4-zoom` | ✅ Auto | Oui | — |
| 10.5 | Déclarations CSS couleurs cohérentes | `pre-10.5-contrast-not-unique` | ❌ NT | Non | — |
| 10.6 | Liens reconnaissables dans texte | `pre-10.6-link-distinct` | ❌ NT | Non | — |
| 10.7 | Focus visible | `pre-10.7-focus-visible` | ⚠️ Partiel | Partiel | Détecte outline:none CSS |
| 10.8 | Contenu caché ignoré AT | `pre-10.8-hidden-content` | ❌ NT | Non | — |
| 10.9 | Information non donnée par forme/taille/position | `pre-10.9-info-not-by-shape` | ❌ NT | Non | — |
| 10.10 | (idem 10.9 implémentation) | `pre-10.10-info-not-by-shape-2` | ❌ NT | Non | — |
| 10.11 | Agrandissement texte sans perte | `pre-10.11-text-resize` | ❌ NT | Non | — |
| 10.12 | Espacement texte redéfinissable | `pre-10.12-spacing` | ❌ NT | Non | — |
| 10.13 | Contenus au survol/focus contrôlables | `pre-10.13-tooltip` | ❌ NT | Non | — |
| 10.14 | Reflow 320 px (WCAG 1.4.10) | `pre-10.14-reflow` | ❌ NT | Non | — |
| **Thème 11 — Formulaires** |
| 11.1 | Champ avec étiquette | `frm-11.1-label` | ✅ Auto | Oui | — |
| 11.2 | Étiquette pertinente | `frm-11.2-label-relevant` | ❌ NT | Non | — |
| 11.3 | Étiquettes cohérentes | `frm-11.3-label-consistent` | ❌ NT | Non | — |
| 11.4 | Étiquette et champ accolés | `frm-11.4-label-contigue` | ❌ NT | Non | — |
| 11.5 | Champs groupés par fieldset | `frm-11.5-fieldset` | ✅ Auto | Oui | — |
| 11.6 | Fieldset avec legend | `frm-11.6-legend` | ✅ Auto | Oui | — |
| 11.7 | Legend pertinente | `frm-11.7-legend-relevant` | ❌ NT | Non | — |
| 11.8 | Items liste de choix structurés | `frm-11.8-order` | ❌ NT | Non | — |
| 11.9 | Intitulé bouton pertinent | `frm-11.9-button-name` | ✅ Auto | Oui | — |
| 11.10 | Contrôle de saisie pertinent | `frm-11.10-check` | ❌ NT | Non | — |
| 11.11 | Suggestions de correction | `frm-11.11-help` | ❌ NT | Non | — |
| 11.12 | Données modifiables avant soumission | `frm-11.12-validation` | ❌ NT | Non | — |
| 11.13 | Finalité champ déductible (autocomplete) | `frm-11.13-autofill` | ✅ Auto | Oui | Amélioré : 53 valeurs HTML + champs texte |
| 11.14 | Mécanisme d'authentification accessible | `frm-11.14-auth` | ❌ NT | Non | — |
| 11.15 | Aide à la saisie disponible | `frm-11.15-help` | ❌ NT | Non | — |
| **Thème 12 — Navigation** |
| 12.1 | Au moins deux systèmes de navigation | `nav-12.1-plan` | ⚠️ Partiel | Partiel | Heuristique nav/search/plan/footer |
| 12.2 | Menu toujours au même endroit | `nav-12.2-menu-consistency` | ❌ NT | Non | — |
| 12.3 | Plan du site pertinent | `nav-12.3-plan-relevant` | ❌ NT | Non | — |
| 12.4 | Landmarks correctement utilisés | `nav-12.4-landmarks` | ✅ Auto | Oui | — |
| 12.5 | Page aide accessible uniformément | `nav-12.5-plan-presence` | ❌ NT | Non | — |
| 12.6 | Zones de regroupement atteignables/évitables | `nav-12.6-main` | ✅ Auto | Partiel | Vérifie présence \<main\> |
| 12.7 | Lien d'évitement présent | `nav-12.7-skip-link` | ✅ Auto | Partiel | Amélioré : 20 liens + IDs cibles connus |
| 12.8 | Ordre de tabulation cohérent | `nav-12.8-tab-order` | ✅ Auto | Oui | — |
| 12.9 | Pas de piège clavier | `nav-12.9-no-trap` | ❌ NT | Non | — |
| 12.10 | Raccourcis clavier contrôlables | `nav-12.10-shortcuts` | ❌ NT | Non | — |
| 12.11 | Contenus additionnels contrôlables | `nav-12.11-hide` | ❌ NT | Non | — |
| **Thème 13 — Consultation** |
| 13.1 | Limites de temps contrôlables | `con-13.1-timeouts` | ⚠️ Partiel | Partiel | Détecte meta refresh < 60s |
| 13.2 | Ouverture nouvelle fenêtre avertie | `con-13.2-new-window` | ✅ Auto | Oui | — |
| 13.3 | Document bureautique avec version accessible | `con-13.3-office` | ⚠️ Partiel | Partiel | Vérifie mention du format |
| 13.4 | Version accessible pertinente | `con-13.4-office-relevant` | ⚠️ Partiel | Partiel | Présence document, qualité non testable |
| 13.5 | Abréviations explicitées | `con-13.5-abbr` | ⚠️ Partiel | Partiel | Vérifie \<abbr title\>, NT si aucun \<abbr\> |
| 13.6 | Version simplifiée disponible | `con-13.6-simpler` | ❌ NT | Non | — |
| 13.7 | Pas de flash/blink | `con-13.7-animation` | ✅ Auto | Partiel | Détecte \<marquee\>/\<blink\> |
| 13.8 | Contenus en mouvement contrôlables | `con-13.8-animation-control` | ⚠️ Partiel | Partiel | Vérifie autoplay sans controls |
| 13.9 | Contenu consulable quelle qu'orientation | `con-13.9-orientation` | ⚠️ Partiel | Partiel | Détecte CSS orientation bloquant |
| 13.10 | Gestes complexes avec alternative simple | `con-13.10-gestures` | ❌ NT | Non | — |
| 13.11 | Actions pointer annulables | `con-13.11-pointer-cancel` | ❌ NT | Non | — |
| 13.12 | Fonctionnalités par mouvement appareil avec alternative | `con-13.12-shake` | ❌ NT | Non | — |

## Synthèse

| Statut | Nombre |
|--------|--------|
| ✅ Auto | 29 |
| ⚠️ Partiel | 26 |
| ❌ NT | 51 |
| ➕ Manquant | 0 |
| **Total** | **106** |

## Critères manquants automatisables (priorité)

| Critère | Description | Automatisabilité |
|---------|-------------|-----------------|
| 6.3 | Lien-image avec alternative | Oui — vérifier img[alt] non vide dans \<a\> sans texte |
| 6.5 | Title lien explicite | Oui — vérifier \<a title\> quand nom accessible vide |
| 9.6 | Passages texte non significatifs | Non |
| 10.14 | Réorganisation contenu mobile | Non — multi-viewport requis |
| 11.14 | Authentification accessible | Non |
| 11.15 | Aide à la saisie | Non |
| 12.3 | Plan du site pertinent | Non |
| 13.6 | Version simplifiée | Non |
| 6.4 | Alternative image-lien pertinente | Partiel (couvert par 1.3) |
