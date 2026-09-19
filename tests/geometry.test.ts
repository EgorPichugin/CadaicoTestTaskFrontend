import assert from 'node:assert/strict'
import { test } from 'node:test'
import { edgePath, geometryBounds, parseGeometry, type GeometryResult, type Arc } from '../src/lib/geometry.ts'
const arc: Arc = { id: 'e1', type: 'arc', from: 'p0', to: 'p1', center: { x: 0, y: 0 }, radius: 1, clockwise: true, sweep_angle_degrees: 270, shape: 'out', arc_size: 'major' }
const geometry: GeometryResult = { status: 'Success', units: 'mm', is_closed: true, vertices: [{ id: 'p0', x: 1, y: 0 }, { id: 'p1', x: 0, y: 1 }], edges: [arc, { id: 'e2', type: 'line', from: 'p1', to: 'p0', length: Math.SQRT2 }], issues: [] }
test('major clockwise arcs include extrema beyond their endpoints', () => {
  const b = geometryBounds(geometry)
  assert.equal(b.minX, -1)
  assert.equal(b.minY, -1)
  assert.equal(b.maxX, 1)
  assert.equal(b.maxY, 1)
})
test('SVG arc flags preserve major arcs and invert the Y axis', () => {
  assert.equal(edgePath(arc, geometry.vertices), 'M 1 0 A 1 1 0 1 1 0 -1')
  assert.equal(edgePath({ ...arc, clockwise: false, sweep_angle_degrees: 90, arc_size: 'minor' }, geometry.vertices), 'M 1 0 A 1 1 0 0 0 0 -1')
})
test('minor arc bounds do not include the rest of its circle', () => {
  const b = geometryBounds({ ...geometry, edges: [{ ...arc, clockwise: false, sweep_angle_degrees: 90 }, geometry.edges[1]!] })
  assert.equal(b.minX, 0)
  assert.equal(b.minY, 0)
})
test('validated successful and unresolved results remain distinct', () => {
  assert.equal(parseGeometry(geometry).status, 'Success')
  for (const status of ['Unresolved', 'Ambiguous', 'Invalid']) {
    assert.equal(parseGeometry({ ...geometry, status, is_closed: false, vertices: [], edges: [], issues: [{ target: null, reason: 'Missing dimensions' }] }).status, status)
  }
})
test('invalid geometry never reaches the viewer', () => {
  assert.throws(() => parseGeometry({ ...geometry, vertices: [] }))
  assert.throws(() => parseGeometry({ ...geometry, vertices: [{ id: 'p0', x: Infinity, y: 0 }] }))
  assert.throws(() => parseGeometry({ ...geometry, edges: [arc, { ...geometry.edges[1], from: 'missing' }] }))
  assert.throws(() => parseGeometry({ ...geometry, status: 'Unresolved' }))
  assert.throws(() => parseGeometry({ ...geometry, edges: [{ ...arc, radius: -1 }, geometry.edges[1]] }))
  assert.throws(() => parseGeometry('<html>Bad gateway</html>'))
})
