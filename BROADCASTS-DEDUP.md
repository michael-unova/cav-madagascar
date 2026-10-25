# Annonces : pas de doublon et tri des destinataires

## Principe
On peut toujours envoyer une annonce à tous les étudiants. Le système sait qui l'a déjà reçue et l'ignore.

## Définition de "même message"
- Type "Bienvenue" (type à envoi unique) : un étudiant ne reçoit qu'une seule annonce de ce type, même si le texte a été modifié.
- Autres types : même titre et même message (comparaison insensible à la casse et aux espaces).

## Données
- `broadcastDeliveries/{dedupKey}__{userId}` : journal serveur uniquement (règles Firestore : accès refusé au client).
- `broadcastMessages` : nouveaux champs `dedupKey`, `skipAlreadyReceived`, `skippedCount`.
- Les annonces envoyées avant cette version ne sont pas dans le journal : un étudiant qui a déjà reçu un ancien message peut le recevoir une fois de plus.

## Interface admin
- Liste des destinataires avec badge "Nouveau" ou "Déjà reçu".
- Case "Ne pas renvoyer aux étudiants qui l'ont déjà reçue" (cochée par défaut, appliquée côté serveur, y compris pour les envois programmés).
- Tri : inscription (plus récents / plus anciens), ordre alphabétique, par concours.
- Historique : badge de type, filtre par type, "Mes envois uniquement", nombre d'ignorés.

## Déploiement
```
cd functions && npm run build && cd ..
firebase deploy --only functions
```
Nouvelle fonction : `adminGetBroadcastRecipientStatus`.
