import { Link } from 'react-router-dom'
import { Button } from '../../components/Button/Button'
import { paths } from '../../routes/paths'
import type { Lesson } from '../../types'
import styles from './LessonListItem.module.css'

export interface LessonListItemProps {
  lesson: Lesson
  isOwner: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
  onDelete: () => void
}

export function LessonListItem({
  lesson,
  isOwner,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: LessonListItemProps) {
  return (
    <li className={styles.row}>
      <span className={styles.index}>{lesson.order + 1}</span>

      <Link to={paths.lessonDetail(lesson.id)} className={styles.link}>
        <span className={styles.title}>{lesson.title}</span>
        <span className={styles.meta}>
          {lesson.videoPath ? 'Vidéo disponible' : 'Aucune vidéo pour le moment'}
        </span>
      </Link>

      {isOwner && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Déplacer vers le haut"
          >
            <svg className={styles.upIcon} aria-hidden="true">
              <use href="/icons.svg#icon-chevron-down" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Déplacer vers le bas"
          >
            <svg className={styles.icon} aria-hidden="true">
              <use href="/icons.svg#icon-chevron-down" />
            </svg>
          </button>
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            Modifier
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
            Supprimer
          </Button>
        </div>
      )}
    </li>
  )
}
