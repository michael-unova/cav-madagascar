import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { Input } from '../../components/Input/Input'
import { Button } from '../../components/Button/Button'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { joinClass } from '../../lib/firebase/enrollments'
import type { User } from '../../types'
import styles from './JoinClassModal.module.css'

export interface JoinClassModalProps {
  isOpen: boolean
  onClose: () => void
  student: User
  onJoined: (classId: string) => void
}

export function JoinClassModal({ isOpen, onClose, student, onJoined }: JoinClassModalProps) {
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const classId = code.trim().toUpperCase()

    try {
      await joinClass({
        classId,
        studentId: student.id,
        studentName: student.displayName,
        studentEmail: student.email,
      })
      setCode('')
      onJoined(classId)
      onClose()
    } catch {
      // Security Rules reject the write when no class carries this code, so
      // an unknown code and a rejected code are indistinguishable here, and
      // both mean the same thing to the student.
      setErrorMessage(
        "Ce code ne correspond à aucune classe. Vérifiez-le auprès de votre enseignant, puis réessayez.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rejoindre une classe">
      <p className={styles.intro}>
        Saisissez le code communiqué par votre enseignant. Il comporte 7 caractères.
      </p>

      {errorMessage && <ErrorState title="Code non reconnu" description={errorMessage} />}

      <form className={styles.form} onSubmit={handleSubmit}>
        <Input
          label="Code de la classe"
          type="text"
          className={styles.codeField}
          placeholder="Ex. K7QMD3F"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={7}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
        />

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting || code.trim().length === 0}>
            {isSubmitting ? 'Vérification...' : 'Rejoindre la classe'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
