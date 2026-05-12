# Numérique Responsable — Extension Chrome

Extension Chrome MV3 d'audit éco-conception (RGESN 2024) et accessibilité (RGAA 4.1.2 / WCAG 2.2).

## Stack

TypeScript strict · React 19 · Zustand 5 · Vite 6 · Playwright · Vitest

## Architecture

Deux couches indépendantes :
- `public/audit.js` — moteur d'audit vanilla JS (1867 lignes), jamais bundlé, exposé via `globalThis.__nrAudit(mode)`. Contient toutes les règles RGAA + RGESN.
- `src/` — UI React compilée par Vite en `dist/panel.js`

Service worker : `public/background.js` (gestion fenêtres détachées)
Content script : `public/timing-init.js` (injecté à `document_start`)

## Commandes

```bash
npm run build        # Vite → dist/ (public/ + panel.js)
npm run build:watch  # Watch mode
npm test             # Playwright (intégration) — nécessite un build
npm run test:unit    # Vitest (unitaires)
```

## Chargement de l'extension

1. `npm run build`
2. `chrome://extensions` → Mode développeur ON
3. "Charger l'extension non empaquetée" → sélectionner `dist/`

## Types centralisés (`src/types/audit.ts`)

- `StatusCode` : `'C' | 'NC' | 'NA' | 'NT'`
- `AuditMode` : `'a11y' | 'eco' | 'both'`
- `AggregatedResult` : résultats agrégés multi-pages par règle

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `public/audit.js` | Moteur audit — toutes les règles RGAA + RGESN |
| `src/hooks/useAuditRunner.ts` | Orchestration crawl + injection audit.js |
| `src/lib/aggregation.ts` | Calcul pire statut multi-pages |
| `src/lib/grading.ts` | Scoring + mapping RGAA→WCAG |
| `src/lib/comparison.ts` | Diff avant/après deux audits |
| `src/hooks/useExport.ts` | CSV / PDF (jsPDF) / Markdown IA |
| `src/hooks/useStorage.ts` | Persistance `chrome.storage.local` |
| `docs/COVERAGE_RGAA.md` | État couverture RGAA (auto/partiel/NT) |
| `docs/COVERAGE_RGESN.md` | État couverture RGESN (auto/partiel/NT) |

## Couverture des référentiels

- **RGAA 4.1.2** : 106 critères — 29 auto, 26 partiels, 51 NT
- **RGESN 2024** : 78 critères — 20 auto, 3 partiels, 55 NT, 1 manquant (3.5)

## Scoring

- A11y : lettres A / AA / AAA
- Éco : priorités P1 (critique) / P2 (majeur) / P3 (mineur)
- Score RGESN : `(OUI / (OUI + NON)) × 100` par thématique, global pondéré

## Règles d'or

- **Zéro faux positif** : en cas de doute → `NT`, jamais `NC`
- `audit.js` ne doit jamais être bundlé (copié tel quel dans `dist/`)
- Tests Playwright : `tests/` avec fixtures HTML dans `tests/fixtures/`

## Référentiels détaillés

@.claude/rules/rgesn.md
@.claude/rules/rgaa.md
@.claude/rules/wcag.md

## Agents disponibles

- **`ecoconception-rgesn-auditor`** — audit RGESN 2024, calcul de scores, déclaration d'écoconception. Sait distinguer "auditer un site tiers" vs "implémenter une règle dans `audit.js`".
- **`a11y-rgaa-expert`** — audit RGAA 4.1.2 / WCAG 2.2, correction accessibilité, déclaration d'accessibilité. Cible WCAG 2.2 (pas 2.1).
