import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { Input } from '../../components/Input/Input'
import { Textarea } from '../../components/Textarea/Textarea'
import { Button } from '../../components/Button/Button'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { createClass, updateClass } from '../../lib/firebase/classes'
import { getFirestoreErrorMessage } from '../../lib/firebase/firestoreErrors'
import type { Class, User } from '../../types'
import styles from './ClassFormModal.module.css'

export interface ClassFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** The signed-in teacher, used as the owner of a newly created class. */
  teacher: User
  /** When provided, the form edits this class instead of creating one. */
  classItem?: Class
  /** Called after a successful save, so the caller can reload its data. */
  onSaved: (classId: string) => void
}

export function ClassFormModal({ isOpen, onClose, teacher, classItem, onSaved }: ClassFormModalProps) {
  const isEditing = classItem !== undefined

  const [name, setName] = useState(classItem?.name ?? '')
  const [description, setDescription] = useState(classItem?.description ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      if (classItem) {
        await updateClass(classItem.id, { name: name.trim(), description: description.trim() })
        onSaved(classItem.id)
      } else {
        const classId = await createClass({
          name: name.trim(),
          description: description.trim(),
          teacherId: teacher.id,
          teacherName: teacher.displayName,
        })
        onSaved(classId)
      }

      onClose()
    } catch (error) {
      setErrorMessage(
        getFirestoreErrorMessage(
          error,
          isEditing
            ? "La classe n'a pas pu être modifiée. Veuillez réessayer."
            : "La classe n'a pas pu être créée. Veuillez réessayer.",
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Modifier la classe' : 'Créer une classe'}>
      {errorMessage && <ErrorState title="Enregistrement impossible" description={errorMessage} />}

      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label="Nom de la classe"
          type="text"
          placeholder="Terminale S, Groupe A, ..."
          maxLength={120}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <Textarea
          label="Description"
          rows={4}
          maxLength={600}
          placeholder="Indiquez le niveau, la matière ou le rythme des séances."
          helperText="Visible par les étudiants de la classe."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting || name.trim().length === 0}>
            {isSubmitting
              ? 'Enregistrement...'
              : isEditing
                ? 'Enregistrer les modifications'
                : 'Créer la classe'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
