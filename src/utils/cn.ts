export type ClassValue = string | false | null | undefined

/**
 * Joins truthy class names with a space. A small local alternative to
 * pulling in a classnames/clsx dependency for this project's needs.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
