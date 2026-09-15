import { useId, type InputHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'
import styles from './Input.module.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  helperText?: string
  errorText?: string
  icon?: string
}

export function Input({ label, helperText, errorText, icon, id, className, ...rest }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hasError = Boolean(errorText)

  return (
    <div className={cn(styles.field, className)}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={cn(styles.inputWrapper, hasError && styles.inputWrapperError)}>
        {icon && (
          <svg className={styles.icon} aria-hidden="true">
            <use href={`/icons.svg#${icon}`} />
          </svg>
        )}
        <input
          id={inputId}
          className={styles.input}
          aria-invalid={hasError}
          aria-describedby={errorText ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...rest}
        />
      </div>
      {errorText ? (
        <p id={`${inputId}-error`} className={styles.errorText}>
          {errorText}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className={styles.helperText}>
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
