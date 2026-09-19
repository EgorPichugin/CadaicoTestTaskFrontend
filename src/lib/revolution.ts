import type { GeometryResult, Point } from './geometry'

/** Upper half only; the second half in the API response is its reflection. */
export function revolutionProfile(geometry: GeometryResult): Point[] {
  if (geometry.status !== 'Success' || !geometry.is_closed)
    throw new Error('A complete contour is required for 3D preview.')
  const vertices = new Map(geometry.vertices.map((p) => [p.id, p]))
  const first = vertices.get(geometry.edges[0]?.from ?? '')
  if (!first || Math.abs(first.y) > 1e-7)
    throw new Error('The profile must start on the rotation axis.')
  const points: Point[] = [{ x: first.x, y: 0 }]
  for (const edge of geometry.edges) {
    const start = vertices.get(edge.from)!,
      end = vertices.get(edge.to)!
    if (!start || !end) throw new Error('The contour contains a missing point.')
    if (edge.type === 'arc') {
      const angle = Math.atan2(start.y - edge.center.y, start.x - edge.center.x)
      const sweep = ((edge.sweep_angle_degrees * Math.PI) / 180) * (edge.clockwise ? -1 : 1)
      const steps = Math.max(2, Math.ceil(edge.sweep_angle_degrees))
      for (let i = 1; i < steps; i++) {
        const a = angle + (sweep * i) / steps
        points.push({
          x: edge.center.x + edge.radius * Math.cos(a),
          y: edge.center.y + edge.radius * Math.sin(a),
        })
      }
    }
    points.push({ x: end.x, y: Math.abs(end.y) < 1e-7 ? 0 : end.y })
    if (points.some((p) => p.y < -1e-7))
      throw new Error('The upper profile crosses the rotation axis.')
    if (Math.abs(end.y) < 1e-7) {
      if (points.length < 3 || !points.some((p) => p.y > 1e-7))
        throw new Error('The profile has no volume.')
      return points.map((p) => ({ x: p.x, y: Math.max(0, p.y) }))
    }
  }
  throw new Error('The upper profile does not end on the rotation axis.')
}
