import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { courseIllustration } from '../components/CourseIllustration'
import { Container } from '../components/ui/Container'
import { listPublishedCourseGroups, listPublishedCourses } from '../features/courses'
import type { Course, CourseGroup } from '../types/course'

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [groups, setGroups] = useState<CourseGroup[]>([])
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { Promise.all([listPublishedCourses(), listPublishedCourseGroups()]).then(([items, nextGroups]) => { setCourses(items); setGroups(nextGroups) }).catch(() => setError('Impossible de charger les concours pour le moment.')).finally(() => setLoading(false)) }, [])
  const filtered = useMemo(() => courses.filter(course => (!search.trim() || `${course.title} ${course.description}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'))) && (selectedGroup === 'all' || course.groupId === selectedGroup)), [courses, search, selectedGroup])

  return <Container className="redesign-page-container">
    <section className="redesign-catalog-hero"><div><p className="redesign-eyebrow">Catalogue</p><h1>Découvrez les concours</h1><p>Choisissez une préparation claire, structurée et adaptée à votre objectif.</p></div><div className="redesign-catalog-search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un concours..." /></div></section>
    <div className="redesign-filter-row"><button className={selectedGroup === 'all' ? 'is-active' : ''} onClick={() => setSelectedGroup('all')}>Tous</button>{groups.map(group => <button key={group.id} className={selectedGroup === group.id ? 'is-active' : ''} onClick={() => setSelectedGroup(group.id)}>{group.title}</button>)}<button className={selectedGroup === 'ungrouped' ? 'is-active' : ''} onClick={() => setSelectedGroup('ungrouped')}>Non groupé</button></div>
    {loading && <div className="catalogue-state">Chargement des concours...</div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    {!loading && !error && <div className="redesign-catalog-grid">{filtered.map(course => <article className="redesign-catalog-card" key={course.id}><div className="redesign-catalog-image"><img src={courseIllustration(course)} alt={`Illustration de ${course.title}`} /><span>Préparation aux concours</span></div><div className="redesign-catalog-body"><div className="redesign-card-top">{course.groupId && <span className="redesign-category">{groups.find(g => g.id === course.groupId)?.title || 'Groupe'}</span>}<span className="redesign-open">›</span></div><h2>{course.title}</h2><p>{course.description || 'Une préparation structurée pour avancer avec méthode.'}</p><div className="redesign-meta"><span>▣ Préparation structurée</span><strong>{course.price.toLocaleString('fr-FR')} {course.currency}</strong></div><Link className="redesign-outline-button" to={`/courses/${course.slug}`}>Voir et s’inscrire <span>→</span></Link></div></article>)}{filtered.length === 0 && <Card className="redesign-empty"><h2>Aucun concours trouvé</h2><p>Essayez une autre recherche ou un autre filtre.</p></Card>}</div>}
  </Container>
}
