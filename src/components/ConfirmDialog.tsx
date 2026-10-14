import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  description: ReactNode
  hint?: ReactNode
  eyebrow?: string
  confirmLabel?: string
  /** Pass null to hide the cancel button (information dialog). */
  cancelLabel?: string | null
  tone?: 'danger' | 'info'
  busy?: boolean
  busyLabel?: string
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void
  onCancel: () => void
}

const dangerIcon = (
  <svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5m0 3h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const infoIcon = (
  <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M12 11v5m0-8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
)

export function ConfirmDialog({
  title, description, hint, eyebrow, confirmLabel, cancelLabel = 'Annuler', tone = 'danger',
  busy = false, busyLabel = 'Suppression…', onConfirm, onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const isDanger = tone === 'danger'

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = dialogRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])')
    first?.focus()
    return () => previous?.focus?.()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) { event.stopPropagation(); onCancel() }
      if (event.key === 'Tab') {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])
        if (!buttons.length) return
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [busy, onCancel])

  return (
    <div className="cav-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section ref={dialogRef} className="cav-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cav-confirm-title" aria-describedby="cav-confirm-description">
        <div className={`cav-confirm-icon${isDanger ? '' : ' cav-confirm-icon-info'}`} aria-hidden="true">{isDanger ? dangerIcon : infoIcon}</div>
        <span className={`cav-confirm-eyebrow${isDanger ? '' : ' cav-confirm-eyebrow-info'}`}>{eyebrow ?? (isDanger ? 'CONFIRMATION REQUISE' : 'ACTION IMPOSSIBLE')}</span>
        <h2 id="cav-confirm-title">{title}</h2>
        <p id="cav-confirm-description">{description}{hint ? <span className="cav-confirm-hint">{hint}</span> : null}</p>
        <div className="cav-confirm-actions">
          {cancelLabel !== null && <button type="button" className="cav-confirm-cancel" disabled={busy} onClick={onCancel}>{cancelLabel}</button>}
          <button type="button" className={isDanger ? 'cav-confirm-delete' : 'cav-confirm-primary'} disabled={busy} onClick={onConfirm}>
            {isDanger && <span aria-hidden="true">{busy ? '…' : '⌫'}</span>}
            {busy ? busyLabel : (confirmLabel ?? (isDanger ? 'Supprimer définitivement' : 'Compris'))}
          </button>
        </div>
      </section>
    </div>
  )
}

/** Promise-based replacement for window.confirm. Render `dialog` once in the component. */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmOptions) => new Promise<boolean>(resolve => {
    resolver.current?.(false)
    resolver.current = resolve
    setOptions(next)
  }), [])

  const close = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }, [])

  const dialog = options ? <ConfirmDialog {...options} onConfirm={() => close(true)} onCancel={() => close(false)} /> : null
  return { confirm, dialog }
}
