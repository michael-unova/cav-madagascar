import { Modal } from '../Modal/Modal'
import { Button } from '../Button/Button'
import { ErrorState } from '../ErrorState/ErrorState'
import styles from './ConfirmDialog.module.css'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  /** What the action will do, stated plainly enough to decide from. */
  message: string
  confirmLabel: string
  /** Shown while the action runs, so the button never looks unresponsive. */
  pendingLabel: string
  isPending?: boolean
  errorMessage?: string | null
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  pendingLabel,
  isPending = false,
  errorMessage,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {errorMessage && <ErrorState title="Action impossible" description={errorMessage} />}

      <p className={styles.message}>{message}</p>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
          Annuler
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
          {isPending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
