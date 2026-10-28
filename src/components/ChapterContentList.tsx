import { useEffect, useRef, useState } from 'react'

export type ChapterItemKind = 'lesson' | 'quiz' | 'exercise' | 'test'
export type ChapterAddKind = ChapterItemKind

export interface ChapterItem {
  /** `${kind}:${id}`: stable React key and drag identifier. Never shown to the administrator. */
  key: string
  kind: ChapterItemKind
  id: string
  title: string
  status: 'draft' | 'published' | 'archived'
  /** Short detail such as "12 questions". */
  detail?: string
}

export type ChapterItemAction = 'open' | 'rename' | 'toggle-publish' | 'remove' | 'delete'

export const CHAPTER_KIND_LABELS: Record<ChapterItemKind, string> = {
  lesson: 'Leçon',
  quiz: 'Quiz',
  exercise: 'Exercice',
  test: 'Test psychotechnique',
}

const KIND_ICONS: Record<ChapterItemKind, string> = { lesson: '📖', quiz: '❓', exercise: '✏️', test: '🧠' }

const ADD_CHOICES: Array<{ kind: ChapterAddKind; label: string; hint: string }> = [
  { kind: 'lesson', label: 'Leçon', hint: 'Cours rédigé avec texte, images et vidéos' },
  { kind: 'quiz', label: 'Quiz / Questions', hint: 'Questions corrigées automatiquement' },
  { kind: 'test', label: 'Test psychotechnique', hint: 'Test chronométré par domaines' },
  { kind: 'exercise', label: 'Exercice', hint: 'Exercice d’application' },
]

function statusLabel(status: ChapterItem['status']) {
  return status === 'published' ? 'Publié' : status === 'archived' ? 'Archivé' : 'Brouillon'
}

export function ChapterAddMenu({ onSelect, block = false, disabled = false }: { onSelect: (kind: ChapterAddKind) => void; block?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | TouchEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`chapter-add ${block ? 'is-block' : ''}`}>
      <button type="button" className="primary small-btn chapter-add-trigger" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        + Ajouter un contenu
      </button>
      {open && (
        <div className="chapter-add-pop" role="menu">
          {ADD_CHOICES.map(choice => (
            <button key={choice.kind} type="button" role="menuitem" onClick={() => { setOpen(false); onSelect(choice.kind) }}>
              <span className="chapter-add-icon" aria-hidden="true">{KIND_ICONS[choice.kind]}</span>
              <span><strong>{choice.label}</strong><small>{choice.hint}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ChapterContentList({
  items,
  formatNumber,
  busy = false,
  onAction,
  onMove,
  onReorder,
}: {
  items: ChapterItem[]
  formatNumber: (index: number) => string
  busy?: boolean
  onAction: (item: ChapterItem, action: ChapterItemAction) => void
  onMove: (item: ChapterItem, direction: -1 | 1) => void
  onReorder: (draggedKey: string, targetKey: string) => void
}) {
  const [menuKey, setMenuKey] = useState<string | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuKey) return
    const close = (event: MouseEvent | TouchEvent) => { if (!(event.target as HTMLElement | null)?.closest?.('.chapter-item-menu-wrap')) setMenuKey(null) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuKey(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuKey])

  if (!items.length) {
    return (
      <div className="chapter-empty">
        <strong>Ce chapitre est vide.</strong>
        <p>Cliquez sur « + Ajouter un contenu » pour créer une leçon, un quiz, un test psychotechnique ou un exercice.</p>
      </div>
    )
  }

  return (
    <div className="chapter-content-list" ref={listRef} role="list">
      {items.map((item, index) => {
        const isLesson = item.kind === 'lesson'
        return (
          <div
            key={item.key}
            role="listitem"
            className={`chapter-item kind-${item.kind} ${dragKey === item.key ? 'is-dragging' : ''} ${overKey === item.key && dragKey !== item.key ? 'is-drop-target' : ''}`}
            draggable={!busy}
            onDragStart={event => { setDragKey(item.key); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.key) }}
            onDragEnd={() => { setDragKey(null); setOverKey(null) }}
            onDragOver={event => { if (dragKey) { event.preventDefault(); setOverKey(item.key) } }}
            onDragLeave={() => setOverKey(current => (current === item.key ? null : current))}
            onDrop={event => { event.preventDefault(); const dragged = dragKey; setDragKey(null); setOverKey(null); if (dragged && dragged !== item.key) onReorder(dragged, item.key) }}
          >
            <span className="chapter-item-grip" aria-hidden="true" title="Glisser pour réorganiser">⋮⋮</span>
            <span className="chapter-item-number">{formatNumber(index)}</span>
            <button type="button" className="chapter-item-main" onClick={() => (isLesson ? onAction(item, 'open') : setMenuKey(current => (current === item.key ? null : item.key)))}>
              <strong>{item.title}</strong>
              <span className="chapter-item-meta">
                <span className={`chapter-kind-chip kind-${item.kind}`}><span aria-hidden="true">{KIND_ICONS[item.kind]}</span> {CHAPTER_KIND_LABELS[item.kind]}</span>
                <span className={`status ${item.status === 'published' ? 'published' : 'draft'}`}>{statusLabel(item.status)}</span>
                {item.detail && <small>{item.detail}</small>}
              </span>
            </button>
            <div className="chapter-item-controls">
              <button type="button" className="chapter-move" aria-label={`Monter « ${item.title} »`} disabled={busy || index === 0} onClick={() => onMove(item, -1)}>↑</button>
              <button type="button" className="chapter-move" aria-label={`Descendre « ${item.title} »`} disabled={busy || index === items.length - 1} onClick={() => onMove(item, 1)}>↓</button>
              <div className="chapter-item-menu-wrap">
                <button type="button" className="node-menu-trigger" aria-label={`Options de « ${item.title} »`} aria-haspopup="menu" aria-expanded={menuKey === item.key} onClick={() => setMenuKey(current => (current === item.key ? null : item.key))}>•••</button>
                {menuKey === item.key && (
                  <div className="node-action-menu chapter-item-menu" role="menu">
                    {isLesson && <button type="button" role="menuitem" onClick={() => { setMenuKey(null); onAction(item, 'open') }}>Ouvrir la leçon</button>}
                    <button type="button" role="menuitem" onClick={() => { setMenuKey(null); onAction(item, 'rename') }}>Modifier le titre</button>
                    <button type="button" role="menuitem" onClick={() => { setMenuKey(null); onAction(item, 'toggle-publish') }}>{item.status === 'published' ? 'Dépublier' : 'Publier'}</button>
                    {!isLesson && <button type="button" role="menuitem" onClick={() => { setMenuKey(null); onAction(item, 'remove') }}>Retirer du chapitre</button>}
                    <button type="button" role="menuitem" className="danger-action" onClick={() => { setMenuKey(null); onAction(item, 'delete') }}>Supprimer définitivement</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
