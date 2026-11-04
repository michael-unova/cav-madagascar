import { useEffect, useRef } from 'react'
import { sanitizeLessonHtml } from './RichLessonEditor'

/** Responsive reader shared by lessons and Sujets types, so both look identical to students. */
export function LessonContentReader({ html }: { html: string }) {
  const pageRef = useRef<HTMLDivElement>(null)
  // On phones, tell students when a table is wider than the screen so they know to swipe it sideways.
  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const update = () => {
      root.querySelectorAll('.lesson-table-hint').forEach(node => node.remove())
      root.querySelectorAll('table').forEach(table => {
        if (table.scrollWidth > table.clientWidth + 2) {
          const hint = document.createElement('p')
          hint.className = 'lesson-table-hint'
          hint.textContent = 'Faites glisser le tableau vers la gauche pour voir la suite →'
          table.parentNode?.insertBefore(hint, table)
        }
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('resize', update); root.querySelectorAll('.lesson-table-hint').forEach(node => node.remove()) }
  }, [html])
  return (
    <article className="lesson-reader-preview lesson-content-reader">
      <div className="lesson-reader-toolbar">
        <div className="lesson-reader-toolbar-main">
          <span className="lesson-reader-badge">📖 Cours</span>
          <strong>Lecture</strong>
        </div>
        <span className="lesson-reader-hint">Contenu adapté à votre écran</span>
      </div>
      <div className="lesson-reader-page">
        <div ref={pageRef} className="lesson-reader-page-inner" dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(html) }} />
      </div>
    </article>
  )
}
