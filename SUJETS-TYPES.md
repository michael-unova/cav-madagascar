# Sujets types par concours

Chaque concours peut avoir plusieurs "Sujets types" (examens blancs). Un sujet type est un
document rédigé par l'admin dans le même éditeur riche que les leçons. Ce n'est pas un
ensemble de questions choisies par matière.

## Côté admin
- Ouvrir un concours enregistré : la section "Sujets types de ce concours" apparaît (jamais pour un concours non enregistré).
- Plusieurs sujets par concours. Paramètres : titre (défaut "Sujet type"), description, limite de temps (facultative, en minutes), note de réussite (facultative, en pourcentage).
- Un nouveau sujet est un brouillon. On peut le rédiger, le publier, le dépublier, le supprimer. Publier est refusé tant que le contenu est vide.
- Supprimer un concours supprime ses sujets types (`deleteCourse` dans `adminRepository.ts`).

## Côté étudiant
- La carte "Testez vos connaissances" de la page du concours liste les sujets types publiés de CE concours.
- Le sujet s'ouvre dans le même lecteur responsive que les leçons (`LessonContentReader`).
- Aucune progression n'est exigée : un étudiant inscrit peut ouvrir un sujet à tout moment.
- Si une limite de temps existe, un chronomètre facultatif (démarrer, pause, réinitialiser) est proposé. Il ne bloque jamais la lecture.
- Le bouton "Commencer un entraînement" (quiz existants) est conservé sous les sujets types.

## Architecture
- Nouvelle collection `coursePapers` : `courseId`, `title`, `description`, `timeLimitMinutes`, `passMark`, `status` (`draft` | `published`), `order`, `html`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`. Raison : un sujet appartient à un seul concours, avec son propre cycle de publication, ce qui ne rentre ni dans `contentNodes` (partagés entre concours) ni dans `questionSets`.
- Règles Firestore : lecture et écriture réservées aux gestionnaires. Les étudiants n'y accèdent jamais directement.
- Deux fonctions callable (region `africa-south1`) : `listStudentCoursePapers` (liste sans contenu) et `getStudentCoursePaper` (contenu). Elles exigent un compte actif, une inscription active et un concours publié, comme `getStudentLessonContent`.
- Images collées dans l'éditeur : `content-subjects/course-papers/{courseId}/{paperId}/images/` (règle Storage existante, aucune modification).

## Déploiement requis (en plus de Cloudflare)
```
firebase deploy --only firestore:rules
firebase deploy --only functions:listStudentCoursePapers,functions:getStudentCoursePaper
```
Sans cela, l'admin ne peut pas enregistrer de sujet et les étudiants ne voient aucun sujet.

## Fichiers
- Créés : `src/types/coursePaper.ts`, `src/features/coursePapers/*`, `src/components/CoursePapersAdmin.tsx`, `src/components/CoursePaperView.tsx`, `src/components/LessonContentReader.tsx` (extrait de `App.tsx`), `src/styles/course-papers.css`.
- Modifiés : `src/App.tsx`, `src/features/admin/adminRepository.ts`, `src/main.tsx`, `firestore.rules`, `functions/src/index.ts`, `functions/lib/index.js` (compilé).

## Vérifications
- `npm run build` : OK. `npm run lint` : 99 problèmes, identique à avant (2 erreurs et 97 avertissements déjà présents). `functions` : `tsc` OK, 10 tests OK.
- Non testé dans un navigateur ni avec l'émulateur Firebase.

## Limites connues
- La note de réussite est informative (pas de correction automatique, le sujet est un document).
- Le chronomètre est côté client et facultatif.
- Les anciens sujets ne sont pas réordonnables par glisser-déposer (ordre de création).
