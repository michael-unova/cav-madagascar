# Sujets types par concours

Hiérarchie : **Testez vos connaissances → Épreuve (Maths, FRS…) → Sujet type 1, 2, 3…**

Une épreuve est seulement un groupe nommé (pas d'éditeur). Chaque sujet type est un document
rédigé dans le même éditeur riche que les leçons, avec son titre, sa description, sa limite de
temps et sa note de réussite.

## Côté admin (dans un concours enregistré)
- Section "Sujets types de ce concours" = liste des épreuves. Créer, renommer, publier, dépublier, supprimer une épreuve.
- "Ouvrir" une épreuve : liste de ses sujets types. Créer (titre par défaut "Sujet type N"), rédiger, paramétrer, publier, dépublier, supprimer.
- Un nouveau sujet type ou une nouvelle épreuve est un brouillon. Publier un sujet vide est refusé.
- Supprimer une épreuve supprime ses sujets types. Supprimer un concours supprime tout (sujets types et épreuves).
- Anciens sujets créés avant les épreuves (sans épreuve) : section "Sujets types sans épreuve", avec un sélecteur pour les ranger dans une épreuve. Ils sont invisibles pour les étudiants tant qu'ils ne sont pas rangés.

## Côté étudiant
- Page du concours : la carte "Testez vos connaissances" n'affiche plus de sujets, seulement le bouton "Voir tous les sujets types" (désactivé s'il n'y a rien de publié). "Commencer un entraînement" a été retiré de cette carte.
- Le bouton ouvre la liste des épreuves, puis les sujets types de l'épreuve choisie, puis le contenu dans le lecteur responsive des leçons. Le bouton retour du navigateur remonte d'un niveau.
- Visibilité : un sujet type n'est visible que si lui ET son épreuve sont publiés. Une épreuve sans sujet type publié est masquée.
- Aucune progression n'est exigée. Chronomètre facultatif si une limite de temps existe.

## Architecture
- `coursePaperGroups` (nouveau) : `courseId`, `title`, `status`, `order`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`.
- `coursePapers` : champ `groupId` ajouté (vide pour les anciens sujets).
- Règles Firestore : les deux collections sont réservées aux gestionnaires. Les étudiants passent par les callables.
- `listStudentCoursePapers` renvoie maintenant `{ groups: [{ id, title, order, papers: [...] }] }` (épreuves publiées contenant au moins un sujet publié). `getStudentCoursePaper` vérifie aussi que l'épreuve est publiée. Les deux exigent compte actif, inscription active et concours publié.
- Images de l'éditeur : `content-subjects/course-papers/{courseId}/{paperId}/images/` (aucune modification Storage).

## Déploiement requis (en plus de Cloudflare)
```
firebase deploy --only firestore:rules
firebase deploy --only functions:listStudentCoursePapers,functions:getStudentCoursePaper
```
Les règles sont obligatoires pour l'admin (collection `coursePaperGroups`). Les fonctions sont obligatoires pour les étudiants (nouvelle forme de réponse). Déployer d'abord les règles et les fonctions, puis le site, et faire un rechargement forcé (Ctrl+F5) côté étudiant.

## Fichiers
- Créés : `src/types/coursePaper.ts`, `src/features/coursePapers/*`, `src/components/CoursePapersAdmin.tsx`, `CoursePapersBrowser.tsx`, `CoursePaperView.tsx`, `LessonContentReader.tsx` (extrait de `App.tsx`), `src/styles/course-papers.css`.
- Modifiés : `src/App.tsx`, `src/features/admin/adminRepository.ts`, `src/main.tsx`, `firestore.rules`, `functions/src/index.ts`, `functions/lib/index.js` (compilé).

## Vérifications
- `npm run build` OK. Lint : 99 problèmes, identique à avant. `functions` : `tsc` OK, 10 tests OK.
- Non testé dans un navigateur ni avec l'émulateur Firebase.

## Limites connues
- La note de réussite est informative (pas de correction automatique). Le chronomètre est côté client et facultatif.
- Pas de réordonnancement par glisser-déposer (ordre de création).
