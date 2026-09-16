import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { Input } from '../../components/Input/Input'
import { Textarea } from '../../components/Textarea/Textarea'
import { Button } from '../../components/Button/Button'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { createLesson, updateLessonMeta } from '../../lib/firebase/lessons'
import { getFirestoreErrorMessage } from '../../lib/firebase/firestoreErrors'
import type { Lesson } from '../../types'
import styles from './LessonFormModal.module.css'

export interface LessonFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** The course the lesson belongs to. A lesson never spans two courses. */
  courseId: string
  classId: string
  teacherId: string
  /** When provided, the form edits this lesson instead of creating one. */
  lesson?: Lesson
  onSaved: (lessonId: string) => void
}

export function LessonFormModal({
  isOpen,
  onClose,
  courseId,
  classId,
  teacherId,
  lesson,
  onSaved,
}: LessonFormModalProps) {
  const isEditing = lesson !== undefined

  const [title, setTitle] = useState(lesson?.title ?? '')
  const [description, setDescription] = useState(lesson?.description ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      if (lesson) {
        await updateLessonMeta(lesson.id, { title: title.trim(), description: description.trim() })
        onSaved(lesson.id)
      } else {
        const lessonId = await createLesson({
          courseId,
          classId,
          teacherId,
          title: title.trim(),
          description: description.trim(),
        })
        onSaved(lessonId)
      }

      onClose()
    } catch (error) {
      setErrorMessage(
        getFirestoreErrorMessage(
          error,
          isEditing
            ? "La leçon n'a pas pu être modifiée. Veuillez réessayer."
            : "La leçon n'a pas pu être créée. Veuillez réessayer.",
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Modifier la leçon' : 'Créer une leçon'}>
      {errorMessage && <ErrorState title="Enregistrement impossible" description={errorMessage} />}

      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label="Titre de la leçon"
          type="text"
          placeholder="Introduction aux fonctions, La Révolution française, ..."
          maxLength={140}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <Textarea
          label="Description"
          rows={4}
          maxLength={800}
          placeholder="Résumez le contenu de la leçon."
          helperText="Visible par les étudiants de la classe."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {!isEditing && (
          <p className={styles.hint}>
            La vidéo et les supports de cours s'ajoutent depuis la page de la leçon, une fois celle-ci créée.
          </p>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting || title.trim().length === 0}>
            {isSubmitting
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer les modifications'
                : 'Créer la leçon'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
