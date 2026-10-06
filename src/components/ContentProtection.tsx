import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../features/auth'

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (!element) return false
  const tag = element.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
}

export function ContentProtection({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const isStudent = profile?.role === 'student' && profile?.status === 'active'
  const displayName = String(profile?.displayName ?? 'Étudiant').trim() || 'Étudiant'

  useEffect(() => {
    if (!isStudent) return

    const onContextMenu = (event: MouseEvent) => {
      if (!isEditableTarget(event.target)) event.preventDefault()
    }
    const onCopy = (event: ClipboardEvent) => {
      if (!isEditableTarget(event.target)) event.preventDefault()
    }
    const onCut = (event: ClipboardEvent) => {
      if (!isEditableTarget(event.target)) event.preventDefault()
    }
    const onDragStart = (event: DragEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName?.toLowerCase() === 'img' || !isEditableTarget(event.target)) event.preventDefault()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const key = event.key.toLowerCase()
      const ctrlOrMeta = event.ctrlKey || event.metaKey
      const blocked =
        key === 'f12' ||
        (ctrlOrMeta && ['c', 'x', 'a', 'u', 's', 'p'].includes(key)) ||
        (ctrlOrMeta && event.shiftKey && ['i', 'j', 'c'].includes(key))
      if (blocked) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('copy', onCopy, true)
    document.addEventListener('cut', onCut, true)
    document.addEventListener('dragstart', onDragStart, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('copy', onCopy, true)
      document.removeEventListener('cut', onCut, true)
      document.removeEventListener('dragstart', onDragStart, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [isStudent])

  if (!isStudent) return <>{children}</>

  return <div className="protected-student-shell">
    <div className="student-content-watermark" aria-hidden="true">
      <span>CAV Madagascar</span><b>{displayName}</b>
    </div>
    {children}
  </div>
}
