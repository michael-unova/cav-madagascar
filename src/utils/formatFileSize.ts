const UNITS = ['o', 'Ko', 'Mo', 'Go'] as const

/** Formats a byte count for display in French, for example "12,4 Mo". */
export function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return '0 o'
  }

  let value = sizeBytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const formatted = unitIndex === 0 ? String(Math.round(value)) : value.toFixed(1).replace('.', ',')

  return `${formatted} ${UNITS[unitIndex]}`
}
