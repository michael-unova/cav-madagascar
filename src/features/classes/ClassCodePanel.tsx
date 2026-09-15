import { useState } from 'react'
import { Button } from '../../components/Button/Button'
import styles from './ClassCodePanel.module.css'

export interface ClassCodePanelProps {
  /** The class id, which doubles as the code students type to join. */
  code: string
}

/**
 * Shows the code a teacher shares so students can join their class.
 * Anyone holding the code can join, so it is only rendered for the class's
 * own teacher and for administrators.
 */
export function ClassCodePanel({ code }: ClassCodePanelProps) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setIsCopied(true)
      window.setTimeout(() => setIsCopied(false), 2500)
    } catch {
      // Clipboard access can be refused by the browser. The code stays
      // visible on screen, so it can still be copied by hand.
      setIsCopied(false)
    }
  }

  return (
    <div className={styles.panel}>
      <div>
        <p className={styles.label}>Code de la classe</p>
        <p className={styles.code}>{code}</p>
        <p className={styles.hint}>
          Communiquez ce code à vos étudiants pour qu'ils rejoignent la classe.
        </p>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
        {isCopied ? 'Code copié' : 'Copier le code'}
      </Button>
    </div>
  )
}
