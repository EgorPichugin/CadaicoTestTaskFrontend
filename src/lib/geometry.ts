export interface Point {
  x: number
  y: number
}
export interface Vertex extends Point {
  id: string
}
export interface Line {
  id: string
  type: 'line'
  from: string
  to: string
  length: number
}
export interface Arc {
  id: string
  type: 'arc'
  from: string
  to: string
  radius: number
  center: Point
  clockwise: boolean
  sweep_angle_degrees: number
  shape: 'in' | 'out'
  arc_size: 'minor' | 'semicircle' | 'major'
}
export type Edge = Line | Arc
export interface GeometryResult {
  status: 'Success' | 'Unresolved' | 'Ambiguous' | 'Invalid'
  units: 'mm'
  is_closed: boolean
  vertices: Vertex[]
  edges: Edge[]
  issues: { target: string | null; reason: string }[]
}
export interface DrawingArtifacts {
  geometry: GeometryResult
  dxf: string | null
}
export const formatNumber = (value: number) =>
  (Math.abs(value) < 0.0005 ? 0 : value).toLocaleString('en-US', { maximumFractionDigits: 3 })
const tau = Math.PI * 2

// Render in SVG coordinates: +Y points down, opposite to the geometry API.
export function edgePath(edge: Edge, vertices: Vertex[]) {
  const start = vertices.find((p) => p.id === edge.from)!
  const end = vertices.find((p) => p.id === edge.to)!
  const move = `M ${start.x} ${-start.y}`
  return edge.type === 'line'
    ? `${move} L ${end.x} ${-end.y}`
    : `${move} A ${edge.radius} ${edge.radius} 0 ${edge.sweep_angle_degrees > 180 ? 1 : 0} ${edge.clockwise ? 1 : 0} ${end.x} ${-end.y}`
}

export function geometryBounds(geometry: GeometryResult) {
  const samples: Point[] = [...geometry.vertices]
  const points = new Map(geometry.vertices.map((p) => [p.id, p]))
  for (const edge of geometry.edges) {
    if (edge.type !== 'arc') continue
    const point = points.get(edge.from)!
    const start = Math.atan2(point.y - edge.center.y, point.x - edge.center.x)
    const sweep = (edge.sweep_angle_degrees * Math.PI) / 180
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const delta = (((edge.clockwise ? start - angle : angle - start) % tau) + tau) % tau
      if (delta <= sweep + 1e-10)
        samples.push({
          x: edge.center.x + edge.radius * Math.cos(angle),
          y: edge.center.y + edge.radius * Math.sin(angle),
        })
    }
  }
  return samples.reduce(
    (b, p) => ({
      minX: Math.min(b.minX, p.x),
      maxX: Math.max(b.maxX, p.x),
      minY: Math.min(b.minY, p.y),
      maxY: Math.max(b.maxY, p.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  )
}

export function parseGeometry(value: unknown): GeometryResult {
  const fail = () => {
    throw new Error('The server returned an invalid contour. Please try again.')
  }
  if (!value || typeof value !== 'object') return fail()
  const g = value as GeometryResult
  if (
    !['Success', 'Unresolved', 'Ambiguous', 'Invalid'].includes(g.status) ||
    g.units !== 'mm' ||
    typeof g.is_closed !== 'boolean' ||
    !Array.isArray(g.vertices) ||
    !Array.isArray(g.edges) ||
    !Array.isArray(g.issues)
  )
    return fail()
  if (
    g.issues.some(
      (i) =>
        !i || typeof i.reason !== 'string' || (i.target !== null && typeof i.target !== 'string'),
    )
  )
    return fail()
  if (g.status !== 'Success') {
    if (g.is_closed || g.vertices.length || g.edges.length) return fail()
    return g
  }
  if (!g.is_closed || g.vertices.length < 2 || g.edges.length < 2) return fail()
  const point = (p: Point) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  if (g.vertices.some((p) => !point(p) || typeof p.id !== 'string')) return fail()
  const ids = new Set(g.vertices.map((p) => p.id))
  if (ids.size !== g.vertices.length || new Set(g.edges.map((e) => e?.id)).size !== g.edges.length)
    return fail()
  for (const [index, e] of g.edges.entries()) {
    if (
      !e ||
      typeof e.id !== 'string' ||
      !ids.has(e.from) ||
      !ids.has(e.to) ||
      e.to !== g.edges[(index + 1) % g.edges.length]?.from
    )
      return fail()
    if (e.type === 'line') {
      if (!Number.isFinite(e.length) || e.length <= 0) return fail()
    } else if (e.type === 'arc') {
      if (
        !point(e.center) ||
        !Number.isFinite(e.radius) ||
        e.radius <= 0 ||
        typeof e.clockwise !== 'boolean' ||
        !Number.isFinite(e.sweep_angle_degrees) ||
        e.sweep_angle_degrees <= 0 ||
        e.sweep_angle_degrees >= 360
      )
        return fail()
    } else return fail()
  }
  return g
}

export function parseDrawingArtifacts(value: unknown): DrawingArtifacts {
  const fail = () => {
    throw new Error('The server returned invalid drawing artifacts. Please try again.')
  }
  if (!value || typeof value !== 'object') return fail()
  const artifacts = value as { geometry?: unknown; dxf?: unknown }
  const geometry = parseGeometry(artifacts.geometry)
  if (geometry.status === 'Success') {
    if (typeof artifacts.dxf !== 'string' || !artifacts.dxf.trim()) return fail()
    return { geometry, dxf: artifacts.dxf }
  }
  if (artifacts.dxf !== null) return fail()
  return { geometry, dxf: null }
}
