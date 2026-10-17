import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../features/auth'

// Only the lesson content itself is protected. The rest of the UI behaves normally.
const PROTECTED_SELECTOR = '.lesson-content-reader, .lesson-reader-page, .lesson-content, .lesson-preview, .lesson-document'
const BODY_CLASS = 'student-content-protected'

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (!element?.tagName) return false
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable
}

function isInsideProtectedContent(target: EventTarget | null) {
  const element = target instanceof Element ? target : null
  return Boolean(element?.closest(PROTECTED_SELECTOR))
}

// Right-click stays available on plain links (so "Open in new tab" works), but never on media.
const MEDIA_SELECTOR = 'img, video, audio, canvas, svg, picture, iframe, object, embed'

function isPlainLink(target: EventTarget | null) {
  const element = target instanceof Element ? target : null
  return Boolean(element?.closest('a[href]')) && !element?.closest(MEDIA_SELECTOR)
}

function selectionTouchesProtectedContent() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false
  const range = selection.getRangeAt(0)
  return Array.from(document.querySelectorAll(PROTECTED_SELECTOR)).some(element => range.intersectsNode(element))
}

export function ContentProtection({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const isStudent = profile?.role === 'student' && profile?.status === 'active'

  useEffect(() => {
    if (!isStudent) return

    document.body.classList.add(BODY_CLASS)

    const blockCopy = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (isInsideProtectedContent(event.target) || selectionTouchesProtectedContent()) event.preventDefault()
    }
    const blockContextMenu = (event: MouseEvent) => {
      if (isPlainLink(event.target)) return
      if (!isEditableTarget(event.target) && isInsideProtectedContent(event.target)) event.preventDefault()
    }
    const blockDrag = (event: DragEvent) => {
      if (!isEditableTarget(event.target) && isInsideProtectedContent(event.target)) event.preventDefault()
    }

    document.addEventListener('copy', blockCopy, true)
    document.addEventListener('cut', blockCopy, true)
    document.addEventListener('contextmenu', blockContextMenu, true)
    document.addEventListener('dragstart', blockDrag, true)

    return () => {
      document.body.classList.remove(BODY_CLASS)
      document.removeEventListener('copy', blockCopy, true)
      document.removeEventListener('cut', blockCopy, true)
      document.removeEventListener('contextmenu', blockContextMenu, true)
      document.removeEventListener('dragstart', blockDrag, true)
    }
  }, [isStudent])

  return <>{children}</>
}
