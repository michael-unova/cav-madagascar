interface SortableUser {
  displayName: string
  email: string
  createdAt?: Date
}

const byName = (a: SortableUser, b: SortableUser) =>
  a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }) || a.email.localeCompare(b.email, 'fr')

/** Admin list order: most recently created account first (accounts without a date go last). */
export function sortNewestFirst<T extends SortableUser>(users: T[]): T[] {
  return [...users].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0) || byName(a, b))
}

/** Export order: alphabetical by name, accents ignored (É sorts with E). */
export function sortAlphabetically<T extends SortableUser>(users: T[]): T[] {
  return [...users].sort(byName)
}
