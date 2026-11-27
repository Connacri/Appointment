# Guide utilisateur complet — Appointment PMS

**Public visé :** direction, réception, gouvernance, équipes d'étage, maintenance, économat et utilisateurs opérationnels.  
**Langues de l'interface :** français, anglais et arabe.  
**Révision :** 27 novembre 2026.

Ce guide explique l'installation, la configuration d'un établissement et l'utilisation quotidienne des principaux modules. Il distingue les fonctions présentes dans l'application des capacités qui ne sont pas encore suffisamment intégrées pour une exploitation multi-postes en production.

---

## 1. Présentation et notions de base

Appointment PMS est un logiciel de gestion hôtelière qui regroupe le planning, les réservations, les séjours, le housekeeping, les tâches, les stocks, les fournisseurs, les commandes, la facturation, les rapports et les fonctions proUSB.

Trois notions sont importantes :

- **Établissement** : l'hôtel, la résidence ou le resort que vous gérez.
- **Domaine** : le contexte Hôtel ou Resort. Les libellés et ressources affichés peuvent varier selon le domaine.
- **Terminal** : l'ordinateur ou le téléphone sur lequel l'application est ouverte. Chaque terminal possède son propre stockage local et son identifiant technique.

Une donnée visible sur un terminal n'est pas nécessairement disponible sur les autres appareils. Vérifiez toujours l'état de synchronisation affiché.

## 2. Installer Appointment PMS

### 2.1 Web — installation la plus simple

1. Ouvrez Chrome ou Edge à jour.
2. Accédez à https://connacri.github.io/Appointment/.
3. Attendez le chargement complet.
4. Sélectionnez la langue si nécessaire.
5. Effectuez la configuration initiale de l'établissement.
6. Ajoutez la page aux favoris.

Le site est servi en HTTPS. Les fonctions qui accèdent à un périphérique USB/WebHID dépendent du navigateur, du système et du matériel compatibles.

Attention : les données locales du navigateur peuvent être perdues si vous effacez les données du site, réinitialisez le profil, changez de navigateur ou supprimez l'application Web. Une ouverture depuis un autre navigateur ne récupère pas automatiquement les données du premier.

### 2.2 Android

1. Ouvrez https://github.com/Connacri/Appointment/releases.
2. Choisissez la dernière version publiée.
3. Téléchargez l'APK officiel, nommé Appointment-PMS-vX.Y.Z.apk dans une release versionnée.
4. Si Android le demande, autorisez temporairement l'installation depuis cette source.
5. Installez puis ouvrez Appointment PMS.
6. Vérifiez la version dans l'écran À propos.

Le fichier AAB, nommé Appointment-PMS-vX.Y.Z.aab, est destiné à la distribution Google Play ; ce n'est pas le fichier à installer directement. N'installez pas un APK provenant d'un site tiers.

### 2.3 Windows

1. Ouvrez la page officielle des Releases : https://github.com/Connacri/Appointment/releases.
2. Téléchargez l'installateur Windows publié, nommé Appointment-PMS-Setup-vX.Y.Z.exe.
3. Vous pouvez également télécharger Appointment-PMS-Windows-Native-vX.Y.Z.zip, qui contient l'installateur et l'exécutable natif appointment-pms-native.exe.
4. Vérifiez que le fichier provient du dépôt officiel.
5. Lancez l'installateur et suivez les instructions. L'exécutable natif peut aussi être lancé directement depuis l'archive si vous maîtrisez son emplacement.
6. Ouvrez l'application depuis le raccourci créé.
7. Vérifiez la version dans À propos.

Ne contournez pas un avertissement Windows si vous ne pouvez pas confirmer l'origine du fichier.

### 2.4 Quelle version choisir ?

| Besoin | Version |
|---|---|
| Découverte et consultation | Web |
| Utilisation sur téléphone Android | APK publié |
| Poste fixe de réception | Installateur Windows publié |
| Encodeur proUSB WebHID | Navigateur de bureau compatible et poste USB compatible |

Les fonctions matérielles ne sont pas nécessairement disponibles sur toutes les plateformes.

## 3. Configurer l'établissement

La fenêtre de configuration s'ouvre au premier lancement et peut être rouverte depuis les commandes de configuration.

### 3.1 Identité et coordonnées

Renseignez le nom commercial exact, le type d'établissement, le classement éventuel, l'adresse, la ville, le pays, le téléphone, l'e-mail professionnel et le site Web. Ajoutez un logo officiel si vous en possédez un.

Évitez les coordonnées personnelles si les documents sont destinés aux clients.

### 3.2 Informations fiscales

Saisissez uniquement les informations vérifiées et applicables : NIF, registre de commerce, références fiscales et coordonnées bancaires. Ces champs personnalisent les documents ; ils ne constituent pas une validation fiscale ou comptable automatique. Faites vérifier les mentions obligatoires par votre comptable.

### 3.3 Horaires et devise

Définissez les heures réelles d'arrivée et de départ de l'établissement. Choisissez la devise de travail. Ne changez pas de devise pendant l'exploitation sans procédure comptable : les montants existants ne sont pas nécessairement convertis automatiquement.

### 3.4 Bâtiments, étages, ailes et chambres

La structure doit représenter les unités physiques réelles.

Pour créer la structure manuellement :
1. Ajoutez un bâtiment avec son nom et son numéro interne.
2. Définissez l'étage.
3. Renseignez l'aile si votre établissement en utilise.
4. Définissez éventuellement un préfixe de chambre.
5. Indiquez le premier numéro et le nombre d'unités à créer.
6. Vérifiez les unités générées avant de continuer.

Choisissez un regroupement par étage, par aile ou par étage et aile. Adoptez une convention stable, par exemple Bâtiment A / Étage 1 / Aile Nord.

Ne créez pas de chambres fictives pour combler une numérotation. Une chambre inexistante ne doit pas être ajoutée parce que son numéro semble manquer.

### 3.5 Import proUSB existant

Si l'hôtel utilise proUSB, vous pouvez analyser et importer CardLock.mdb. Suivez le guide spécialisé : [Importer CardLock.mdb](./PROUSB_MDB_IMPORT_GUIDE.md).

Avant confirmation, contrôlez le nombre de bâtiments, les chambres de chaque bâtiment, les séjours associés et les lignes ignorées. Conservez une sauvegarde du fichier source. Les séjours ne doivent jamais servir à inventer des chambres absentes de l'inventaire maître.

## 4. Mono-poste et multi-postes : décision d'architecture

Cette décision doit être prise avant l'exploitation. Elle ne dépend pas du nombre de fenêtres ouvertes, du Wi-Fi ou de la présence momentanée d'autres appareils.

### 4.1 Mono-poste — SINGLE_DEVICE

Ce mode signifie qu'un seul terminal est autorisé à effectuer les opérations de l'établissement. Exemple : un ordinateur de réception utilisé par les opérateurs autorisés.

Principes :
- un terminal est explicitement enregistré ;
- les données sont conservées localement ;
- les opérations locales peuvent continuer en cas de coupure Internet ou cloud si l'enregistrement local est valide ;
- les données restent sur ce terminal tant qu'une sauvegarde ou une synchronisation confirmée ne les a pas transférées ;
- ouvrir l'application sur un second appareil ne rend pas ce second appareil autorisé.

**Configuration initiale actuellement implémentée :** elle exige une session Supabase authentifiée, un workspace vérifié dont l'utilisateur est propriétaire et un établissement réel sélectionné. L'action explicite d'initialisation crée un registre local SINGLE_DEVICE pour cet établissement. Si l'action n'est pas proposée ou si un registre existe déjà, ne modifiez pas la base locale manuellement : contactez l'administrateur technique.

Limite : le registre livré est une persistance locale, pas encore un service central de révocation ni une identité matérielle inviolable. Protégez le poste, le compte système et les sauvegardes.

### 4.2 Multi-postes — MULTI_DEVICE

Ce mode vise plusieurs terminaux autorisés : réception, direction, gouvernante, économat, etc.

Pour être exploitable en production, il faut une identité et un appairage fiables de chaque terminal, un registre partagé, une authentification mutuelle, une coordination des opérations critiques, une réplication des événements et une réconciliation des conflits.

**État actuel : le multi-postes n'est pas prêt pour les transactions réelles en production.** L'application bloque les écritures de réservation lorsqu'aucune autorité de coordination n'est disponible, mais le verrouillage global de tous les modules n'est pas terminé. Les tâches, stocks, fournisseurs, commandes, personnel, housekeeping, factures et certaines actions de configuration ne sont pas tous protégés par un verrou multi-postes central.

En conséquence :
- n'utilisez pas plusieurs terminaux indépendants pour saisir simultanément des opérations réelles ;
- un appareil visible sur le réseau n'est pas automatiquement autorisé ;
- un état réseau « en ligne » ne prouve pas que les données sont synchronisées ;
- ne partagez pas un profil de navigateur ou une copie de base locale entre plusieurs postes ;
- limitez le multi-postes aux essais contrôlés jusqu'à livraison du registre partagé, du transport authentifié, de la coordination transactionnelle et du verrouillage global.

### 4.3 Coupure réseau et reconnexion

| Situation | Comportement de sécurité | Consigne |
|---|---|---|
| Mono-poste enregistré | Les opérations locales peuvent continuer | Restez sur le même terminal et sauvegardez |
| Multi-postes sans autorité de coordination | Lecture seule pour les opérations critiques | N'essayez pas de contourner le blocage |
| Reconnexion | Contrôle et réconciliation avant reprise | Attendez la fin du traitement, ne recréez pas les opérations |
| Registre absent ou terminal non autorisé | Écriture critique bloquée | Contactez l'administrateur |

Le Wi-Fi, le VPN ou Internet ne suffisent pas à garantir que les autres terminaux possèdent les mêmes données.

## 5. Comprendre l'interface

La navigation latérale n'affiche que les modules autorisés par le rôle et le domaine actifs.

- **Barre supérieure** : établissement, profil opérateur, notifications et commandes générales.
- **Menu latéral** : accès aux modules.
- **Zone de travail** : planning ou écran du module sélectionné.
- **Fenêtres de dialogue** : création, modification, confirmation et détails.
- **Bannières d'état** : avertissements de connectivité, synchronisation ou autorisation.

L'interface existe en français, anglais et arabe. L'arabe utilise une présentation de droite à gauche. Le thème clair ou sombre peut être sélectionné.

Vérifiez toujours l'établissement, le domaine Hôtel/Resort et le profil opérateur avant une saisie.

## 6. Planning Gantt

Le planning est l'écran principal de visualisation des séjours.

- Les lignes représentent les chambres ou unités.
- L'axe horizontal représente les dates.
- Les blocs représentent les réservations.
- Les statuts et couleurs aident à distinguer les situations.

Procédure :
1. Ouvrez Planning Gantt.
2. Sélectionnez le secteur et le bâtiment.
3. Naviguez vers la période voulue.
4. Utilisez Aujourd'hui pour revenir à la date courante.
5. Ajustez le zoom pour afficher plus ou moins de jours.
6. Sélectionnez une réservation pour ouvrir sa fiche.
7. Contrôlez aussi l'état housekeeping de la chambre.

Une cellule vide ne garantit pas à elle seule qu'une chambre est réservable. Vérifiez toute la période, les chevauchements, l'état de la ressource et les éventuels travaux. Une chambre hors service ne doit pas être attribuée.

Sur mobile, faites défiler le planning horizontalement et verticalement.

## 7. Réservations et séjours

### 7.1 Créer une réservation

1. Depuis le planning, sélectionnez un créneau libre ou lancez une nouvelle réservation.
2. Saisissez le nom du client.
3. Ajoutez les coordonnées utiles. Le téléphone peut être vide ; s'il est fourni, il doit être valide.
4. Sélectionnez le bâtiment, le secteur et la chambre.
5. Saisissez les dates d'arrivée et de départ. Le départ doit être postérieur à l'arrivée.
6. Renseignez les adultes et enfants.
7. Complétez les informations de séjour proposées : formule, tarif, extras, notes et informations administratives nécessaires.
8. Vérifiez le tarif et la devise.
9. Enregistrez.
10. Vérifiez la réservation sur le planning, aux bonnes dates et dans la bonne chambre.

Ne créez pas un second dossier pour corriger une première saisie : ouvrez le dossier existant et modifiez-le lorsque c'est possible.

### 7.2 Modifier ou déplacer

Avant modification, vérifiez le dossier, les dates, le client, la chambre cible, le tarif et les paiements. Après enregistrement, contrôlez le planning.

Un échange de chambres ne doit être accepté que si les deux affectations finales sont valides. Refusez un échange si plusieurs réservations occupent la chambre cible, si les secteurs/établissements ne correspondent pas ou si une troisième réservation serait affectée.

Une validation locale ne garantit pas une validation sur un autre terminal tant que la coordination multi-postes n'est pas livrée.

### 7.3 Arrivée — check-in

1. Recherchez le dossier.
2. Confirmez l'identité selon les règles de l'établissement.
3. Vérifiez les dates, la chambre et les occupants.
4. Contrôlez les acomptes et le solde.
5. Utilisez l'action d'arrivée disponible.
6. Informez l'équipe d'étage des demandes particulières.
7. Si proUSB est configuré, encodez la carte après confirmation de la chambre et de la période.

### 7.4 Pendant le séjour

Consultez le dossier pour les demandes spéciales, extras, paiements et changements. Enregistrez les demandes opérationnelles sous forme de tâches afin qu'elles puissent être attribuées et suivies.

### 7.5 Départ — check-out

1. Ouvrez le dossier.
2. Vérifiez la date de départ et les extras à facturer.
3. Contrôlez les paiements et le solde.
4. Préparez le document de facturation.
5. Enregistrez le départ.
6. Envoyez la chambre dans le circuit housekeeping.
7. Signalez les objets oubliés et les anomalies.

Un départ enregistré ne signifie pas que la chambre est immédiatement prête.

### 7.6 Annulation

Avant annulation, vérifiez le dossier, les paiements et les règles commerciales. N'utilisez pas l'annulation pour remplacer une simple modification de dates ou de chambre.

## 8. Housekeeping et état des chambres

Le module suit l'état opérationnel des chambres ou unités.

| État | Signification | Consigne |
|---|---|---|
| Propre | Chambre contrôlée et prête selon les règles internes | Peut être proposée si les autres conditions sont satisfaites |
| En cours | Nettoyage ou remise en état en cours | Ne pas attribuer avant validation |
| À nettoyer | Intervention nécessaire | Créer ou traiter la tâche |
| Hors service | Indisponibilité technique ou opérationnelle | Ne pas réserver |

Circuit conseillé :
1. Ouvrez Housekeeping.
2. Repérez la chambre et les tâches ouvertes.
3. Passez à En cours lorsque l'intervention commence.
4. Effectuez le nettoyage, la vérification et le réassort.
5. Contrôlez les équipements et consommables.
6. Passez à Propre uniquement après contrôle.
7. Si un défaut existe, créez une tâche de maintenance et utilisez Hors service si la chambre ne peut pas être occupée.

La couleur de l'état ne remplace jamais le contrôle physique.

## 9. Tâches et interventions

Le module Tâches PMS organise les demandes de ménage, linge, minibar, accueil, livraison et maintenance.

### Créer une tâche

1. Ouvrez Tâches PMS.
2. Lancez la création d'une demande.
3. Indiquez la chambre ou l'emplacement.
4. Choisissez la catégorie : ménage, linge/literie, minibar/accueil, livraison client ou maintenance.
5. Décrivez précisément le travail.
6. Affectez un employé si disponible.
7. Choisissez une priorité normale ou urgente.
8. Ajoutez les consignes, le créneau et les précautions.
9. Créez la demande.

Une consigne précise est préférable à un texte vague. Exemple : « Vérifier la fuite sous le lavabo, chambre 204 ».

### Prendre en charge et terminer

- **À faire / Ouverte** : tâche créée, pas encore démarrée.
- **En cours** : intervention commencée.
- **Achevée** : travail terminé et validé.
- **Annulée** : demande devenue inutile ou annulée par un responsable.

Sélectionnez la tâche, vérifiez la chambre et la consigne, puis démarrez. Cochez les étapes de la checklist uniquement lorsqu'elles sont réalisées.

Avant validation :
1. Vérifiez le résultat physique.
2. Identifiez l'opérateur ayant réalisé le travail.
3. Cochez les étapes terminées.
4. Validez le réassort si nécessaire.
5. Contrôlez la déduction de stock si la tâche consomme des articles.
6. Marquez la tâche achevée après contrôle.

Les notifications signalent du travail à traiter ; elles ne prouvent pas que l'intervention est terminée.

## 10. Stock, économat et équipements

Le module Stock gère les articles consommés ou utilisés : linge, produits de bain, minibar, entretien, accueil et catégories personnalisées. Il comprend quatre espaces : **Inventaire**, **Mouvements**, **Commandes** et **Fournisseurs**.

### 10.1 Initialiser le catalogue

Si le stock est vide, vous pouvez charger les 25 articles standard proposés. Ce catalogue est un point de départ, pas un inventaire réel. Corrigez les désignations, unités, quantités, coûts et seuils avant toute utilisation opérationnelle.

### 10.2 Créer un article

Pour chaque article, renseignez :
- désignation précise, par exemple « Savon d'accueil 25 g » ;
- catégorie : linge, produits de bain, minibar, entretien, accueil ou catégorie interne ;
- unité : pièce, flacon, bouteille, rouleau, litre, kilogramme, etc. ;
- quantité physique initiale vérifiée ;
- seuil d'alerte ;
- prix unitaire de référence ;
- fournisseur préféré, s'il est connu.

Ne mélangez pas les unités pour un même article. Douze bouteilles et douze cartons ne représentent pas la même quantité.

### 10.3 Lire les indicateurs

- **Stock actuel** : quantité connue de l'application.
- **Seuil bas** : quantité inférieure ou égale au seuil.
- **Rupture** : quantité égale à zéro.
- **Valeur économat** : quantité multipliée par le coût unitaire pour chaque article, puis totalisée.

Cette valeur est une estimation selon les coûts saisis, pas automatiquement une valorisation comptable certifiée.

### 10.4 Enregistrer une entrée

À utiliser uniquement lorsque les articles sont physiquement reçus :
1. Trouvez l'article.
2. Choisissez Entrée.
3. Saisissez la quantité reçue.
4. Indiquez le motif et, si possible, la référence du justificatif.
5. Vérifiez puis enregistrez.
6. Contrôlez la nouvelle quantité et le mouvement.

N'enregistrez pas une entrée au moment où la commande est envoyée.

### 10.5 Enregistrer une sortie

À utiliser lorsqu'un article quitte réellement le stock :
1. Choisissez Sortie.
2. Saisissez la quantité.
3. Indiquez le motif.
4. Renseignez la chambre ou destination si elle est connue.
5. Enregistrez.
6. Vérifiez la quantité restante.

N'utilisez pas une sortie pour corriger un écart de comptage : utilisez l'inventaire physique.

### 10.6 Faire un inventaire physique

1. Comptez les articles présents.
2. Ouvrez l'action Inventaire de l'article.
3. Saisissez la quantité réellement comptée, pas la différence.
4. Enregistrez.
5. Comparez avec l'historique.
6. Documentez tout écart important.

Exemple : le stock affiche 30 unités, mais le comptage en trouve 24. Saisissez **24** comme quantité inventoriée, et non -6.

### 10.7 Consulter et exporter les mouvements

L'historique contient la date/heure, l'article, la variation, le motif, la chambre ou destination et l'opérateur. L'export CSV permet l'analyse dans un tableur. Conservez les exports avec les bons de livraison et feuilles de comptage.

### 10.8 Configurer les fournisseurs

Dans Fournisseurs, renseignez le nom, la catégorie fournie, le contact commercial, le téléphone/WhatsApp, l'e-mail, le canal préféré (WhatsApp, e-mail ou SMS) et les conditions de livraison. Associez ensuite les articles à leur fournisseur préféré. Vérifiez les coordonnées avant tout envoi.

### 10.9 Préparer un bon de commande

1. Ouvrez Commandes.
2. Chargez les articles à seuil bas ou préparez une commande.
3. Vérifiez les lignes et quantités proposées.
4. Ajoutez ou retirez des articles selon le besoin réel.
5. Sélectionnez un fournisseur ou saisissez un fournisseur ponctuel.
6. Vérifiez téléphone et e-mail.
7. Ajoutez les instructions de livraison.
8. Contrôlez le total estimé.
9. Relisez le message destiné au fournisseur.
10. Enregistrez un brouillon ou confirmez la commande.

Les quantités recommandées sont une aide. Le responsable économat doit les vérifier avant envoi.

### 10.10 Envoyer et réceptionner

Les statuts sont :
- **Brouillon** : préparation non confirmée ;
- **Confirmée** : commande validée en interne ;
- **Envoyée** : bon ou message transmis ;
- **Réceptionnée** : réception enregistrée dans le stock.

L'ouverture de WhatsApp ou d'un logiciel de messagerie ne prouve pas que le fournisseur a reçu ou accepté la commande.

À la livraison :
1. Comparez la livraison au bon.
2. Vérifiez les références, quantités et dommages.
3. Documentez les écarts.
4. Utilisez Réceptionner en stock uniquement après contrôle physique.
5. Vérifiez les quantités finales.

Ne marquez pas une commande comme réceptionnée si elle n'est pas livrée ou si la réception n'est pas vérifiée. En cas de livraison partielle, documentez le reliquat selon la procédure de l'établissement.

### 10.11 Réassort chambre et déduction

Les tâches et le housekeeping peuvent proposer une action de réalimentation. Vérifiez la chambre, les articles et les quantités réellement déposées, puis contrôlez les déductions. En cas de double saisie, ne créez pas un mouvement inverse sans analyser l'historique avec le responsable stock.

## 11. Devis, factures et paiements

Le module Facturation & Devis permet de préparer des documents commerciaux et de suivre les montants enregistrés.

### Créer un document

1. Ouvrez Facturation & Devis.
2. Choisissez le type de document proposé.
3. Renseignez le client ou la société.
4. Ajoutez les lignes, quantités, prix et remises éventuelles.
5. Vérifiez les totaux et la devise.
6. Contrôlez les coordonnées et informations fiscales de l'établissement.
7. Prévisualisez le document.
8. Téléchargez ou imprimez le PDF.

Un devis n'est pas une facture. Vérifiez le type avant l'envoi.

### Enregistrer un paiement

Contrôlez le dossier, le montant, la devise, le moyen de paiement, la date et la référence justificative. L'indicateur « encaissé » reflète les paiements enregistrés dans l'application ; il ne confirme pas automatiquement un règlement bancaire externe. Rapprochez les montants avec la caisse, le terminal et les relevés.

Le module n'est pas un logiciel de comptabilité générale. Faites valider les numérotations, mentions fiscales et règles de conservation par le responsable comptable.

## 12. Tarifs dynamiques et Channel Manager

### Yield et tarifs

Avant d'appliquer une règle, vérifiez le type de chambre ciblé, les dates, la devise, le prix de base et les éventuelles priorités. Testez sur une ressource et une période représentatives. Une règle mal ciblée peut affecter plusieurs unités.

### Channel Manager / OTA

Le menu donne accès aux outils de configuration et de visualisation des canaux. Sa présence ne signifie pas qu'une connexion Booking.com, Expedia, Airbnb ou autre OTA est active. Avant d'annoncer une synchronisation, vérifiez les identifiants, la connexion fournisseur et les tests d'import/export.

## 13. Spa, services et Resort

Selon le domaine et les permissions, les écrans Spa & Bien-Être et certaines fonctions de services ou de location peuvent être visibles.

Avant de confirmer une prestation, vérifiez la ressource, la durée, l'horaire, le tarif et la disponibilité. Une interface visible ne signifie pas qu'une intégration externe ou un module encore planifié est opérationnel.

## 14. Serrures et cartes proUSB

Le module Serrures proUSB (WebHID) est destiné aux installations compatibles.

1. Vérifiez la compatibilité du poste, du navigateur et du lecteur.
2. Connectez l'encodeur USB.
3. Autorisez explicitement l'accès au périphérique.
4. Vérifiez l'identité du lecteur détecté.
5. Suivez la procédure de configuration de serrure adaptée.
6. Sélectionnez le type de carte et sa portée.
7. Encodez la carte.
8. Relisez la carte lorsque l'application le propose.
9. Consultez le journal d'audit en cas d'anomalie.

Les cartes invité, personnel, système, bâtiment et étage n'ont pas la même portée. Ne distribuez pas une carte système ou bâtiment comme une carte client.

Après changement d'établissement ou réinitialisation de base, ne réutilisez pas les anciennes cartes comme si elles appartenaient au nouvel hôtel. Suivez la procédure de reconfiguration des serrures avec les cartes système prévue par le manuel proUSB et la politique de sécurité.

Références : [analyse CardLock](./CARDLOCK_DATABASE_ANALYSIS.md), [guide d'import](./PROUSB_MDB_IMPORT_GUIDE.md), [guide des cartes](../README_CARDS.md) et [cartes système](../README_SYSTEM_CARD.md).

## 15. Objets oubliés et demandes client

Pour chaque objet retrouvé, décrivez précisément l'objet, indiquez où et quand il a été trouvé, associez une chambre ou un séjour uniquement si le lien est certain et renseignez l'opérateur. Suivez la remise selon la procédure interne. Les objets de valeur doivent respecter les règles de sécurité de l'établissement.

Ne stockez pas de données personnelles inutiles dans les notes.

## 16. Personnel, rôles et permissions

Les rôles intégrés comprennent notamment Administrateur, Gérant, Responsable, Réceptionniste, Veilleur de nuit, Gouvernante, Femme/Valet de chambre, Lingère et profils de maintenance.

Les permissions contrôlent les onglets et actions : réservations, housekeeping, tâches, stock, objets oubliés, cartes et gestion des rôles.

Pour configurer un rôle :
1. Ouvrez Rôles & Permissions avec un compte autorisé.
2. Choisissez ou créez le rôle.
3. Donnez-lui un nom explicite.
4. Sélectionnez les onglets nécessaires.
5. Activez uniquement les permissions métier requises.
6. Enregistrez.
7. Testez avec un compte opérateur représentatif.

Appliquez le principe du moindre privilège. Un agent d'étage n'a pas besoin de modifier les factures ; un réceptionniste n'a pas besoin de gérer les rôles. Ne partagez pas un compte administrateur entre tous les employés.

## 17. Rapports, analytics et journal

Les Rapports d'activité proposent des périodes comme 30 jours, 90 jours et 12 mois et des indicateurs de réservations, arrivées, séjours, départs, clôtures et annulations.

Interprétez chaque indicateur selon sa définition. Un montant contractuel n'est pas nécessairement un montant encaissé.

Les Analytics permettent d'examiner les tendances de réservation ; elles ne remplacent pas un rapprochement comptable.

Le Journal des événements aide à retrouver les opérations, leur catégorie, leur gravité et le contexte disponible. En cas d'incident, notez l'heure, l'opérateur, l'établissement, le dossier et le message exact. Ne supprimez pas les traces avant le diagnostic.

## 18. Sauvegarde, synchronisation et hors ligne

### Données locales

Web/Android utilisent IndexedDB dans les environnements pris en charge. Les données sont liées au profil de navigateur ou à l'installation. Une suppression des données du site, une désinstallation ou la perte du terminal peut rendre inaccessibles les données qui n'ont pas été sauvegardées ailleurs.

Effectuez des sauvegardes régulières et vérifiez qu'elles peuvent être restaurées. Un fichier de sauvegarde créé n'est pas une preuve de restauration réussie.

### Synchronisation cloud

La présence d'un compte, d'une connexion Internet ou d'un indicateur réseau ne signifie pas que tous les domaines sont synchronisés. Les réservations et ressources disposent de chemins plus avancés ; plusieurs domaines, notamment tâches, stock, tarifs, factures et autres entités, ne disposent pas encore tous d'un cycle complet de synchronisation et de résolution.

Ne supprimez pas les données locales après avoir vu un indicateur réseau. Vérifiez les opérations en attente et les erreurs.

### Conduite à tenir hors ligne

- N'effectuez que les opérations autorisées par le mode et l'état affichés.
- En multi-postes, ne faites pas de mutations réelles sans autorité de coordination.
- Ne recréez pas un dossier parce qu'il n'apparaît pas immédiatement après reconnexion.
- Attendez la fin du traitement et contrôlez les conflits éventuels.
- Conservez les justificatifs externes des opérations critiques pendant la période de transition.

## 19. Routine quotidienne conseillée

### Ouverture — réception
1. Vérifiez établissement, domaine, date et opérateur.
2. Consultez les arrivées et départs.
3. Repérez les chambres propres, en cours, à nettoyer et hors service.
4. Contrôlez les dossiers incomplets et paiements attendus.
5. Lisez les notifications et tâches urgentes.

### Début de service — gouvernante
1. Consultez les états de toutes les chambres.
2. Vérifiez les départs et arrivées du jour.
3. Affectez les tâches par chambre et employé.
4. Contrôlez les consommables et seuils bas.
5. Suivez les chambres hors service et la maintenance.

### Fin de service — économat
1. Saisissez les entrées réellement reçues.
2. Saisissez les sorties et dotations réellement effectuées.
3. Contrôlez les mouvements inhabituels.
4. Comptez les articles sensibles.
5. Préparez les commandes à partir des seuils bas.
6. Conservez bons de livraison et justificatifs.

### Clôture — direction
1. Vérifiez les dossiers arrivés, en séjour, partis et annulés.
2. Contrôlez factures, paiements et soldes.
3. Examinez les tâches non terminées.
4. Contrôlez les écarts de stock.
5. Consultez rapports et événements.
6. Vérifiez la sauvegarde.

## 20. Dépannage courant

| Symptôme | Vérification | Action |
|---|---|---|
| Planning vide | Établissement, domaine, bâtiment, période | Corriger les filtres avant de recréer un dossier |
| Chambre absente | Structure ou import source | Vérifier les données réelles, ne pas inventer de chambre |
| Réservation refusée | Dates, chevauchement, état de chambre, autorisation | Corriger la cause affichée |
| Écriture bloquée | Registre, coordination, workspace et établissement | Contacter l'administrateur, ne pas modifier IndexedDB |
| Stock incohérent | Historique et comptage physique | Faire un inventaire vérifié et documenter l'écart |
| Commande non ajoutée au stock | Statut et réception physique | Réceptionner uniquement après contrôle |
| PDF incorrect | Identité, devise, données fiscales | Corriger la configuration puis vérifier l'aperçu |
| Lecteur proUSB absent | USB, navigateur, permission WebHID | Reconnecter et relancer la détection |
| Données absentes sur un autre appareil | État de synchronisation et domaine | Ne pas supposer que la réplication est complète |

Pour le support, transmettez la version, le système, le navigateur, le module, l'établissement, les étapes de reproduction, le message exact et l'heure. Masquez les données personnelles. Ne transmettez jamais mot de passe, clé privée, jeton, numéro de carte bancaire ou base client complète dans un ticket public.

## 21. Limites fonctionnelles à connaître

À la date de révision :
1. Le mode mono-poste dispose d'un enregistrement local explicite du terminal, avec prérequis d'authentification et de propriété du workspace.
2. Le registre est local ; il n'est pas encore une autorité partagée résistante à la falsification.
3. Le mode multi-postes n'est pas prêt pour la production : transport P2P authentifié, registre partagé, coordination transactionnelle et réconciliation complète restent nécessaires.
4. Le verrouillage global de tous les modules en multi-postes n'est pas achevé. N'exploitez pas plusieurs terminaux en écriture sur les mêmes données réelles.
5. Les cycles de synchronisation ne couvrent pas encore uniformément tous les domaines.
6. Les OTA et périphériques externes dépendent de connexions et configurations réelles.
7. La présence d'une interface ne garantit pas qu'une intégration externe est activée.

Pour l'état technique : [contrat de données et règles P2P](./DATA_CONTRACT.md), [plan de synchronisation](./SUPABASE_SYNC_PLAN.md), [architecture](./ARCHITECTURE.md).

## 22. Liens utiles

- [Application Web](https://connacri.github.io/Appointment/)
- [Téléchargements officiels](https://github.com/Connacri/Appointment/releases)
- [Dépôt et signalement de problèmes](https://github.com/Connacri/Appointment)
- [Tutoriel d'import CardLock.mdb](./PROUSB_MDB_IMPORT_GUIDE.md)
- [Analyse CardLock](./CARDLOCK_DATABASE_ANALYSIS.md)
- [Guide des cartes](../README_CARDS.md)
- [Cartes système](../README_SYSTEM_CARD.md)
- [Architecture](./ARCHITECTURE.md)
- [Synchronisation Supabase](./SUPABASE_SYNC_PLAN.md)

**Règle finale :** en cas de doute sur une réservation, un stock, une facture, une serrure ou une synchronisation, arrêtez la mutation, vérifiez les données et demandez une validation au responsable. Ne créez pas une seconde opération pour masquer une première opération dont le résultat est incertain.
