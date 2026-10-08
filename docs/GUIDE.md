# Guide utilisateur — StockFlow

Guide pas-à-pas de l'application de gestion de stock.

---

## 1. Première ouverture

1. Ouvrez `index.html` dans un navigateur.
2. L'écran affiché est le **Tableau de bord**, avec des données de démonstration préchargées.
3. Pour repartir de zéro : bouton **Réinitialiser la démo** (bas de la barre latérale).

> Les données sont enregistrées dans votre navigateur (`localStorage`). Rien n'est envoyé sur Internet.

---

## 2. Tableau de bord

| Carte | Signification |
|---|---|
| Références | Nombre de produits différents au catalogue |
| Unités en stock | Somme de toutes les quantités |
| Valeur du stock | Σ (prix × quantité) |
| Alertes | Produits en stock bas ou en rupture |

En dessous :

- **Alertes de stock** : liste des produits à réapprovisionner.
- **Derniers mouvements** : les 5 dernières entrées/sorties.
- **Valeur du stock par catégorie** : barres comparatives.

---

## 3. Gérer les produits

### Ajouter un produit

1. Menu **Produits** → bouton **+ Nouveau produit**.
2. Remplissez le formulaire :

   | Champ | Exemple | Obligatoire |
   |---|---|---|
   | Référence | `PRD-008` | Oui (unique) |
   | Nom | `Webcam HD` | Oui |
   | Catégorie | `Électronique` | Non (défaut : Divers) |
   | Prix unitaire | `59.90` | Oui |
   | Quantité en stock | `10` | Oui |
   | Seuil d'alerte | `5` | Non (défaut : 5) |
   | Description | texte libre | Non |

3. **Enregistrer**. Si la quantité initiale est > 0, un mouvement « Stock initial » est créé automatiquement.

### Modifier

Cliquez sur **Modifier** dans la ligne du produit. Si vous changez la quantité, un mouvement d'« Ajustement manuel » est enregistré automatiquement.

### Supprimer

Cliquez sur **Suppr.** puis confirmez. Le produit **et** tout son historique de mouvements sont supprimés.

### Rechercher et filtrer

- **Barre de recherche** (haut) : cherche dans le nom, la référence, la catégorie et la description.
- **Toutes les catégories** : filtre par catégorie.
- **Tous les états** : Stock suffisant / Stock bas / Rupture.

---

## 4. Enregistrer des mouvements

1. Menu **Mouvements** → **+ Nouveau mouvement**.
2. Choisissez :
   - **Produit** (liste déroulante avec le stock actuel),
   - **Type** : `Entrée (+)` ou `Sortie (-)`,
   - **Quantité** : entier > 0,
   - **Opérateur** et **Motif** (facultatifs).
3. **Valider le mouvement**.

Règles :

- Une **sortie impossible** (quantité > stock) est refusée avec le message : `Stock insuffisant (disponible : X)`.
- Le stock du produit est mis à jour immédiatement.
- L'historique est trié du plus récent au plus ancien.
- Filtre **Entrées / Sorties** pour ne voir qu'un type de mouvement.

---

## 5. États de stock

| Badge | Condition |
|---|---|
| 🟢 Disponible | stock > seuil d'alerte |
| 🟠 Stock bas | 0 < stock ≤ seuil |
| 🔴 Rupture | stock = 0 |

---

## 6. Exporter les données

Cliquez sur **Exporter (CSV)** dans la barre latérale : le fichier `produits-stock.csv` est téléchargé.

- Colonnes : Référence, Nom, Catégorie, Prix, Quantité, Seuil, État
- Compatible Excel / LibreOffice (séparateur `;`, accents corrects)

---

## 7. Aide du projet

Le menu **Aide du projet** (barre latérale) rappelle les fonctionnalités, le démarrage et l'architecture à l'intérieur même de l'application.

La documentation complète du développeur se trouve dans le fichier `README.md` à la racine.

---

## 8. Problèmes fréquents

| Problème | Solution |
|---|---|
| Les données ont disparu | Elles sont liées au navigateur/ordinateur ; vérifiez que vous utilisez le même navigateur et n'avez pas vidé les données du site |
| La police semble différente | Google Fonts est inaccessible (hors-ligne) : la police système fait automatiquement foi |
| Le bouton « Nouveau mouvement » ne s'ouvre pas | Créez d'abord un produit |
| L'export ne s'ouvre pas dans Excel | Ouvrez via Fichier → Ouvrir → type « Fichiers texte » et choisissez UTF-8 |
| Tout réinitialiser | Bouton **Réinitialiser la démo**, ou console : `localStorage.clear()` |

---

## 9. Raccourcis clavier

| Touche | Action |
|---|---|
| `Échap` | Ferme la fenêtre ouverte |
| `Entrée` | Valide le formulaire actif (hors textarea) |
