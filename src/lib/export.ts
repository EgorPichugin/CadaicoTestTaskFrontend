import type { GeometryResult } from './geometry'

export function exportJson(geometry: GeometryResult): string {
  return JSON.stringify(geometry, null, 2) + '\n'
}

export function exportDxf(geometry: GeometryResult): string {
  if (geometry.status !== 'Success' || !geometry.is_closed || !geometry.edges.length) {
    throw new Error('Only a successfully calculated closed contour can be exported as DXF.')
  }
  const pairs: (string | number)[] = []
  const add = (...values: (string | number)[]) => pairs.push(...values)
  const number = (value: number) => {
    if (!Number.isFinite(value)) throw new Error('The contour contains invalid coordinates.')
    return Object.is(value, -0) ? '0' : String(value)
  }
  const angle = (value: number) => ((value % 360) + 360) % 360
  const points = new Map(geometry.vertices.map((p) => [p.id, p]))
  add(
    0,
    'SECTION',
    2,
    'HEADER',
    9,
    '$ACADVER',
    1,
    'AC1015',
    9,
    '$INSUNITS',
    70,
    4,
    9,
    '$MEASUREMENT',
    70,
    1,
    0,
    'ENDSEC',
  )
  add(0, 'SECTION', 2, 'ENTITIES')
  let handle = 256
  for (const edge of geometry.edges) {
    const start = points.get(edge.from),
      end = points.get(edge.to)
    if (!start || !end) throw new Error('The contour references a missing vertex.')
    add(
      0,
      edge.type === 'line' ? 'LINE' : 'ARC',
      5,
      (handle++).toString(16).toUpperCase(),
      100,
      'AcDbEntity',
      8,
      '0',
    )
    if (edge.type === 'line') {
      add(
        100,
        'AcDbLine',
        10,
        number(start.x),
        20,
        number(start.y),
        30,
        0,
        11,
        number(end.x),
        21,
        number(end.y),
        31,
        0,
      )
    } else {
      if (edge.radius <= 0 || edge.sweep_angle_degrees <= 0 || edge.sweep_angle_degrees >= 360)
        throw new Error('The contour contains an invalid arc.')
      const fromAngle =
        (Math.atan2(start.y - edge.center.y, start.x - edge.center.x) * 180) / Math.PI
      // DXF arcs run counterclockwise in world XY. Reverse clockwise edges,
      // preserving the full sweep (including arcs larger than 180 degrees).
      const startAngle = edge.clockwise ? fromAngle - edge.sweep_angle_degrees : fromAngle
      const endAngle = edge.clockwise ? fromAngle : fromAngle + edge.sweep_angle_degrees
      add(
        100,
        'AcDbCircle',
        10,
        number(edge.center.x),
        20,
        number(edge.center.y),
        30,
        0,
        40,
        number(edge.radius),
        100,
        'AcDbArc',
        50,
        number(angle(startAngle)),
        51,
        number(angle(endAngle)),
      )
    }
  }
  add(0, 'ENDSEC', 0, 'EOF')
  return pairs.join('\r\n') + '\r\n'
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
