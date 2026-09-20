import type { GeometryResult } from './geometry'

export function exportJson(geometry: GeometryResult): string {
  return JSON.stringify(geometry, null, 2) + '\n'
}

export function downloadText(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
