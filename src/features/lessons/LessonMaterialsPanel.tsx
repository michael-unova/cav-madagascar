import { useRef, useState, type ChangeEvent } from 'react'
import { Card } from '../../components/Card/Card'
import { Button } from '../../components/Button/Button'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { ErrorState } from '../../components/ErrorState/ErrorState'
import {
  MAX_MATERIAL_SIZE_BYTES,
  addLessonMaterial,
  getLessonFileUrl,
  isAllowedMaterialType,
  removeLessonMaterial,
} from '../../lib/firebase/lessonStorage'
import { getStorageErrorMessage } from '../../lib/firebase/storageErrors'
import { formatFileSize } from '../../utils/formatFileSize'
import type { Lesson, LessonMaterial } from '../../types'
import styles from './LessonMaterialsPanel.module.css'

export interface LessonMaterialsPanelProps {
  lesson: Lesson
  materials: LessonMaterial[]
  isOwner: boolean
  /** Re-runs the parent's data load, since the materials list changed. */
  onChanged: () => void
}

export function LessonMaterialsPanel({ lesson, materials, isOwner, onChanged }: LessonMaterialsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setErrorMessage(null)

    if (!isAllowedMaterialType(file.type)) {
      setErrorMessage("Ce type de fichier n'est pas pris en charge (PDF, image, document Office, texte, ZIP).")
      return
    }
    if (file.size > MAX_MATERIAL_SIZE_BYTES) {
      setErrorMessage(`Ce fichier dépasse la taille maximale autorisée (${formatFileSize(MAX_MATERIAL_SIZE_BYTES)}).`)
      return
    }

    setIsUploading(true)
    setProgress(0)

    try {
      await addLessonMaterial(lesson, file, setProgress)
      onChanged()
    } catch (error) {
      setErrorMessage(getStorageErrorMessage(error))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = async (material: LessonMaterial) => {
    setErrorMessage(null)
    setDownloadingId(material.id)

    try {
      const url = await getLessonFileUrl(material.storagePath)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setErrorMessage(getStorageErrorMessage(error))
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (material: LessonMaterial) => {
    setErrorMessage(null)
    setDeletingId(material.id)

    try {
      await removeLessonMaterial(lesson.id, material.id, material.storagePath)
      onChanged()
    } catch (error) {
      setErrorMessage(getStorageErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>Supports de cours</h2>
        {isOwner && materials.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? `Envoi... ${progress}%` : 'Ajouter un support'}
          </Button>
        )}
      </div>

      {errorMessage && <ErrorState title="Action impossible" description={errorMessage} />}

      {materials.length === 0 ? (
        <EmptyState
          icon="icon-file"
          title="Aucun support pour le moment"
          description={
            isOwner
              ? 'Ajoutez des documents (PDF, présentations, images, ...) pour accompagner cette leçon.'
              : "Votre enseignant n'a pas encore ajouté de support à cette leçon."
          }
          action={
            isOwner ? (
              <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? `Envoi... ${progress}%` : 'Ajouter un support'}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className={styles.list}>
          {materials.map((material) => (
            <li key={material.id} className={styles.row}>
              <span className={styles.iconWrapper}>
                <svg className={styles.icon} aria-hidden="true">
                  <use href="/icons.svg#icon-file" />
                </svg>
              </span>
              <div className={styles.info}>
                <p className={styles.name}>{material.name}</p>
                <p className={styles.meta}>{formatFileSize(material.sizeBytes)}</p>
              </div>
              <div className={styles.rowActions}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(material)}
                  disabled={downloadingId === material.id}
                >
                  {downloadingId === material.id ? 'Ouverture...' : 'Télécharger'}
                </Button>
                {isOwner && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(material)}
                    disabled={deletingId === material.id}
                  >
                    {deletingId === material.id ? 'Suppression...' : 'Supprimer'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <input
          ref={fileInputRef}
          type="file"
          className={styles.hiddenInput}
          onChange={handleFileChange}
          disabled={isUploading}
        />
      )}
    </Card>
  )
}
