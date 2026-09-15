import { useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'
import styles from './Textarea.module.css'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  helperText?: string
  errorText?: string
}

/**
 * Multi-line counterpart to `Input`, sharing its label, helper text, and
 * error handling so forms stay visually consistent.
 */
export function Textarea({ label, helperText, errorText, id, className, ...rest }: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const hasError = Boolean(errorText)

  return (
    <div className={cn(styles.field, className)}>
      <label htmlFor={textareaId} className={styles.label}>
        {label}
      </label>
      <textarea
        id={textareaId}
        className={cn(styles.textarea, hasError && styles.textareaError)}
        aria-invalid={hasError}
        aria-describedby={errorText ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
        {...rest}
      />
      {errorText ? (
        <p id={`${textareaId}-error`} className={styles.errorText}>
          {errorText}
        </p>
      ) : helperText ? (
        <p id={`${textareaId}-helper`} className={styles.helperText}>
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
