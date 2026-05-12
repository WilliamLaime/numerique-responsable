# WCAG 2.2 — Critères de succès complets

Version : WCAG 2.2 (W3C Recommendation, octobre 2023)
Niveaux : A (minimum) · AA (exigence légale RGAA/EAA) · AAA (optimal)

**Nouveaux en 2.2** (par rapport à 2.1) : 2.4.11, 2.4.12, 2.4.13, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8, 3.3.9
**Retiré en 2.2** : 4.1.1 Parsing (obsolète, les navigateurs modernes gèrent les erreurs HTML)

---

## Principe 1 — Perceptible

Les informations et les composants d'interface doivent être présentables à l'utilisateur de manière à ce qu'il puisse les percevoir.

### 1.1 Alternatives textuelles

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 1.1.1 | Non-text Content | A | Tout contenu non textuel a une alternative textuelle équivalente (alt, aria-label, aria-labelledby, title). Exceptions : CAPTCHA (alternative modale), décoration (alt vide ou role="presentation"), tests (description du but). |

### 1.2 Médias temporels

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 1.2.1 | Audio-only and Video-only (Prerecorded) | A | Contenu audio-seul ou vidéo-seul (préenregistré) a une alternative (transcription textuelle pour audio-seul, audiodescription ou transcription pour vidéo-seul). |
| 1.2.2 | Captions (Prerecorded) | A | Sous-titres fournis pour tout contenu audio préenregistré dans les médias synchronisés. |
| 1.2.3 | Audio Description or Media Alternative (Prerecorded) | A | Audiodescription ou alternative médiatique (texte) pour la vidéo préenregistrée dans les médias synchronisés. |
| 1.2.4 | Captions (Live) | AA | Sous-titres pour tout contenu audio en direct dans les médias synchronisés. |
| 1.2.5 | Audio Description (Prerecorded) | AA | Audiodescription fournie pour tout contenu vidéo préenregistré dans les médias synchronisés. |
| 1.2.6 | Sign Language (Prerecorded) | AAA | Interprétation en langue des signes pour tout contenu audio préenregistré dans les médias synchronisés. |
| 1.2.7 | Extended Audio Description (Prerecorded) | AAA | Audiodescription étendue (pauses vidéo) pour la vidéo préenregistrée quand la pause vidéo standard est insuffisante. |
| 1.2.8 | Media Alternative (Prerecorded) | AAA | Alternative médiatique complète (texte) pour tout média synchronisé préenregistré, ou pour toute vidéo-seule. |
| 1.2.9 | Audio-only (Live) | AAA | Alternative équivalente pour contenu audio-seul en direct. |

### 1.3 Adaptable

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 1.3.1 | Info and Relationships | A | Informations, structure, relations transmises visuellement sont disponibles via le texte ou programmatiquement (sémantique HTML correcte, ARIA). |
| 1.3.2 | Meaningful Sequence | A | L'ordre de lecture (séquence significative) est déterminable programmatiquement. |
| 1.3.3 | Sensory Characteristics | A | Les instructions ne s'appuient pas uniquement sur des caractéristiques sensorielles (forme, couleur, taille, emplacement visuel, orientation, son). |
| 1.3.4 | Orientation | AA | Le contenu ne restreint pas la vue à une seule orientation (portrait/paysage), sauf si essentiel. *[WCAG 2.1]* |
| 1.3.5 | Identify Input Purpose | AA | La finalité de chaque champ de formulaire collectant des données personnelles peut être déterminée programmatiquement (autocomplete HTML). *[WCAG 2.1]* |
| 1.3.6 | Identify Purpose | AAA | La finalité des composants d'interface, icônes et régions peut être déterminée programmatiquement. *[WCAG 2.1]* |

### 1.4 Distinguable

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 1.4.1 | Use of Color | A | La couleur n'est pas le seul moyen de transmettre une information, indiquer une action, solliciter une réponse ou distinguer un élément visuel. |
| 1.4.2 | Audio Control | A | Si un contenu audio démarre automatiquement et dure plus de 3 secondes, l'utilisateur peut le mettre en pause, l'arrêter ou baisser le volume indépendamment. |
| 1.4.3 | Contrast (Minimum) | AA | Rapport de contraste d'au moins 4.5:1 pour le texte (< 18pt normal, < 14pt gras). Exceptions : texte décoratif, texte dans logo, texte inactif. Grand texte (≥ 18pt ou ≥ 14pt gras) : 3:1. |
| 1.4.4 | Resize Text | AA | Texte redimensionnable jusqu'à 200% sans perte de contenu ni fonctionnalité (sans lecteur d'écran, sans technologies d'assistance). |
| 1.4.5 | Images of Text | AA | Texte utilisé à la place des images de texte, sauf si une présentation particulière est essentielle ou personnalisable. |
| 1.4.6 | Contrast (Enhanced) | AAA | Rapport de contraste d'au moins 7:1 pour le texte normal, 4.5:1 pour le grand texte. |
| 1.4.7 | Low or No Background Audio | AAA | Audio de premier plan sur fond : fond peut être désactivé, est au moins 20 dB plus bas, ou pas de fond. |
| 1.4.8 | Visual Presentation | AAA | Blocs de texte : couleurs sélectionnables, largeur ≤ 80 caractères, texte non justifié, interligne ≥ 1.5 dans les paragraphes, espacement entre paragraphes ≥ 1.5× l'interligne, texte redimensionnable sans scroll horizontal à 256px. |
| 1.4.9 | Images of Text (No Exception) | AAA | Images de texte utilisées uniquement pour décoration ou lorsque la présentation est essentielle à l'information transmise. |
| 1.4.10 | Reflow | AA | Contenu peut être présenté sans perte d'information ni fonctionnalité et sans défilement bidirectionnel à 320px CSS (équivalent zoom 400%). *[WCAG 2.1]* |
| 1.4.11 | Non-text Contrast | AA | Rapport de contraste d'au moins 3:1 pour les composants d'interface (bordures de champs, boutons) et les éléments graphiques informatifs. *[WCAG 2.1]* |
| 1.4.12 | Text Spacing | AA | Aucune perte de contenu/fonctionnalité avec ces surcharges CSS : hauteur de ligne 1.5×, espacement après paragraphes 2×, espacement lettres 0.12em, espacement mots 0.16em. *[WCAG 2.1]* |
| 1.4.13 | Content on Hover or Focus | AA | Contenu additionnel visible au survol/focus est rejetable (sans bouger le pointeur), hoverable (le pointeur peut aller dessus), persistant (visible jusqu'à survol, focus perdu ou fermé). *[WCAG 2.1]* |

---

## Principe 2 — Utilisable

Les composants d'interface et la navigation doivent être utilisables.

### 2.1 Accessibilité au clavier

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 2.1.1 | Keyboard | A | Toutes les fonctionnalités sont accessibles au clavier seul, sauf si elles nécessitent une saisie dépendante du trajet (dessin à main levée). |
| 2.1.2 | No Keyboard Trap | A | Focus clavier peut être déplacé depuis tout composant (pas de piège clavier). Si navigation non standard, l'utilisateur en est informé. |
| 2.1.3 | Keyboard (No Exception) | AAA | Toutes les fonctionnalités accessibles au clavier seul, sans exception. |
| 2.1.4 | Character Key Shortcuts | A | Si des raccourcis à caractère unique sont implémentés, l'utilisateur peut les désactiver, remapper ou activer uniquement sur focus. *[WCAG 2.1]* |

### 2.2 Délai suffisant

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 2.2.1 | Timing Adjustable | A | Pour chaque limite de temps, l'utilisateur peut la désactiver, ajuster (×10 minimum), ou en être averti et la prolonger (20s minimum). Exceptions : temps réel (enchères), essentiel, > 20h. |
| 2.2.2 | Pause, Stop, Hide | A | Contenu en mouvement/clignotant/défilant : peut être mis en pause, arrêté ou caché si dure > 5s et n'est pas la seule activité. Mise à jour automatique contrôlable. |
| 2.2.3 | No Timing | AAA | Pas de limite de temps sur le contenu, sauf synchronisation temps réel ou jeu compétitif. |
| 2.2.4 | Interruptions | AAA | Les interruptions peuvent être différées ou supprimées (sauf urgences). |
| 2.2.5 | Re-authenticating | AAA | Ré-authentification sans perte de données : session préservée ou données sauvegardées. |
| 2.2.6 | Timeouts | AAA | Avertissement si inactivité entraîne perte de données, sauf si données préservées > 20h. *[WCAG 2.1]* |

### 2.3 Crises et réactions physiques

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 2.3.1 | Three Flashes or Below Threshold | A | Pas de contenu flashant plus de 3 fois par seconde, ou les flashs restent sous les seuils général et rouge. |
| 2.3.2 | Three Flashes | AAA | Pas de contenu flashant plus de 3 fois par seconde, sans exception de seuil. |
| 2.3.3 | Animation from Interactions | AAA | Animations déclenchées par interactions peuvent être désactivées (sauf essentielles). *[WCAG 2.1]* |

### 2.4 Navigable

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 2.4.1 | Bypass Blocks | A | Mécanisme de saut des blocs répétés (lien d'évitement, skip link, landmark `<main>`). |
| 2.4.2 | Page Titled | A | Les pages web ont un titre qui décrit le sujet ou l'objectif. |
| 2.4.3 | Focus Order | A | Les éléments interactifs reçoivent le focus dans un ordre qui préserve la signification et l'opérabilité. |
| 2.4.4 | Link Purpose (In Context) | A | La destination de chaque lien peut être déterminée à partir du texte du lien seul, ou du texte du lien + contexte programmatiquement déterminable. |
| 2.4.5 | Multiple Ways | AA | Au moins deux façons de trouver une page (plan du site, recherche, liste de liens, etc.), sauf si la page est résultante d'un processus. |
| 2.4.6 | Headings and Labels | AA | Les intitulés (headings) et les labels décrivent le sujet ou l'objectif. |
| 2.4.7 | Focus Visible | AA | Tout composant d'interface activable via clavier a un indicateur de focus visible. |
| 2.4.8 | Location | AAA | Information sur la position de l'utilisateur dans l'ensemble du site (fil d'Ariane, plan de site). |
| 2.4.9 | Link Purpose (Link Only) | AAA | La destination du lien peut être déterminée uniquement à partir du texte du lien. |
| 2.4.10 | Section Headings | AAA | Les sections de contenu sont titrées (headings). |
| 2.4.11 | Focus Not Obscured (Minimum) | AA | Quand un composant reçoit le focus via clavier, il n'est pas entièrement masqué par du contenu créé par l'auteur (sticky headers, modales). **[NOUVEAU 2.2]** |
| 2.4.12 | Focus Not Obscured (Enhanced) | AAA | Quand un composant reçoit le focus, aucune partie de l'indicateur de focus n'est masquée. **[NOUVEAU 2.2]** |
| 2.4.13 | Focus Appearance | AA | L'indicateur de focus a une surface d'au moins le périmètre du composant × 2px CSS, et un rapport de contraste d'au moins 3:1 entre les pixels focalisés/non focalisés. **[NOUVEAU 2.2]** |

### 2.5 Modalités d'entrée

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 2.5.1 | Pointer Gestures | A | Fonctionnalités multi-points ou trajet-dépendantes ont une alternative à un seul pointeur. *[WCAG 2.1]* |
| 2.5.2 | Pointer Cancellation | A | Pour les fonctionnalités à un seul pointeur : pas d'événement down, annulation/retour possible, ou up event essentiel. *[WCAG 2.1]* |
| 2.5.3 | Label in Name | A | Pour les composants avec label textuel visible, le nom accessible contient le texte visible. *[WCAG 2.1]* |
| 2.5.4 | Motion Actuation | A | Fonctionnalités actionnables par mouvement d'appareil (shake, tilt) ont une alternative interface et peuvent être désactivées. *[WCAG 2.1]* |
| 2.5.5 | Target Size (Enhanced) | AAA | Taille de cible ≥ 44×44px CSS (sauf inline, espacement suffisant, essentiel, déterminé par l'agent). *[WCAG 2.1]* |
| 2.5.6 | Concurrent Input Mechanisms | AAA | Le contenu ne restreint pas l'utilisation des modalités d'entrée disponibles sur la plateforme. *[WCAG 2.1]* |
| 2.5.7 | Dragging Movements | AA | Fonctionnalités par glisser-déposer ont une alternative à pointer-simple (sauf si glisser est essentiel). **[NOUVEAU 2.2]** |
| 2.5.8 | Target Size (Minimum) | AA | Taille de cible ≥ 24×24px CSS, ou espacement autour de 24px, ou inline/agent/essentiel. **[NOUVEAU 2.2]** |

---

## Principe 3 — Compréhensible

Les informations et les opérations d'interface doivent être compréhensibles.

### 3.1 Lisible

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 3.1.1 | Language of Page | A | Langue principale de la page déterminable programmatiquement (`lang` sur `<html>`). |
| 3.1.2 | Language of Parts | AA | Langue de chaque passage ou phrase déterminable programmatiquement (attribut `lang`), sauf noms propres, mots techniques, termes indéterminés. |
| 3.1.3 | Unusual Words | AAA | Mécanisme disponible pour identifier les mots/expressions d'usage inhabituel, idiomes, jargon. |
| 3.1.4 | Abbreviations | AAA | Mécanisme disponible pour identifier la forme développée des abréviations. |
| 3.1.5 | Reading Level | AAA | Si le contenu requiert une capacité de lecture supérieure au premier cycle secondaire, une version simplifiée est disponible. |
| 3.1.6 | Pronunciation | AAA | Mécanisme disponible pour identifier la prononciation des mots ambigus. |

### 3.2 Prévisible

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 3.2.1 | On Focus | A | La réception du focus par un composant ne déclenche pas automatiquement un changement de contexte. |
| 3.2.2 | On Input | A | La saisie dans un composant ne déclenche pas automatiquement un changement de contexte (sauf si l'utilisateur en est averti). |
| 3.2.3 | Consistent Navigation | AA | Les mécanismes de navigation répétés sur plusieurs pages apparaissent dans le même ordre relatif (sauf changement initié par l'utilisateur). |
| 3.2.4 | Consistent Identification | AA | Les composants avec la même fonctionnalité sont identifiés de manière cohérente. |
| 3.2.5 | Change on Request | AAA | Les changements de contexte sont initiés uniquement par l'utilisateur, ou un mécanisme permet de les désactiver. |
| 3.2.6 | Consistent Help | A | Les mécanismes d'aide (contact humain, chat, FAQ, outil d'auto-assistance) apparaissent dans le même ordre relatif sur toutes les pages. **[NOUVEAU 2.2]** |

### 3.3 Assistance à la saisie

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| 3.3.1 | Error Identification | A | Erreur de saisie détectée automatiquement : l'élément en erreur est identifié et l'erreur décrite à l'utilisateur en texte. |
| 3.3.2 | Labels or Instructions | A | Labels ou instructions fournis quand le contenu requiert une saisie utilisateur. |
| 3.3.3 | Error Suggestion | AA | Erreur détectée et suggestions de correction connues fournies à l'utilisateur (sauf sécurité/objectif). |
| 3.3.4 | Error Prevention (Legal, Financial, Data) | AA | Pour soumissions avec effets légaux/financiers ou modifications/suppression de données : réversible, vérifié ou confirmé. |
| 3.3.5 | Help | AAA | Aide contextuelle disponible (sauf si non nécessaire). |
| 3.3.6 | Error Prevention (All) | AAA | Pour toute soumission : réversible, vérifiée ou confirmée. |
| 3.3.7 | Redundant Entry | A | Informations déjà saisies dans le même processus sont auto-remplies ou sélectionnables (sauf essentiel, sécurité, ou données expirées). **[NOUVEAU 2.2]** |
| 3.3.8 | Accessible Authentication (Minimum) | AA | Aucune épreuve cognitive (mémorisation, calcul, résolution de puzzle, transcription) requise dans une étape d'authentification, sauf si alternative fournie ou mécanisme d'assistance disponible. **[NOUVEAU 2.2]** |
| 3.3.9 | Accessible Authentication (Enhanced) | AAA | Aucune épreuve cognitive requise dans une étape d'authentification, sans exception. **[NOUVEAU 2.2]** |

---

## Principe 4 — Robuste

Le contenu doit être suffisamment robuste pour être interprété de façon fiable par les agents utilisateurs, y compris les technologies d'assistance.

### 4.1 Compatible

| Critère | Titre | Niveau | Description |
|---------|-------|--------|-------------|
| ~~4.1.1~~ | ~~Parsing~~ | ~~A~~ | **Retiré en WCAG 2.2.** Les navigateurs modernes gèrent les erreurs HTML de façon standardisée ; ce critère est obsolète. |
| 4.1.2 | Name, Role, Value | A | Pour tous les composants d'interface : nom et rôle déterminables programmatiquement ; états, propriétés et valeurs définissables et notifiables aux technologies d'assistance (ARIA, HTML sémantique). |
| 4.1.3 | Status Messages | AA | Les messages de statut peuvent être déterminés programmatiquement via rôle ou propriété (aria-live, role="alert", role="status") sans recevoir le focus. *[WCAG 2.1]* |

---

## Résumé des niveaux

| Niveau | Critères actifs | Objectif |
|--------|-----------------|---------|
| **A** | 30 | Minimum absolu — barrières majeures levées |
| **AA** | 24 | Exigence légale (RGAA, EAA, Section 508) |
| **AAA** | 32 | Optimal — accessibilité maximale |
| **Total actifs** | **86** | (87 - 1 retiré : 4.1.1) |

## Delta WCAG 2.2 vs 2.1

| Critère | Niveau | Nature |
|---------|--------|--------|
| 2.4.11 Focus Not Obscured (Minimum) | AA | Nouveau |
| 2.4.12 Focus Not Obscured (Enhanced) | AAA | Nouveau |
| 2.4.13 Focus Appearance | AA | Nouveau |
| 2.5.7 Dragging Movements | AA | Nouveau |
| 2.5.8 Target Size (Minimum) | AA | Nouveau |
| 3.2.6 Consistent Help | A | Nouveau |
| 3.3.7 Redundant Entry | A | Nouveau |
| 3.3.8 Accessible Authentication (Minimum) | AA | Nouveau |
| 3.3.9 Accessible Authentication (Enhanced) | AAA | Nouveau |
| 4.1.1 Parsing | — | Retiré |
