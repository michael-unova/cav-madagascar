import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth, logoutUser } from '../features/auth'
import { subscribeMyNotifications } from '../features/lessonComments'
import type { LessonNotification } from '../features/lessonComments/lessonCommentRepository'
import { listPublishedCourses } from '../features/courses'
import { getFirebaseFirestore } from '../lib/firebase/firestore'
import type { Course } from '../types/course'

type SearchResult = {
  id: string
  title: string
  subtitle: string
  type: 'Concours' | 'Matière'
  href: string
}

type SearchSubject = {
  id: string
  name: string
  matricule: string
  niveau: string
  description: string
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()

export function StudentNavbar() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<LessonNotification[]>([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchError, setSearchError] = useState('')
  const catalogRef = useRef<{ courses: Course[]; subjects: SearchSubject[]; links: Array<{ subjectId: string; courseId: string }> } | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeMyNotifications(user.uid, setNotifications, () => setNotifications([]))
  }, [user])

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      setSearching(false)
      setSearchError('')
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        if (!catalogRef.current) {
          const db = getFirebaseFirestore()
          const [courses, subjectsSnapshot, linksSnapshot] = await Promise.all([
            listPublishedCourses(),
            getDocs(query(collection(db, 'subjects'), where('status', '==', 'published'))).catch(() => null),
            getDocs(query(collection(db, 'courseSubjects'), where('status', '==', 'published'))).catch(() => null),
          ])
          const subjects: SearchSubject[] = (subjectsSnapshot?.docs ?? []).map(item => {
            const data = item.data()
            return { id: item.id, name: String(data.name ?? ''), matricule: String(data.matricule ?? ''), niveau: String(data.niveau ?? ''), description: String(data.description ?? '') }
          })
          const links = (linksSnapshot?.docs ?? []).map(item => ({ subjectId: String(item.data().subjectId ?? ''), courseId: String(item.data().courseId ?? '') }))
          catalogRef.current = { courses, subjects, links }
        }
        if (cancelled) return

        const { courses, subjects, links } = catalogRef.current
        const needle = normalize(term)
        const courseResults: SearchResult[] = courses
          .filter(course => normalize(`${course.title} ${course.description} ${course.slug}`).includes(needle))
          .slice(0, 6)
          .map(course => ({
            id: `course-${course.id}`,
            title: course.title,
            subtitle: course.description || 'Préparation aux concours',
            type: 'Concours',
            href: `/courses/${course.slug}`,
          }))

        const courseById = new Map(courses.map(course => [course.id, course]))
        const linkedCourseBySubject = new Map<string, Course>()
        links.forEach(link => {
          const course = courseById.get(link.courseId)
          if (course && !linkedCourseBySubject.has(link.subjectId)) linkedCourseBySubject.set(link.subjectId, course)
        })

        const subjectResults: SearchResult[] = subjects
          .filter(subject => normalize(`${subject.name} ${subject.matricule} ${subject.niveau} ${subject.description}`).includes(needle))
          .slice(0, 6)
          .map(subject => {
            const linkedCourse = linkedCourseBySubject.get(subject.id)
            return {
              id: `subject-${subject.id}`,
              title: subject.name,
              subtitle: [subject.matricule, subject.niveau].filter(Boolean).join(' · ') || 'Matière pédagogique',
              type: 'Matière' as const,
              href: linkedCourse ? `/courses/${linkedCourse.slug}` : '/courses',
            }
          })

        setResults([...courseResults, ...subjectResults].slice(0, 8))
      } catch (error) {
        console.error('Erreur de recherche du catalogue', error)
        if (!cancelled) {
          setResults([])
          setSearchError('La recherche est momentanément indisponible.')
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search])

  useEffect(() => {
    setSearchOpen(false)
  }, [location.pathname])

  const name = String(profile?.displayName ?? user?.displayName ?? 'Étudiant')
  const initials = useMemo(() => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('') || 'E', [name])
  const photo = String(profile?.photoURL ?? user?.photoURL ?? '')

  if (!user) return null

  const links = [
    ['/dashboard', '⌂', 'Accueil'],
    ['/courses', '◈', 'Concours'],
    ['/courses', '▣', 'Mes cours'],
    ['/library', '▤', 'Bibliothèque'],
    ['/results', '◒', 'Résultats'],
  ]

  function openResult(result: SearchResult) {
    setSearchOpen(false)
    setSearch(result.title)
    navigate(result.href)
  }

  return <header className="student-navbar">
    <div className="student-navbar-inner">
      <Link to="/dashboard" className="student-brand" aria-label="CAV Madagascar">
        <img src="/assets/cav-logo.webp" alt="CAV Madagascar" />
      </Link>
      <nav className="student-nav-links" aria-label="Navigation étudiant">
        {links.map(([href, icon, label], index) => {
          const active = index === 0 ? location.pathname === '/dashboard' : index === 1 ? location.pathname === '/courses' : index === 3 ? location.pathname.startsWith('/library') : false
          return <Link key={label} to={href} className={active ? 'is-active' : ''}><span>{icon}</span>{label}</Link>
        })}
      </nav>
      <div className="student-nav-search-wrap">
        <div className={`student-nav-search ${searchOpen ? 'is-open' : ''}`}>
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Rechercher un concours ou une matière"
            aria-expanded={searchOpen}
            aria-controls="student-search-results"
            role="combobox"
            aria-autocomplete="list"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={event => { setSearch(event.target.value); setSearchOpen(true) }}
            onKeyDown={event => {
              if (event.key === 'Escape') setSearchOpen(false)
              if (event.key === 'Enter' && results[0]) openResult(results[0])
            }}
            placeholder="Rechercher un concours, une matière..."
          />
          {search && <button type="button" className="student-search-clear" aria-label="Effacer la recherche" onClick={() => { setSearch(''); setResults([]); setSearchOpen(true) }}>×</button>}
        </div>
        {searchOpen && search.trim().length >= 2 && <div id="student-search-results" className="student-search-results" role="listbox" aria-label="Résultats de recherche">
          {searching && <div className="student-search-state">Recherche en cours…</div>}
          {!searching && searchError && <div className="student-search-state is-error">{searchError}</div>}
          {!searching && !searchError && results.length === 0 && <div className="student-search-state">Aucun concours ou matière trouvé.</div>}
          {!searching && results.map(result => <button key={result.id} type="button" className="student-search-result" role="option" aria-selected="false" onMouseDown={event => event.preventDefault()} onClick={() => openResult(result)}>
            <span className={`student-search-result-icon ${result.type === 'Matière' ? 'is-subject' : ''}`} aria-hidden="true">{result.type === 'Matière' ? '▤' : '◈'}</span>
            <span className="student-search-result-copy"><strong>{result.title}</strong><small>{result.subtitle}</small></span>
            <span className="student-search-result-type">{result.type}</span>
          </button>)}
        </div>}
      </div>
      <div className="student-nav-actions">
        <span className="student-online-status"><i /> Connecté</span>
        <button type="button" className="student-bell" aria-label="Notifications">♧{notifications.length > 0 && <b>{notifications.length > 99 ? '99+' : notifications.length}</b>}</button>
        {photo ? <img src={photo} alt="" className="student-avatar" /> : <span className="student-avatar student-avatar-fallback">{initials}</span>}
        <span className="student-user-name">{name}</span>
        <span className="student-user-chevron">⌄</span>
        <button className="student-logout" type="button" onClick={() => void (async () => { await logoutUser(); navigate('/', { replace: true }) })()}>Se déconnecter</button>
      </div>
    </div>
  </header>
}
