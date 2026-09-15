import { Link } from 'react-router-dom'
import { paths } from '../../routes/paths'
import { formatDate } from '../../utils/formatDate'
import type { Course } from '../../types'
import styles from './CourseCard.module.css'

export interface CourseCardProps {
  course: Course
  /** Name of the owning class, shown when courses from several classes mix. */
  className?: string
}

export function CourseCard({ course, className }: CourseCardProps) {
  return (
    <Link to={paths.courseDetail(course.id)} className={styles.card}>
      <span className={styles.iconWrapper}>
        <svg className={styles.icon} aria-hidden="true">
          <use href="/icons.svg#icon-book" />
        </svg>
      </span>

      <div className={styles.body}>
        <h3 className={styles.title}>{course.title}</h3>
        {course.description && <p className={styles.description}>{course.description}</p>}
        <p className={styles.meta}>
          {className ? `${className}, créé le ${formatDate(course.createdAt)}` : `Créé le ${formatDate(course.createdAt)}`}
        </p>
      </div>

      <svg className={styles.chevron} aria-hidden="true">
        <use href="/icons.svg#icon-chevron-right" />
      </svg>
    </Link>
  )
}
