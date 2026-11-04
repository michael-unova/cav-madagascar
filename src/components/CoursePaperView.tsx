import { useEffect, useRef, useState } from 'react'
import { LessonContentReader } from './LessonContentReader'
import { getStudentCoursePaper } from '../features/coursePapers'
import { callableErrorMessage } from '../lib/firebase/callableError'
import type { CoursePaperSummary } from '../types/coursePaper'

interface Props {
  courseId: string
  courseTitle: string
  paper: CoursePaperSummary
  onBack: () => void
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const two = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`
}

/**
 * A Sujet type is read like a lesson (same responsive reader). When the admin set a
 * time limit, the student can start an optional countdown. It never blocks reading.
 */
export function CoursePaperView({ courseId, courseTitle, paper, onBack }: Props) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limitSeconds = paper.timeLimitMinutes ? paper.timeLimitMinutes * 60 : 0
  const [remaining, setRemaining] = useState(limitSeconds)
  const [running, setRunning] = useState(false)
  const endsAtRef = useRef(0)

  useEffect(() => {
    // The parent keys this component by paper id, so state starts fresh for each paper.
    let cancelled = false
    getStudentCoursePaper(courseId, paper.id)
      .then(result => { if (!cancelled) setHtml(result.html) })
      .catch(e => {
        console.error(e)
        if (!cancelled) setError(callableErrorMessage(e, 'Impossible de charger ce sujet type. Réessayez dans un instant.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [courseId, paper.id])

  useEffect(() => {
    if (!running) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) setRunning(false)
    }
    tick()
    const timer = window.setInterval(tick, 500)
    return () => window.clearInterval(timer)
  }, [running])

  function startTimer() {
    endsAtRef.current = Date.now() + (remaining > 0 ? remaining : limitSeconds) * 1000
    if (remaining <= 0) setRemaining(limitSeconds)
    setRunning(true)
  }

  function resetTimer() {
    setRunning(false)
    setRemaining(limitSeconds)
  }

  const timeIsUp = limitSeconds > 0 && !running && remaining === 0
  const started = running || (limitSeconds > 0 && remaining !== limitSeconds)

  return (
    <div className="page course-paper-page">
      <button type="button" className="back" onClick={onBack}>← Retour au concours</button>
      <div className="page-title">
        <div>
          <div className="eyebrow">{courseTitle.toUpperCase()}</div>
          <h1>{paper.title}</h1>
          {paper.description && <p>{paper.description}</p>}
        </div>
      </div>
      {(paper.timeLimitMinutes || paper.passMark !== null) && (
        <div className="course-paper-meta" aria-label="Informations sur le sujet type">
          {paper.timeLimitMinutes ? <span>⏱ Durée : {formatDuration(paper.timeLimitMinutes)}</span> : null}
          {paper.passMark !== null ? <span>🎯 Note de réussite : {paper.passMark} %</span> : null}
        </div>
      )}
      {limitSeconds > 0 && !loading && !error && (
        <div className={`course-paper-timer${timeIsUp ? ' is-over' : running ? ' is-running' : ''}`} role="timer" aria-live="off">
          <div className="course-paper-timer-clock">
            <small>{timeIsUp ? 'Temps écoulé' : running ? 'Temps restant' : started ? 'Chronomètre en pause' : 'Chronomètre facultatif'}</small>
            <strong>{formatClock(remaining)}</strong>
          </div>
          <div className="course-paper-timer-actions">
            {running
              ? <button type="button" className="outline small-btn" onClick={() => setRunning(false)}>Pause</button>
              : <button type="button" className="primary small-btn" onClick={startTimer}>{timeIsUp ? 'Recommencer' : started ? 'Reprendre' : 'Démarrer le chronomètre'}</button>}
            {started && <button type="button" className="outline small-btn" onClick={resetTimer}>Réinitialiser</button>}
          </div>
        </div>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
      {loading
        ? <div className="panel lesson-loading-state" role="status" aria-live="polite">
          <div className="lesson-loading-spinner" aria-hidden="true" />
          <div className="lesson-loading-copy"><strong>Chargement du sujet type</strong><span>Préparation de votre sujet...</span></div>
          <div className="lesson-loading-skeleton" aria-hidden="true"><span /><span /><span /></div>
        </div>
        : !error && (html.trim()
          ? <LessonContentReader html={html} />
          : <div className="panel empty-state"><h3>Ce sujet type est vide.</h3><p>Son contenu sera disponible dès qu’il aura été rédigé.</p></div>)}
    </div>
  )
}
