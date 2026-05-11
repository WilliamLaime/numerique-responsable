# Numérique Responsable

Extension Chrome (Manifest V3) d'audit automatique **accessibilité (RGAA 4.1.2)** et **écoconception (RGESN 2024)** des pages web.

## Fonctionnalités

- Audit automatique des critères RGAA 4.1.2 (accessibilité) et RGESN 2024 (écoconception)
- Modes d'audit : page courante, site entier (crawl via sitemap/robots.txt), liste d'URLs personnalisée
- Modes de référentiel : RGAA 4.1.2, WCAG 2.1, RGESN 2024
- Panneau latéral (Side Panel) + mode fenêtre détachée
- Mise en évidence (_highlight_) des éléments non conformes dans la page
- Vérificateur de contraste intégré (couleurs CSS modernes supportées : oklch, lab…)
- Export CSV, PDF (jsPDF) et export IA (Markdown orienté prompts de correction)
- Historique des audits persisté localement

## Statuts de règles

| Statut | Signification |
|--------|---------------|
| **C** | Conforme — critère respecté |
| **NC** | Non conforme — problème détecté |
| **NT** | Non testé — vérification manuelle requise |
| **NA** | Non applicable — critère sans objet sur cette page |

Règle absolue : **zéro faux positif**. En cas de doute, le statut est NT, jamais NC.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Interface | TypeScript strict · React 19 · Zustand 5 |
| Build | Vite 6 |
| Tests | Vitest 4 (unitaires) · Playwright (intégration) |
| Moteur d'audit | Vanilla JS injecté (`public/audit.js`) |

## Architecture

```
public/               # Fichiers injectés dans les pages (vanilla JS, copiés tels quels)
├── audit.js          # Moteur d'audit RGAA/RGESN (~120 Ko)
├── contrast-checker.js
├── highlight.js      # Mise en évidence des éléments NC
├── taborder.js       # Visualisation de l'ordre de tabulation
├── timing-init.js    # Initialise le buffer de timing dès document_start
├── background.js     # Service worker MV3
└── manifest.json

src/                  # Application React compilée par Vite → dist/
├── hooks/
│   ├── useAuditRunner.ts   # Orchestration crawl + audit
│   └── useExport.ts        # Exports CSV / PDF / IA
├── store/auditStore.ts     # État global Zustand
├── types/audit.ts          # Interfaces TypeScript
└── components/             # UI React
```

## Installation (mode développeur)

```bash
git clone https://github.com/WilliamLaime/numerique-responsable.git
cd numerique-responsable
npm install
npm run build
```

1. Ouvrir `chrome://extensions`
2. Activer le **mode développeur**
3. **Charger l'extension non empaquetée** → sélectionner le dossier `dist/`
4. Cliquer sur l'icône dans la barre d'outils → panneau latéral

## Commandes

```bash
npm run build        # Build Vite → dist/
npm run dev          # Build en mode watch
npm run test:unit    # Tests Vitest
npm test             # Tests Playwright (nécessite un build)
```

## Limites connues

- Les règles non automatisables sont marquées **NT** avec un `manualPrompt` explicite.
- Le contraste sur images de fond (`background-image`) n'est pas calculable automatiquement → NT.
- Le TTFB est marqué NT sur les SPAs (navigation via `pushState`).
- La détection de cache via `transferSize === 0` est non fiable pour les ressources cross-origin sans `Timing-Allow-Origin`.

## Permissions requises

| Permission | Usage |
|------------|-------|
| `activeTab`, `tabs`, `scripting` | Analyser la page et injecter le moteur d'audit |
| `sidePanel` | Afficher le panneau latéral |
| `storage` | Persister l'historique des audits (≤ 10 Mo) |
| `<all_urls>` | Auditer n'importe quelle page HTTP/HTTPS |

## Licence

[MIT](LICENSE)
