# Tutoriel — analyser et importer CardLock.mdb dans Appointment PMS

## 1. Avant de commencer : sélectionner la bonne base

1. Fermer proUSB avant de copier ou restaurer la base.
2. Emplacement habituel :
   `C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`
3. Si Windows virtualise les écritures de proUSB, vérifier la copie active :
   `%LOCALAPPDATA%\VirtualStore\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`
4. Comparer la date de modification et choisir le fichier réellement utilisé. Conserver une copie de sauvegarde ; Appointment PMS lit le MDB sans modifier la base source.

## 2. Ouvrir l'import

1. Ouvrir **Appointment PMS**.
2. Aller dans **Établissement → Structure / Import proUSB** ou **Base de données locale → Local & CardLock**.
3. Sélectionner `CardLock.mdb`.
4. Attendre l'analyse et consulter le résumé des tables.
5. Dans le Centre de données, ouvrir l'inventaire des tables pour voir le nom, le nombre de lignes, les colonnes et si la table est un objet système Access.

## 3. Comprendre les tables avant de confirmer

- `BuildingInfo` : référentiel des bâtiments (`BldNo`, `BldName`).
- `RoomInfo` : inventaire maître des chambres (`BldNo`, `FlrNo`, `RoomNo`, identifiants legacy, type, statut, tarif et compteurs de cartes).
- `GuestInfo` : clients et séjours (`BldRoomNo`, `ComeTime`, `GoTime`, `CardID`). Ce n'est pas un référentiel de chambres.
- `CardInfo` et `Dai` : cartes émises et familles de cartes.
- `RecordOpen` : journal des ouvertures.
- `OperatorInfo`, `CaoZuoInfo`, `LogInfo`, `RegInfo` : opérateurs, opérations, journaux et enregistrement/licence.

Les objets `MSys*`, formulaires, rapports et autres métadonnées Access sont inventoriés mais ne deviennent jamais des ressources de l'hôtel.

## 4. Vérifier les bâtiments et chambres

La hiérarchie est reconstituée depuis les champs réels :

`BuildingInfo.BldNo → RoomInfo.BldNo → RoomInfo.FlrNo → RoomInfo.RoomNo`

- `BldNo = 0` et `FlrNo = 0` sont des identifiants valides.
- Si `RoomNo` est vide, Appointment PMS vérifie les identifiants legacy `RomID2` puis `RomID`.
- Une référence telle que `2-1-12064` signifie bâtiment 2, étage 1, chambre 12064.
- Un bâtiment présent dans `BuildingInfo` mais sans ligne `RoomInfo` reste visible avec zéro chambre.
- Une ligne `RoomInfo` sans numéro exploitable est signalée et ignorée ; aucun intervalle de numéros n'est généré.

Comparer le nombre de chambres affiché pour chaque bâtiment avec les lignes `RoomInfo` correspondantes. Ne pas déduire l'étage à partir du premier chiffre du numéro de chambre.

## 5. Vérifier les séjours et les cartes

`GuestInfo.BldRoomNo` est rapproché d'une chambre existante en tenant compte du bâtiment et, lorsqu'il est présent, de l'étage. Si plusieurs chambres correspondent ou si l'étage est incohérent, le séjour est signalé comme non importé. Une ligne GuestInfo ne crée jamais une chambre.

Les séjours dont les dates sont absentes, invalides ou non chronologiques sont ignorés. Les cartes et événements d'ouverture restent des objets distincts des chambres et réservations.

## 6. Confirmer sans créer de données fictives

Avant de confirmer, contrôler :
- le nombre de bâtiments ;
- le nombre de lignes et de chambres RoomInfo par bâtiment ;
- les séjours liés et les séjours ignorés ;
- les tables illisibles et avertissements.

Lors d'un nouvel import, les anciens bâtiments/chambres issus de CardLock et les séjours CardLock précédemment importés sont remplacés par le nouvel instantané. Les ressources créées manuellement sont conservées ; les groupes de démonstration sont retirés. Aucun tarif ou statut housekeeping inconnu n'est inventé.

## 7. Diagnostiquer un deuxième bâtiment absent

1. Vérifier si `BuildingInfo` contient `BldNo = 2`.
2. Vérifier si `RoomInfo` contient des lignes `BldNo = 2`.
3. Si le bâtiment existe dans BuildingInfo mais pas dans RoomInfo, le bâtiment sera importé vide : proUSB ne fournit aucune ligne chambre pour lui dans ce fichier.
4. Si RoomInfo contient des chambres du bâtiment 2, comparer leurs colonnes `RoomNo`, `RomID2`, `RomID`, `BldNo` et `FlrNo` dans l'inventaire. Conserver le MDB source et le rapport pour le diagnostic.
5. Ne pas utiliser GuestInfo pour reconstituer une chambre absente : cela produirait une fausse ressource.

## Référence technique

Voir [Analyse des tables et relations CardLock](./CARDLOCK_DATABASE_ANALYSIS.md) et [Spécification proUSB](./PROUSB_SPECIFICATION.md).
