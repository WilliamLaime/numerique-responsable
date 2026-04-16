# Numérique Responsable

Extension Chrome d'audit **accessibilité (RGAA)** et **écoconception (RGESN)** de la page web courante.

## Fonctionnalités

- Audit automatique des critères RGAA (Référentiel Général d'Amélioration de l'Accessibilité)
- Audit automatique des critères RGESN (Référentiel Général d'Écoconception de Services Numériques)
- Résultats affichés dans un panneau latéral (Side Panel)
- Mise en évidence (highlight) des éléments non conformes directement dans la page

## Installation (mode développeur)

1. Cloner ce dépôt :
   ```bash
   git clone https://github.com/WilliamLaime/numerique-responsable.git
   ```
2. Ouvrir Chrome et aller sur `chrome://extensions`
3. Activer le **mode développeur** (coin supérieur droit)
4. Cliquer sur **Charger l'extension non empaquetée** et sélectionner le dossier `numerique-responsable`
5. L'icône de l'extension apparaît dans la barre d'outils — cliquer dessus pour ouvrir le panneau latéral

## Utilisation

1. Ouvrir une page web à auditer
2. Cliquer sur l'icône de l'extension pour ouvrir le panneau latéral
3. Lancer l'audit RGAA et/ou RGESN
4. Parcourir les résultats et les non-conformités détectées

## Permissions

L'extension requiert les permissions suivantes :

- `activeTab`, `tabs`, `scripting` : analyser la page courante
- `sidePanel` : afficher le panneau latéral
- `storage`, `unlimitedStorage` : mémoriser les résultats d'audit
- `<all_urls>` : pouvoir auditer n'importe quelle page

## Structure du projet

```
├── manifest.json       # Déclaration de l'extension (Manifest V3)
├── background.js       # Service worker
├── sidepanel.html      # Interface du panneau latéral
├── sidepanel.css       # Styles du panneau
├── sidepanel.js        # Logique du panneau
├── audit.js            # Moteur d'audit RGAA/RGESN
└── highlight.js        # Mise en évidence des éléments dans la page
```

## Contribuer

Les contributions sont les bienvenues. Ouvre une *issue* pour discuter d'un changement avant de proposer une *pull request*.

## Licence

[MIT](LICENSE)
