const UNITS = ['B', 'KB', 'MB', 'GB']

export function formatBytes(bytes: number, precision = 1) {
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${unit === 0 ? value : value.toFixed(precision)} ${UNITS[unit]}`
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`

  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`

  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds % 60)}s`
}

export function formatClock(at: number) {
  const date = new Date(at)
  const pad = (part: number, size = 2) => String(part).padStart(size, '0')

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

export function formatPercent(fraction: number) {
  return `${Math.round(fraction * 100)}%`
}
