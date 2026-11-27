# Stockage des données et différences entre plateformes

## Sources de données distinctes

Appointment PMS ne partage pas physiquement le même fichier de base entre navigateur et exécutable Windows :

| Cible | Stockage local | Portée |
|---|---|---|
| Web / PWA / Android WebView | IndexedDB, base `OmniBook_ObjectBox_Store` | Isolé par origine et profil navigateur |
| Exécutable Windows Native | SQLite `%LOCALAPPDATA%\Connacri\Appointment\appointment.sqlite3` | Isolé par compte Windows |
| Cloud | Supabase PostgreSQL | Données du workspace authentifié, protégées par RLS |

Un navigateur, un autre navigateur, un autre profil, une autre origine ou un autre appareil possède donc un stockage local différent. Installer l'EXE Windows ne copie pas la base IndexedDB du navigateur. La synchronisation Supabase est le mécanisme de réplication entre ces stockages ; ce n'est pas un accès direct au même fichier.

## État constaté du projet Supabase Appointment

Contrôle en lecture seule effectué le 27 novembre 2026 :

- 1 workspace personnel et 1 membre propriétaire ;
- 2 établissements ;
- 2 groupes de ressources / bâtiments ;
- 34 ressources / chambres ;
- 27 lignes de réservations au total, dont 21 non supprimées ;
- aucune facture, tâche ou ligne de stock dans les tables correspondantes à cette date.

Les données cloud ne sont donc pas vides. Le fait qu'une interface affiche zéro donnée doit être diagnostiqué au niveau de la session Supabase, du workspace personnel sélectionné, des règles RLS, du résultat du pull et de l'hydratation locale. Ne jamais « réparer » ce symptôme en supprimant ou recréant les tables.

## Limite de l'exécutable Windows Native actuel

L'EXE Rust/Win32 est une application native distincte, pas un emballage de l'interface React Web. Son flux Supabase natif actuel synchronise les réservations ; il ne constitue pas encore une réplication complète de tous les domaines PMS (bâtiments, chambres, factures, stock, tâches, RH, CardLock). Une base SQLite native nouvellement créée peut donc être vide pour les domaines qui ne sont pas encore raccordés.

Ne pas présenter l'EXE Native comme équivalent fonctionnel complet du Web tant que la parité des domaines, des commandes métier, de l'authentification, des migrations et des tests de convergence n'est pas atteinte.

## Diagnostic lorsqu'une interface paraît vide

1. Vérifier que l'utilisateur est connecté avec le même compte Supabase que celui qui possède les données.
2. Vérifier que le workspace personnel sélectionné correspond à ce compte.
3. Vérifier l'état du pull Supabase dans le terminal de synchronisation et conserver le message d'erreur exact.
4. Vérifier que l'établissement sélectionné correspond aux bâtiments et ressources attendus.
5. Vérifier le stockage local de la plateforme concernée. Ne pas confondre IndexedDB du navigateur avec SQLite de l'EXE.
6. Ne pas lancer de backfill ou de réinitialisation sur un écran vide avant d'avoir vérifié le snapshot cloud : cela pourrait créer un second établissement ou propager une projection vide.

## Politique d'archivage

Les réservations clôturées depuis plus de six mois sont compactées dans une archive IndexedDB locale, partitionnée par semestre et chargée uniquement pour les comparaisons historiques. Les lignes Supabase ne sont pas supprimées. Les factures, paiements, mouvements de stock, audits CardLock et données RH ne doivent pas être purgés selon cette règle de six mois : ils nécessitent des politiques de conservation spécifiques.

## Recommandation d'archivage cible

**Supabase doit rester l'archive canonique ; l'archive locale doit être un cache reconstructible.** Une archive conservée uniquement dans IndexedDB est perdue avec le profil navigateur, le nettoyage du stockage ou la panne du terminal. Elle ne peut pas garantir les comparaisons entre appareils.

Architecture recommandée :

1. Garder dans la projection opérationnelle les réservations récentes et toutes les réservations non terminales. Le seuil glissant de six mois est une règle de chargement, pas une suppression de l'historique cloud.
2. Conserver l'historique complet dans Supabase. Tant qu'une table d'archive serveur avec export, checksum et restauration vérifiée n'existe pas, ne déplacer ni supprimer les lignes distantes.
3. Utiliser IndexedDB comme cache local par semestre. Le cache est chargé à la demande pour les comparaisons et peut être reconstruit depuis Supabase. Ne jamais le charger intégralement au démarrage.
4. À l'échelle supérieure, créer une archive serveur immuable partitionnée par mois ou semestre, avec transfert atomique depuis les tables opérationnelles, index workspace/établissement/date, checksum, manifeste et procédure de restauration testée. Le transfert doit préserver les références de paiements, factures, clients et journaux.
5. Alimenter les prédictions avec des agrégats versionnés (occupation, ADR, RevPAR, durée de séjour, annulations, jour de semaine, saison et événement), pas avec le chargement de toutes les réservations brutes dans le navigateur.

Ne pas introduire une partition PostgreSQL uniquement sur la base d'une projection de croissance. Mesurer le volume, les temps de requête et les coûts d'indexation. Les index temporels et la pagination bornée suffisent généralement avant d'atteindre des volumes réellement élevés.

**État actuel :** l'archive semestrielle locale existe, Supabase conserve encore l'historique complet, et les lectures historiques distantes sont paginées. Le cache local n'est donc pas la seule copie, mais la procédure d'archive serveur atomique et sa restauration restent à construire.
