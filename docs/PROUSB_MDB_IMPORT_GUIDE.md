# Guide utilisateur — Importer correctement CardLock.mdb dans Appointment PMS

## Objectif

Importer les bâtiments, étages, chambres et séjours réellement enregistrés dans proUSB, sans générer de chambre à partir d'une plage de numéros ou d'une réservation orpheline.

## 1. Choisir la bonne base

1. Fermer le logiciel proUSB avant de copier ou restaurer sa base.
2. Le fichier est généralement situé dans :
   `C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`
3. Si Windows a virtualisé les écritures, la copie active peut se trouver sous :
   `%LOCALAPPDATA%\VirtualStore\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb`
4. Sélectionner le fichier actif le plus récent. Ne pas écraser le fichier source.

## 2. Lancer l'analyse avant d'importer

1. Ouvrir Appointment PMS.
2. Aller dans **Base de données locale → Local & CardLock**, ou dans **Établissement → Bâtiments & Chambres**.
3. Choisir `CardLock.mdb`.
4. Attendre l'analyse de toutes les tables.
5. Ouvrir **Inventaire des tables CardLock** et contrôler les noms, les colonnes, les nombres de lignes et les tables illisibles.

Tables principales :
- `BuildingInfo` : bâtiments.
- `RoomInfo` : inventaire maître des chambres.
- `GuestInfo` : clients et séjours, pas des chambres.
- `CardInfo` : cartes émises.
- `RecordOpen` : journal des ouvertures.
- `OperatorInfo`, `CaoZuoInfo`, `RegInfo`, `LogInfo`, `Dai` : opérateurs, opérations, licence et données auxiliaires.

## 3. Contrôler bâtiments et chambres

- Les bâtiments sont identifiés par `BldNo`. Le numéro 0 est une valeur possible, pas une absence.
- Les chambres sont importées exclusivement depuis `RoomInfo`.
- Le lien bâtiment/chambre utilise `RoomInfo.BldNo`.
- L'étage vient de `RoomInfo.FlrNo`, y compris la valeur 0.
- Le numéro affiché est lu depuis `RoomNo`, avec repli sur `RomID2` ou `RomID` si la colonne prioritaire est vide.
- Une référence comme `2-1-12064` signifie bâtiment 2, étage 1, chambre 12064.

Comparer le nombre de lignes RoomInfo pour chaque bâtiment au nombre de chambres affichées dans Appointment PMS. Les chambres sans numéro exploitable sont exclues et signalées.

## 4. Contrôler les séjours

`GuestInfo.BldRoomNo` doit être rapproché d'une chambre existante, avec bâtiment et étage si présents. Une ligne GuestInfo sans correspondance non ambiguë n'ajoute aucune chambre. Les dates absentes ou invalides sont signalées au lieu d'être remplacées par la date du jour.

## 5. Confirmer l'import

L'import remplace le précédent instantané CardLock (bâtiments/chambres importés et séjours issus de CardLock) mais conserve les ressources créées manuellement et les autres réservations. Vérifier les avertissements avant de confirmer. Les prix ou statuts absents dans MDB restent non renseignés : Appointment PMS ne doit pas les inventer.

## 6. En cas de bâtiment ou de chambres manquants

- Vérifier le nombre de lignes `RoomInfo` par `BldNo` dans l'inventaire.
- Si le second bâtiment apparaît dans `BuildingInfo` mais pas dans `RoomInfo`, CardLock ne contient pas de lignes de chambres importables pour lui.
- S'il apparaît dans `RoomInfo`, mais pas dans le planning, conserver le fichier et les compteurs de l'inventaire : ce sont les éléments nécessaires au diagnostic.
- Si les séjours mentionnent un bâtiment mais qu'aucune chambre correspondante n'existe dans `RoomInfo`, le PMS signale un séjour orphelin ; il ne crée pas de chambre fictive.

## 7. Références

- [Analyse du schéma et des relations CardLock](./CARDLOCK_DATABASE_ANALYSIS.md)
- [Guide proUSB et programmation des serrures](../README_SYSTEM_CARD.md)
- [Spécification technique proUSB](./PROUSB_SPECIFICATION.md)
- [Procédure de sauvegarde/restauration CardLock](../proUSB data recover process.pdf)

