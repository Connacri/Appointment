# Politique d'archivage et de rétention — Appointment PMS

Dernière revue : 27-11-2026. Ce document décrit le comportement actuellement présent et la cible recommandée. Il ne remplace pas une politique légale de conservation des documents comptables ou des données personnelles.

## 1. Décision d'architecture

**Ne pas choisir entre archive locale et Supabase : utiliser les deux, avec des rôles distincts.**

- **IndexedDB local** : archive de proximité, hors ligne, chargée uniquement à la demande. Elle évite de gonfler les projections opérationnelles.
- **Supabase** : réplica distant et sauvegarde de récupération. Les anciennes réservations restent dans la table distante ; les requêtes historiques les chargent par fenêtre de dates sous RLS.
- **Interface opérationnelle** : ne charge que les réservations actives et les séjours clôturés dans la fenêtre opérationnelle de six mois.
- **Analytics** : charge les périodes historiques ciblées, pas l'ensemble de l'historique au démarrage.

Supabase ne doit pas devenir l'unique source d'accès aux archives : une archive uniquement distante dégraderait le mode offline-first et ferait dépendre les comparaisons d'une connexion réseau. À l'inverse, une archive uniquement locale ne protège pas contre la perte du terminal.

## 2. Comportement réellement implémenté

Le mécanisme actuel porte uniquement sur les **réservations** :

1. Le cutoff opérationnel est calculé sur une fenêtre glissante de six mois.
2. Seules les réservations avec statut terminal `checked_out` ou `cancelled`, dont la date de fin est antérieure au cutoff, sont candidates.
3. Les réservations actives, futures, non clôturées ou sans statut terminal restent opérationnelles.
4. Une réservation ayant encore une mutation Outbox pending/failed ou un événement P2P en file est ignorée par l'archivage.
5. Le déplacement local écrit l'enregistrement d'archive et le manifeste, puis supprime la projection opérationnelle dans une même transaction IndexedDB.
6. Les lots sont bornés (250 enregistrements par appel). L'hydratation du démarrage ne charge pas les archives.
7. L'index `workspaceStartDate` permet les lectures historiques paginées par workspace et période.
8. Les analytics peuvent charger les archives locales pour la fenêtre historique de comparaison 365 jours. Les réservations anciennes restent également interrogeables dans Supabase via le repository historique.

Le processus n'efface pas les réservations distantes de Supabase et ne constitue pas une purge légale. Le manifeste local est une métadonnée de navigation, pas une preuve de sauvegarde distante.

## 3. Règles de sécurité et d'intégrité

- Ne jamais archiver une réservation simplement parce que sa date est ancienne : vérifier son statut terminal et l'absence de mutation non acquittée.
- Ne jamais supprimer la ligne Supabase lors du compactage local.
- Ne jamais inclure les archives dans le calcul des disponibilités, des conflits de chambre ou des opérations quotidiennes.
- Les archives sont en lecture seule pour les comparaisons. Une correction métier doit passer par une commande explicite de réouverture/restauration, avec audit et validation des conflits.
- Ne pas appliquer de Last Write Wins aux réservations, paiements ou documents comptables.
- Garder les données liées et les identifiants d'origine afin de préserver les références vers chambre, établissement et client.
- Prévoir des contrôles de nombre de lignes, d'identifiants uniques et de checksum avant toute migration/restauration de masse.

## 4. Usage historique recommandé

Pour les comparaisons et les prédictions :

- charger uniquement la période demandée, avec pagination et filtre par workspace/établissement ;
- comparer les mêmes fenêtres calendaires (mêmes jours de semaine et même saison) plutôt que sommer tout l'historique ;
- distinguer les données observées des prévisions et exposer la taille de l'échantillon ;
- exclure les réservations annulées des nuitées et revenus réalisés, tout en les gardant disponibles pour analyser le taux d'annulation ;
- ne jamais mélanger les établissements, devises, secteurs ou sources de données sans normalisation explicite.

La lecture historique doit être déclenchée par Analytics ou un rapport. Elle ne doit pas être branchée sur le chargement initial du Gantt.

## 5. Ce qui n'est pas encore archivé

Le mécanisme existant ne couvre pas les factures/lignes de facture, paiements, mouvements de stock, commandes fournisseurs, tâches, personnel, journaux d'audit, événements CardLock ni journaux de serrure. Ces domaines ne doivent pas être déplacés ou supprimés par une règle générique de six mois.

La future politique devra être définie par domaine :

| Domaine | Règle cible |
|---|---|
| Réservations clôturées | Archive opérationnelle après 6 mois ; conservation historique distante et locale |
| Factures, devis, paiements | Rétention comptable dédiée ; jamais de purge automatique à 6 mois |
| Mouvements de stock | Ledger immuable ; archive en lecture seule après clôture et réconciliation |
| Commandes fournisseurs | Archiver après clôture, réception et rapprochement de toutes les lignes |
| Tâches / housekeeping | Archive après clôture ; durée configurable selon audit opérationnel |
| RH / clients | Politique de minimisation et de conservation validée juridiquement |
| CardLock / accès | Rétention de sécurité séparée, avec droits d'accès et règles d'audit dédiés |

## 6. Étapes avant une généralisation

1. Terminer le repository durable des factures et la transaction serveur atomique en-tête + lignes + paiements.
2. Définir les durées de conservation légales et métier par type de donnée.
3. Ajouter des manifests et index propres à chaque domaine, sans réutiliser un schéma générique qui perdrait les relations.
4. Ajouter une commande de restauration contrôlée et idempotente.
5. Vérifier la sauvegarde distante, la restauration et l'intégrité des relations sur un environnement de test.
6. Ajouter des tests de gros volumes (plusieurs années), de pagination, de reprise après crash et de workspace isolation.

**État actuel : archivage semestriel des réservations implémenté ; archivage global multi-domaines non implémenté.**
