import { useRef, useState, type ChangeEvent } from 'react'
import { Card } from '../../components/Card/Card'
import { Button } from '../../components/Button/Button'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog'
import {
  MAX_VIDEO_SIZE_BYTES,
  isAllowedVideoType,
  removeLessonVideo,
  replaceLessonVideo,
} from '../../lib/firebase/lessonStorage'
import { getStorageErrorMessage } from '../../lib/firebase/storageErrors'
import { formatFileSize } from '../../utils/formatFileSize'
import type { Lesson } from '../../types'
import styles from './LessonVideoPanel.module.css'

export interface LessonVideoPanelProps {
  lesson: Lesson
  videoUrl: string | null
  isOwner: boolean
  /** Re-runs the parent's data load, since the lesson document changed. */
  onChanged: () => void
}

export function LessonVideoPanel({ lesson, videoUrl, isOwner, onChanged }: LessonVideoPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isRemoveOpen, setIsRemoveOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setErrorMessage(null)

    if (!isAllowedVideoType(file.type)) {
      setErrorMessage('Le fichier doit être une vidéo (MP4, WebM, MOV, ...).')
      return
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setErrorMessage(`La vidéo dépasse la taille maximale autorisée (${formatFileSize(MAX_VIDEO_SIZE_BYTES)}).`)
      return
    }

    setIsUploading(true)
    setProgress(0)

    try {
      await replaceLessonVideo(lesson, file, setProgress)
      onChanged()
    } catch (error) {
      setErrorMessage(getStorageErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = async () => {
    setIsRemoving(true)
    setErrorMessage(null)

    try {
      await removeLessonVideo(lesson)
      onChanged()
    } catch (error) {
      setErrorMessage(getStorageErrorMessage(error))
    } finally {
      setIsRemoving(false)
      setIsRemoveOpen(false)
    }
  }

  return (
    <Card className={styles.card}>
      <h2 className={styles.title}>Vidéo</h2>

      {errorMessage && <ErrorState title="Action impossible" description={errorMessage} />}

      {videoUrl ? (
        <>
          <video className={styles.video} src={videoUrl} controls preload="metadata" />
          <p className={styles.meta}>
            {lesson.videoName}
            {lesson.videoSizeBytes ? ` · ${formatFileSize(lesson.videoSizeBytes)}` : ''}
          </p>
        </>
      ) : isOwner ? (
        <EmptyState
          icon="icon-play"
          title="Aucune vidéo pour le moment"
          description="Ajoutez une vidéo pour que les étudiants puissent suivre cette leçon en ligne."
        />
      ) : (
        <EmptyState
          icon="icon-play"
          title="Vidéo indisponible"
          description="Votre enseignant n'a pas encore ajouté de vidéo à cette leçon."
        />
      )}

      {isOwner && (
        <div className={styles.actions}>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className={styles.hiddenInput}
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? `Envoi en cours... ${progress}%` : videoUrl ? 'Remplacer la vidéo' : 'Ajouter une vidéo'}
          </Button>
          {videoUrl && (
            <Button type="button" variant="ghost" onClick={() => setIsRemoveOpen(true)} disabled={isUploading}>
              Supprimer la vidéo
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={isRemoveOpen}
        title="Supprimer la vidéo"
        message="La vidéo de cette leçon sera définitivement supprimée. Les étudiants n'y auront plus accès."
        confirmLabel="Supprimer définitivement"
        pendingLabel="Suppression..."
        isPending={isRemoving}
        onConfirm={handleRemove}
        onClose={() => setIsRemoveOpen(false)}
      />
    </Card>
  )
}
