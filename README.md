# StockFlow — Application de gestion de stock

Application **classique** (tableau de bord, produits, mouvements) avec un **soin apporté au style** : interface moderne, responsive, animations légères et notifications. 100 % navigateur, **aucune dépendance**, aucun serveur obligatoire.

---

## Sommaire

1. [Fonctionnalités](#1-fonctionnalités)
2. [Aperçu de l'interface](#2-aperçu-de-linterface)
3. [Technologies](#3-technologies)
4. [Installation et démarrage](#4-installation-et-démarrage)
5. [Structure du projet](#5-structure-du-projet)
6. [Architecture du code](#6-architecture-du-code)
7. [Modèle de données](#7-modèle-de-données)
8. [Utilisation](#8-utilisation)
9. [Personnalisation](#9-personnalisation)
10. [Export et sauvegarde](#10-export-et-sauvegarde)
11. [Tests manuels de validation](#11-tests-manuels-de-validation)
12. [Compatibilité](#12-compatibilité)
13. [Contribution](#13-contribution)
14. [Licence](#14-licence)

---

## 1. Fonctionnalités

| Module | Ce que vous pouvez faire |
|---|---|
| **Tableau de bord** | Nombre de références, unités en stock, valeur financière du stock, alertes, derniers mouvements, valeur par catégorie (barres) |
| **Produits** | Créer, modifier, supprimer ; recherche instantanée ; filtres par catégorie et par état (disponible / stock bas / rupture) |
| **Mouvements** | Entrées (+) et sorties (−) avec quantité, motif et opérateur ; historique trié par date ; filtre entrées/sorties |
| **Alertes** | Déclenchées automatiquement quand le stock ≤ seuil d'alerte, ou = 0 (rupture) |
| **Persistance** | Sauvegarde automatique dans le `localStorage` du navigateur |
| **Export CSV** | Télécharge la liste complète des produits (compatible Excel, séparateur `;`) |
| **Aide intégrée** | Un écran « Aide du projet » est disponible directement dans l'application |
| **Démo** | Données d'exemple préchargées + bouton de réinitialisation |

Règles métier appliquées :

- Une **sortie supérieure au stock disponible est bloquée** avec un message d'erreur.
- Les **références produits sont uniques**.
- Modifier la quantité depuis la fiche produit génère automatiquement un **mouvement d'ajustement**.
- La **création avec quantité > 0** génère un mouvement « Stock initial ».

---

## 2. Aperçu de l'interface

- **Barre latérale sombre** avec navigation et actions globales (export, réinitialisation).
- **Cartes de statistiques** avec icômes colorées.
- **Tables zébrées** avec survol, badges d'état colorés et actions par ligne.
- **Fenêtres modales** (produit, mouvement, confirmation) avec arrière-plan flouté.
- **Notifications toast** en bas à droite (succès / erreur).
- **Responsive** : barre latérale coulissante sous 820 px, tables défilables.

---

## 3. Technologies

| Technologie | Rôle |
|---|---|
| HTML5 | Structure sémantique, formulaires, modales |
| CSS3 | Thème (variables CSS), grid/flex, animations, responsive |
| JavaScript vanilla (ES2021) | Logique applicative, aucune framework |
| `localStorage` | Persistance locale côté navigateur |
| Google Fonts « Inter » | Typographie (fonctionne aussi hors-ligne avec la police système) |

---

## 4. Installation et démarrage

```bash
# Installation des dépendances
npm install

# Démarrage du serveur (Node.js + SQLite)
npm start
```

L'application est maintenant accessible sur **http://localhost:3000**.
Le backend utilise Express et SQLite pour une persistance robuste.


---

## 4 bis. Lancer les tests

```bash
# une fois (installe jsdom, outil de dev uniquement)
npm install

# lance les 56 tests automatiques
npm test
```

| Suite | Fichier | Couverture |
|---|---|---|
| Couche données (22 tests) | `tests/data.test.js` | CRUD produits, règles de stock (sortie bloquée, quantités), stats, alertes, CSV, persistance, reset |
| Interface (34 tests) | `tests/ui.test.js` | Chargement sans erreur, chaque bouton, modales, validation du formulaire, filtres, recherche, navigation, export, réinitialisation |

```bash
# vérification rapide de syntaxe
node --check js/store.js
node --check js/app.js
```

---

## 5. Structure du projet

```
gestion-stock/
│
├── index.html            # Structure complète de l'application (vues + modales)
├── css/
│   └── style.css         # Thème, composants, responsive
├── js/
│   ├── store.js          # Couche données : CRUD, mouvements, stats, export
│   └── app.js            # Couche interface : vues, filtres, formulaires, toasts
├── tests/
│   ├── data.test.js      # 22 tests unitaires couche données (Node pur)
│   └── ui.test.js        # 34 tests interface (jsdom : boutons, formules, filtres)
├── docs/
│   └── GUIDE.md          # Guide utilisateur pas-à-pas
├── package.json          # npm test / npm start (dépendance de test : jsdom)
└── README.md             # Ce fichier
```

---

## 6. Architecture du code

Le code suit une séparation **données / interface** :

### `js/store.js` — module `Store` (IIFE)

Expose une API publique, l'état interne reste privé :

| Méthode | Description |
|---|---|
| `getProducts()` | Liste des produits |
| `addProduct(data)` | Création (+ mouvement « Stock initial » si quantité > 0) |
| `updateProduct(id, data)` | Mise à jour |
| `deleteProduct(id)` | Suppression du produit **et** de son historique |
| `getMovements()` | Mouvements triés du plus récent au plus ancien |
| `addMovement({...})` | Enregistre une entrée/sortie, vérifie le stock, met à jour la quantité |
| `stats()` | Agrégats du tableau de bord |
| `byCategory()` | Valeur du stock groupée par catégorie |
| `categories()` | Liste distincte des catégories |
| `status(p)` | `'ok'` \| `'low'` \| `'out'` |
| `exportCSV()` | Chaîne CSV prête au téléchargement |
| `reset()` | Restaure les données de démonstration |

### `js/app.js` — contrôleur d'interface

- Navigation entre les 4 vues (`switchView`)
- Rendu des tableaux et du tableau de bord
- Gestion des formulaires (validation, doublons, erreurs métier)
- Recherche et filtres en direct
- Modales, confirmations, toasts

Les deux fichiers sont chargés en ordre dans `index.html` :

```html
<script src="js/store.js"></script>
<script src="js/app.js"></script>
```

---

## 7. Modèle de données

### Produit

```json
{
  "id": "p1",
  "ref": "PRD-001",
  "name": "Clavier mécanique",
  "category": "Électronique",
  "price": 79.90,
  "qty": 24,
  "min": 5,
  "desc": "Switches bleus"
}
```

| Champ | Type | Règle |
|---|---|---|
| `id` | string | Identifiant unique généré automatiquement |
| `ref` | string | Requis, unique dans le catalogue |
| `name` | string | Requis |
| `category` | string | Optionnel, `Divers` par défaut |
| `price` | number | ≥ 0 |
| `qty` | number | ≥ 0 (entier) |
| `min` | number | Seuil d'alerte, défaut 5 |
| `desc` | string | Optionnel |

### Mouvement

```json
{
  "id": "m1",
  "productId": "p1",
  "type": "in",
  "qty": 30,
  "reason": "Réception fournisseur",
  "author": "Alice",
  "date": "2026-10-01T09:20:00"
}
```

### Clés `localStorage`

| Clé | Contenu |
|---|---|
| `stockflow.products` | Tableau des produits (JSON) |
| `stockflow.movements` | Tableau des mouvements (JSON) |

---

## 8. Utilisation

Le guide complet se trouve dans **[docs/GUIDE.md](docs/GUIDE.md)**, et un rappel interactif est intégré dans l'application (menu **Aide du projet**).

Résumé :

1. **Produits → + Nouveau produit** : renseigner référence, nom, prix, quantité et seuil.
2. **Mouvements → + Nouveau mouvement** : choisir le produit, entrée/sortie, quantité, motif.
3. **Tableau de bord** : surveiller la valeur du stock et les alertes.
4. **Exporter (CSV)** pour archiver ou analyser dans Excel.

Raccourcis clavier : `Échap` ferme une fenêtre, `Entrée` valide le formulaire actif.

---

## 9. Personnalisation

### Changer les couleurs

Tout le thème est piloté par les variables CSS en haut de `css/style.css` :

```css
:root {
  --primary: #4f46e5;      /* couleur principale (indigo) */
  --success: #059669;       /* stock disponible */
  --warning: #d97706;       /* stock bas */
  --danger:  #dc2626;       /* rupture / suppression */
  --sidebar-bg: #0f172a;    /* barre latérale */
  --radius: 14px;           /* arrondi des cartes */
}
```

### Changer la devise

Dans `js/app.js`, modifiez l'objet `Intl.NumberFormat` :

```js
{ style: 'currency', currency: 'USD' }   // dollars
{ style: 'currency', currency: 'MAD' }   // dirhams
```

### Modifier les données de démonstration

Éditez les tableaux `seedProducts` et `seedMovements` dans `js/store.js`, puis cliquez sur **Réinitialiser la démo**.

---

## 10. Export et sauvegarde

- **Export CSV** : bouton de la barre latérale — encodage UTF-8 avec BOM (accents corrects sous Excel), séparateur `;`.
- **Sauvegarde manuelle** : ouvrez la console du navigateur (`F12`) puis :

```js
localStorage.getItem('stockflow.products')
localStorage.getItem('stockflow.movements')
```

- **Restauration** : `localStorage.setItem('stockflow.products', '<votre JSON>')` puis recharger.
- **Effacer tout** : `localStorage.clear()` puis recharger.

---

## 11. Tests manuels de validation

À effectuer après toute modification :

- [ ] Ajouter un produit → il apparaît dans la table et le tableau de bord
- [ ] Utiliser une référence déjà existante → message d'erreur
- [ ] Sortie supérieure au stock → message « Stock insuffisant » et quantité inchangée
- [ ] Passer sous le seuil d'alerte → badge « Stock bas » + alerte au tableau de bord
- [ ] Mettre la quantité à 0 → badge « Rupture »
- [ ] Supprimer un produit → confirmation demandée, historique supprimé
- [ ] Rechercher / filtrer → table mise à jour instantanément
- [ ] Recharger la page → les données sont conservées
- [ ] Export CSV → fichier ouvrable dans Excel
- [ ] Écran ≤ 820 px → menu hamburger, tables défilables
- [ ] `Échap` ferme les modales

---

## 12. Compatibilité

- Chrome / Edge / Firefox / Safari récents
- Écrans de 360 px à 4K
- Fonctionne hors-ligne (seule la police Inter est chargée depuis le web, avec repli automatique)

---

## 13. Contribution

1. Créer une branche : `git checkout -b feature/ma-fonctionnalite`
2. Modifier le code en respectant la séparation `store.js` (données) / `app.js` (interface)
3. Vérifier la checklist de [validation](#11-tests-manuels-de-validation)
4. Ouvrir une *pull request* avec une description claire

Convention : variables en `camelCase`, classes CSS en `kebab-case`, pas de commentaires inutiles.

---

## 14. Licence

Projet fourni à des fins pédagogiques — libre d'utilisation et de modification.
