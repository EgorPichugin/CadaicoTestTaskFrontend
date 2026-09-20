import { parseDrawingArtifacts } from './geometry'

const DEFAULT_API_BASE_URL = 'https://cadaicotesttask.onrender.com'

export async function processDrawing(file: File, signal: AbortSignal) {
  const body = new FormData()
  body.append('file', file)
  const base = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')
  let response: Response
  try {
    response = await fetch(`${base}/api/v1/extractions`, { method: 'POST', body, signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error(
      'Cannot reach the processing server. Check your connection and make sure the backend is running.',
    )
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const fallback: Record<number, string> = {
      413: 'This image is too large. Please choose a photo up to 10 MB.',
      422: 'The drawing could not be processed. Try a clearer photo with visible dimensions.',
      502: 'Drawing analysis failed. Please try again.',
      503: 'Drawing analysis is not configured yet. Contact the administrator.',
      504: 'Processing timed out. Please try again.',
    }
    throw new Error(
      typeof data?.detail === 'string'
        ? data.detail
        : (fallback[response.status] ?? 'Processing failed. Please try again later.'),
    )
  }
  return parseDrawingArtifacts(data)
}
