import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { Input } from '../../components/Input/Input'
import { Textarea } from '../../components/Textarea/Textarea'
import { Button } from '../../components/Button/Button'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { createCourse, updateCourse } from '../../lib/firebase/courses'
import { getFirestoreErrorMessage } from '../../lib/firebase/firestoreErrors'
import type { Course } from '../../types'
import styles from './CourseFormModal.module.css'

export interface CourseFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** The class the course belongs to. A course never spans two classes. */
  classId: string
  teacherId: string
  /** When provided, the form edits this course instead of creating one. */
  course?: Course
  onSaved: (courseId: string) => void
}

export function CourseFormModal({
  isOpen,
  onClose,
  classId,
  teacherId,
  course,
  onSaved,
}: CourseFormModalProps) {
  const isEditing = course !== undefined

  const [title, setTitle] = useState(course?.title ?? '')
  const [description, setDescription] = useState(course?.description ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      if (course) {
        await updateCourse(course.id, { title: title.trim(), description: description.trim() })
        onSaved(course.id)
      } else {
        const courseId = await createCourse({
          classId,
          teacherId,
          title: title.trim(),
          description: description.trim(),
        })
        onSaved(courseId)
      }

      onClose()
    } catch (error) {
      setErrorMessage(
        getFirestoreErrorMessage(
          error,
          isEditing
            ? "Le cours n'a pas pu être modifié. Veuillez réessayer."
            : "Le cours n'a pas pu être créé. Veuillez réessayer.",
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Modifier le cours' : 'Créer un cours'}>
      {errorMessage && <ErrorState title="Enregistrement impossible" description={errorMessage} />}

      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label="Titre du cours"
          type="text"
          placeholder="Algèbre linéaire, Grammaire, ..."
          maxLength={140}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <Textarea
          label="Description"
          rows={4}
          maxLength={800}
          placeholder="Résumez les objectifs du cours et ce que les étudiants vont apprendre."
          helperText="Visible par les étudiants de la classe."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting || title.trim().length === 0}>
            {isSubmitting
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer les modifications'
                : 'Créer le cours'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
