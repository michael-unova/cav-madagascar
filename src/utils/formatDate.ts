const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** Formats an ISO date string for display, for example "3 mars 2026". */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return dateFormatter.format(date)
}
