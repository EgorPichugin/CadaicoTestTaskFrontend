import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exportDxf, exportJson } from '../src/lib/export.ts'
import type { GeometryResult } from '../src/lib/geometry.ts'
const fixture: GeometryResult = { status: 'Success', units: 'mm', is_closed: true, vertices: [{id: 'p0', x: 1, y: 0}, {id: 'p1', x: 0, y: 1}], edges: [{ id: 'e1', type: 'arc', from: 'p0', to: 'p1', center: {x: 0, y: 0}, radius: 1, clockwise: true, sweep_angle_degrees: 270, shape: 'out', arc_size: 'major'}, {id: 'e2', type: 'line', from: 'p1', to: 'p0', length: Math.SQRT2}], issues: [] }
function pairs(text: string) { const lines = text.trim().split(/\r?\n/); return Array.from({length: lines.length / 2}, (_, i) => [Number(lines[i * 2]), lines[i * 2 + 1]] as const) }
function arcAngles(text: string) { const values = pairs(text); return [Number(values.find(([c]) => c === 50)?.[1]), Number(values.find(([c]) => c === 51)?.[1])] }
test('JSON preserves the complete server response including extra metadata', () => {
  const data = {...fixture, profile: {view: 'front', half: 'upper'}}
  assert.deepEqual(JSON.parse(exportJson(data)), data)
})
test('DXF declares mm and preserves native line/arc entities without screen labels', () => {
  const values = pairs(exportDxf(fixture))
  const unitsIndex = values.findIndex(([code, value]) => code === 9 && value === '$INSUNITS')
  assert.deepEqual(values[unitsIndex + 1], [70, '4'])
  assert.deepEqual(values.filter(([code, value]) => code === 0 && ['LINE', 'ARC'].includes(value!)).map(([,value]) => value), ['ARC', 'LINE'])
  assert.ok(!values.some(([,value]) => value === 'TEXT' || value === 'POINT'))
  assert.deepEqual(values.at(-1), [0, 'EOF'])
})
test('clockwise major arc is reversed without changing its 270 degree sweep', () => {
  const [start, end] = arcAngles(exportDxf(fixture))
  assert.equal(start, 90)
  assert.equal(end, 0)
  assert.equal((end! - start! + 360) % 360, 270)
})
test('counterclockwise minor arc preserves world coordinates and angle', () => {
  const data = structuredClone(fixture)
  const arc = data.edges[0]!
  if (arc.type !== 'arc') throw new Error('Invalid fixture')
  arc.clockwise = false; arc.sweep_angle_degrees = 90; arc.arc_size = 'minor'
  assert.deepEqual(arcAngles(exportDxf(data)), [0, 90])
})
test('unresolved geometry cannot produce a misleading CAD file', () => {
  assert.throws(() => exportDxf({...fixture, status: 'Unresolved', is_closed: false, vertices: [], edges: []}))
})
