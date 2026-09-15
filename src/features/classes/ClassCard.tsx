import { Link } from 'react-router-dom'
import { Badge } from '../../components/Badge/Badge'
import { paths } from '../../routes/paths'
import type { Class } from '../../types'
import styles from './ClassCard.module.css'

export interface ClassCardProps {
  classItem: Class
  /** Number of courses in the class, when it has already been loaded. */
  courseCount?: number
  /** Number of enrolled students, shown to teachers and administrators. */
  studentCount?: number
}

export function ClassCard({ classItem, courseCount, studentCount }: ClassCardProps) {
  return (
    <Link to={paths.classDetail(classItem.id)} className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.name}>{classItem.name}</h3>
        <svg className={styles.chevron} aria-hidden="true">
          <use href="/icons.svg#icon-chevron-right" />
        </svg>
      </div>

      {classItem.description && <p className={styles.description}>{classItem.description}</p>}

      <p className={styles.teacher}>{classItem.teacherName}</p>

      <div className={styles.meta}>
        {courseCount !== undefined && (
          <Badge tone="primary">{courseCount === 1 ? '1 cours' : `${courseCount} cours`}</Badge>
        )}
        {studentCount !== undefined && (
          <Badge tone="accent">{studentCount === 1 ? '1 étudiant' : `${studentCount} étudiants`}</Badge>
        )}
      </div>
    </Link>
  )
}
