# OrienRun v2 – course d'orientation (élève + prof)

Deux applications web (PWA) indépendantes, à héberger sur GitHub Pages (ou tout hébergement HTTPS) :

| Dossier | Rôle | Thème |
|---|---|---|
| `student/` | Appli élève : identification, course, saisie/scan du code, bilan, export `.xlsx` | orange / jaune |
| `admin/` | Appli prof : référentiel de balises, cartes, parcours, étiquettes PDF, base chiffrée, analyse des courses | vert / turquoise |

Aucun serveur ni compte : tout se passe dans des fichiers `.xlsx` échangés via l'ENT (Firebase n'est plus utilisé).

## 1. Avant de publier : changer la clé de chiffrement
Ouvrir `config.js` (présent dans **les deux** dossiers, contenu **identique**) et remplacer
`orienrun-CHANGEZ-MOI` par une longue phrase personnelle. Elle chiffre la base de balises et les fichiers de course.
Si elle change plus tard, les anciens fichiers deviennent illisibles. Les élèves doivent utiliser une appli et une base produites avec la même clé.
> Limite : la clé étant dans le code de l'appli, un élève très motivé et technicien pourrait la retrouver. Le chiffrement empêche l'ouverture du fichier dans Excel et toute lecture directe ; il ne résiste pas à une attaque informatique déterminée.

## 2. Flux de travail
1. **Prof** (`admin/`) : créer les cartes, les balises (formulaire, KML ou tableau), les parcours (ex. `C02 - P01`).
2. Onglet **Étiquettes** : PDF avec identifiant + QR code (pas le code, sauf option) → imprimer et coller sur les balises.
3. Onglet **Export / Import** : « Base chiffrée pour les élèves » → déposer le `.xlsx` sur l'ENT. Garder la « Sauvegarde complète » pour soi.
4. **Élève** (`student/`) : importer la base, saisir Nom / Prénom / Classe (+ partenaires, nom de groupe), choisir le parcours, courir ; à chaque balise « Entrer le code » ou « Scanner le code ». Bilan puis « Sauvegarder et exporter » → fichier `OrienRun_Nom_Prénom_Parcours.xlsx` à remettre au prof.
5. **Prof**, onglet **Courses élèves** : importer les fichiers, voir le détail, comparer la trace au parcours prévu (carte), exporter une synthèse `.xlsx` par classe.

## 3. Règles de validation
Une balise est validée si le code est correct (ou QR = bonne balise) **et** si la position GPS de l'élève est à moins de la tolérance (5 m par défaut, réglable dans Export / Import) de la balise. Sinon : message d'erreur (le code valide n'est jamais affiché), nouvel essai possible ou passage à la suivante (balise non validée). Taux de réussite = balises validées / balises du parcours.
Un GPS de smartphone est souvent précis à 3–15 m : une tolérance de 5 m peut refuser des balises correctement trouvées ; l'élève voit sa précision en direct.

## 4. Cartes hors ligne
Onglet **Cartes** : importer l'image de la carte de course et saisir les coordonnées de ses 4 bords (aperçu avec les balises pour vérifier le calage). Elle est ensuite affichée sans connexion dans l'analyse des courses. Sans image : fonds OpenTopoMap / OpenStreetMap en ligne (les tuiles déjà consultées sont conservées par l'appli, sans téléchargement en masse, conformément aux règles d'usage des serveurs de tuiles).

## 5. Fichiers
- `.xlsx` de base élèves : feuille `Lisez-moi` + feuille `OrienRun_Data` chiffrée (AES-GCM 256, PBKDF2).
- `.xlsx` de course : feuilles lisibles `Résumé` et `Balises` + `OrienRun_Data` chiffrée (permet l'import fiable côté prof).
- Les sauvegardes « complètes » (admin) contiennent aussi les images de cartes.

## 6. Mise en ligne (GitHub Pages)
Copier le contenu de `student/` dans le dépôt de l'appli élève (ex. dossier `OrienRun/`) et celui de `admin/` dans un dossier `OrienRun_Admin/` (ou dans Mes Apps EPS). Tout est relatif : aucun chemin à modifier. La caméra et le GPS exigent HTTPS (GitHub Pages convient).
