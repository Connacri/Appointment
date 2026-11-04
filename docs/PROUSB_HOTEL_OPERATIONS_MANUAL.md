# Manuel opérationnel Appointment — Hôtel et serrures proUSB

Ce manuel synthétise les deux guides constructeur fournis : *System & door lock setup simple Guidance* (8 pages) et *Data recovery process* (1 page).

## 1. Choisir comment créer l'hôtel

À la première ouverture, renseignez le nom officiel, le type, la ville et la devise.

Deux parcours exclusifs sont proposés :
- **Importer CardLock.mdb** pour reprendre un hôtel proUSB existant.
- **Créer la structure manuellement** pour un nouvel hôtel.

Si vous importez une base sur une structure hôtelière existante, vérifiez la sauvegarde et confirmez explicitement le remplacement.

## 2. Import CardLock.mdb

Chemin courant :
`C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`

Selon l'installation, le logiciel peut être sous `C:\Program Files\proUSB lock system\`. Windows peut virtualiser les écritures sous `%LOCALAPPDATA%\VirtualStore\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`. La copie VirtualStore peut être plus récente : comparez les dates de modification.

Le lecteur inspecte toutes les tables présentes et affiche leur nom, nombre de lignes et colonnes. Les données brutes techniques ne sont pas importées aveuglément.

| Table CardLock | Traitement |
|---|---|
| `BuildingInfo` | Bâtiments |
| `RoomInfo` | Chambres, bâtiment, étage et propriétés prises en charge |
| `GuestInfo` | Séjours et dates |
| `CardInfo` | Enregistrements de cartes pris en charge |
| `RecordOpen` | Nombre d'événements d'ouverture lisibles |
| `OperatorInfo`, `RegInfo`, `CaoZuoInfo`, `Dai`, `LogInfo` | Inventoriées ; pas de conversion automatique sans validation du schéma |

Procédure :
1. Fermez proUSB si vous copiez sa base active.
2. Conservez une copie de sécurité.
3. Dans Appointment, sélectionnez CardLock.mdb.
4. Vérifiez date, inventaire des tables, bâtiments, chambres, séjours, cartes et avertissements.
5. Confirmez le remplacement de la structure hôtelière si c'est bien le résultat souhaité.
6. Contrôlez les bâtiments, étages et séjours dans le Gantt.

Appointment doit lire une copie de CardLock et ne doit pas modifier le fichier utilisé par proUSB.

## 3. Créer bâtiments, étages et chambres manuellement

1. Ouvrez Configuration établissement → Bâtiments & Chambres.
2. Choisissez la création manuelle.
3. Saisissez le numéro et le nom du bâtiment.
4. Créez chaque étage : 0 = rez-de-chaussée, 1 = premier, 2 = deuxième, etc.
5. Définissez le préfixe et la plage de suffixes des chambres.

Exemple :
- Étage 1 : préfixe `1`, début `01`, fin `30` → chambres 101 à 130.
- Étage 2 : préfixe `2`, début `01`, fin `30` → chambres 201 à 230.
- Exclusion par défaut : `13` → 113 et 213 sont omises.

Le 13 est une convention par défaut, pas une règle obligatoire. Si l'hôtel possède une chambre 113, retirez 13 de la liste. Plusieurs exclusions peuvent être saisies, par exemple `13,17`.

Vérifiez le nombre de chambres créées, les exclusions et les doublons ignorés. Répétez pour chaque étage et chaque bâtiment, puis contrôlez le Gantt.

## 4. Installer et configurer proUSB

Le guide constructeur demande :
1. Installer le logiciel depuis le CD fourni avec l'encodeur.
2. Brancher l'encodeur USB.
3. Se connecter avec le code opérateur Admin ; le guide indique qu'aucun mot de passe n'est défini par défaut.
4. Dans System Options, configurer le chemin de sauvegarde quotidienne.
5. Suivre l'enregistrement du système avec le numéro de l'encodeur et le code fourni par le constructeur. Ne pas choisir « For door lock installation only » pour l'installation normale.
6. Configurer les opérateurs dans Operator Management.

## 5. Cartes et programmation des serrures

Le guide distingue :
- **System Card / Authorizing Card** : carte d'autorisation du système, une par hôtel selon le constructeur ; à conserver séparément.
- **Guest Card** : carte client d'une chambre précise.
- **Master Card** : ouvre les serrures déjà configurées.
- **Clock Setting Card** : règle l'horloge de la serrure.

Pour affecter une serrure à une chambre :
1. Émettre la carte système sur l'encodeur.
2. Émettre la carte client portant exactement le numéro de la chambre.
3. Sur la serrure physique, présenter la carte système trois fois de suite.
4. Immédiatement après, présenter une fois la carte client de cette chambre.
5. Vérifier les signaux lumineux/sonores et tester l'ouverture.

Ne mélangez jamais les cartes de deux chambres. Une carte de test peut ouvrir la porte avant l'autorisation, mais elle devient invalide après l'autorisation de la serrure. Utilisez ensuite la Guest Card émise pour cette chambre.

## 6. Sauvegarder et restaurer CardLock

Le constructeur indique une sauvegarde quotidienne nommée `CardLock` suivie de six chiffres de date et de `.MDB`, par exemple `CardLock101126.MDB`.

Pour restaurer :
1. Fermer complètement proUSB.
2. Choisir une sauvegarde récente et vérifiée.
3. Copier la sauvegarde dans un autre dossier pour conserver l'original.
4. Renommer la copie en `CardLock.MDB` en retirant les six chiffres de date.
5. Copier le fichier dans le dossier du logiciel.
6. Remplacer l'ancien fichier uniquement après sauvegarde de celui-ci.
7. Relancer proUSB et vérifier les bâtiments, chambres et données attendues.

Conservez plusieurs jours de sauvegardes et testez périodiquement une restauration sur une copie.

## 7. Dépannage

- **Aucun voyant/son :** vérifier piles et polarité, alimentation, câble, connecteurs PCB et alignement.
- **Voyants et moteur actifs mais poignée inactive :** vérifier l'alignement des flèches de la mortaise selon le modèle.
- **Bips répétés :** consulter le tableau de codes sonores de la documentation constructeur ; ne pas inventer la signification.
- **Horloge incorrecte :** émettre une Clock Setting Card et la présenter rapidement.

**Attention — réinitialisation destructive :** le manuel indique que trois rotations de clé mécanique, trois passages de la carte système puis un passage de carte client effacent les données de la serrure. N'effectuez cette séquence qu'avec autorisation et procédure constructeur.

## 8. Runtime Windows natif et sécurité

Le lanceur Edge historique ne constitue pas un runtime natif. La cible Appointment Desktop est Tauri :
- WebView2 affiche l'interface, tandis que le processus Rust natif exécute les commandes système autorisées.
- L'ouverture CardLock utilise un sélecteur natif ou des emplacements connus détectés.
- Les secrets Neon sont conservés dans Windows Credential Manager, jamais dans localStorage ou les logs.
- Stocker une chaîne PostgreSQL ne prouve pas que Neon est connecté : un connecteur serveur et un test réel sont nécessaires avant tout état « connecté ».
- Les ACL NTFS continuent de s'appliquer. L'application ne contourne pas les permissions Windows ; l'écriture dans Program Files peut nécessiter une élévation. Les sauvegardes doivent aller dans un dossier de données utilisateur.

## Sources

- *System & door lock setup simple Guidance*, 8 pages.
- *Data recovery process*, 1 page.

Les menus et chemins varient selon la version proUSB. La procédure de la version matérielle et logicielle installée prévaut.
