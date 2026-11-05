import type { CourseEpreuveSummary, CoursePaperSummary } from '../types/coursePaper'

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`
}

/** "Voir tous les sujets types": the épreuves of the concours (Maths, FRS…). */
export function CourseEpreuveList({ courseTitle, epreuves, onOpen, onBack }: {
  courseTitle: string
  epreuves: CourseEpreuveSummary[]
  onOpen: (epreuve: CourseEpreuveSummary) => void
  onBack: () => void
}) {
  return (
    <div className="page course-paper-page">
      <button type="button" className="back" onClick={onBack}>← Retour au concours</button>
      <div className="page-title">
        <div>
          <div className="eyebrow">{courseTitle.toUpperCase()}</div>
          <h1>Testez vos connaissances</h1>
          <p>Choisissez une épreuve pour voir ses sujets types.</p>
        </div>
      </div>
      {epreuves.length === 0
        ? <div className="panel empty-state"><h3>Aucun sujet type pour le moment</h3><p>Les sujets types publiés pour ce concours apparaîtront ici.</p></div>
        : <div className="course-test-grid">
          {epreuves.map(epreuve => (
            <button type="button" className="course-paper-card" key={epreuve.id} onClick={() => onOpen(epreuve)}>
              <span className="course-paper-card-title">{epreuve.title}</span>
              <span className="course-paper-card-meta">{epreuve.paperCount} sujet{epreuve.paperCount === 1 ? '' : 's'} type{epreuve.paperCount === 1 ? '' : 's'}</span>
              <span className="course-paper-card-cta">Voir les sujets types →</span>
            </button>
          ))}
        </div>}
    </div>
  )
}

/** The Sujets types of one épreuve (Sujet type 1, 2, 3…). */
export function CourseEpreuvePapers({ epreuveTitle, papers, loading, error, onOpen, onBack }: {
  epreuveTitle: string
  papers: CoursePaperSummary[]
  loading: boolean
  error: string
  onOpen: (paper: CoursePaperSummary) => void
  onBack: () => void
}) {
  return (
    <div className="page course-paper-page">
      <button type="button" className="back" onClick={onBack}>← Retour aux épreuves</button>
      <div className="page-title">
        <div>
          <div className="eyebrow">ÉPREUVE</div>
          <h1>{epreuveTitle}</h1>
          <p>Ouvrez un sujet type pour en lire le contenu.</p>
        </div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading
        ? <div className="panel lesson-loading-state" role="status" aria-live="polite">
          <div className="lesson-loading-spinner" aria-hidden="true" />
          <div className="lesson-loading-copy"><strong>Chargement des sujets types</strong></div>
        </div>
        : !error && (papers.length === 0
          ? <div className="panel empty-state"><h3>Aucun sujet type disponible</h3><p>Les sujets types de cette épreuve apparaîtront ici dès leur publication.</p></div>
          : <div className="course-test-grid">
            {papers.map(paper => (
              <button type="button" className="course-paper-card" key={paper.id} onClick={() => onOpen(paper)}>
                <span className="course-paper-card-title">{paper.title}</span>
                {paper.description && <span className="course-paper-card-description">{paper.description}</span>}
                <span className="course-paper-card-meta">
                  {paper.timeLimitMinutes ? `⏱ ${formatDuration(paper.timeLimitMinutes)}` : 'Sans limite de temps'}
                  {paper.passMark !== null ? ` · Réussite ${paper.passMark} %` : ''}
                </span>
                <span className="course-paper-card-cta">Ouvrir le sujet →</span>
              </button>
            ))}
          </div>)}
    </div>
  )
}
