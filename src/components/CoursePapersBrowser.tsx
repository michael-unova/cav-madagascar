import { CoursePaperView } from './CoursePaperView'
import type { CoursePaperGroupSummary, CoursePaperSummary } from '../types/coursePaper'

interface Props {
  courseId: string
  courseTitle: string
  groups: CoursePaperGroupSummary[]
  /** '' = list of épreuves, otherwise the épreuve being browsed. */
  groupId: string
  /** '' = no Sujet type open, otherwise the one being read. */
  paperId: string
  onOpenGroup: (groupId: string) => void
  onOpenPaper: (groupId: string, paperId: string) => void
  onBack: () => void
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const rest = minutes % 60
  return `${Math.floor(minutes / 60)} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`
}

function paperMeta(paper: CoursePaperSummary) {
  const time = paper.timeLimitMinutes ? `⏱ ${formatMinutes(paper.timeLimitMinutes)}` : 'Sans limite de temps'
  return paper.passMark !== null ? `${time} · Réussite ${paper.passMark} %` : time
}

/**
 * Student flow: Testez vos connaissances → épreuves → Sujets types → document.
 * Navigation is driven by the parent so the browser back button follows each level.
 */
export function CoursePapersBrowser({ courseId, courseTitle, groups, groupId, paperId, onOpenGroup, onOpenPaper, onBack }: Props) {
  const group = groups.find(item => item.id === groupId)
  const paper = group?.papers.find(item => item.id === paperId)

  if (group && paper) {
    return <CoursePaperView key={paper.id} courseId={courseId} courseTitle={courseTitle} paper={paper} onBack={onBack} />
  }

  if (group) {
    return (
      <div className="page course-papers-browser">
        <button type="button" className="back" onClick={onBack}>← Retour aux épreuves</button>
        <div className="page-title">
          <div>
            <div className="eyebrow">{courseTitle.toUpperCase()}</div>
            <h1>{group.title}</h1>
            <p>Choisissez un sujet type. Vous pouvez l’ouvrir à tout moment, sans avoir terminé les leçons.</p>
          </div>
        </div>
        <div className="course-paper-grid">
          {group.papers.map(item => (
            <button type="button" className="course-paper-card" key={item.id} onClick={() => onOpenPaper(group.id, item.id)}>
              <span className="course-paper-card-title">{item.title}</span>
              {item.description && <span className="course-paper-card-description">{item.description}</span>}
              <span className="course-paper-card-meta">{paperMeta(item)}</span>
              <span className="course-paper-card-cta">Ouvrir le sujet →</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page course-papers-browser">
      <button type="button" className="back" onClick={onBack}>← Retour au concours</button>
      <div className="page-title">
        <div>
          <div className="eyebrow">{courseTitle.toUpperCase()}</div>
          <h1>Testez vos connaissances</h1>
          <p>Choisissez une épreuve pour voir ses sujets types.</p>
        </div>
      </div>
      {groups.length === 0
        ? <div className="panel empty-state"><h3>Aucun sujet type pour le moment.</h3><p>Les sujets types publiés pour ce concours apparaîtront ici.</p></div>
        : <div className="course-paper-grid">
          {groups.map(item => (
            <button type="button" className="course-paper-card" key={item.id} onClick={() => onOpenGroup(item.id)}>
              <span className="course-paper-card-title">{item.title}</span>
              <span className="course-paper-card-meta">{item.papers.length} sujet{item.papers.length > 1 ? 's' : ''} type{item.papers.length > 1 ? 's' : ''}</span>
              <span className="course-paper-card-cta">Voir les sujets types →</span>
            </button>
          ))}
        </div>}
    </div>
  )
}
