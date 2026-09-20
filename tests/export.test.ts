import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exportJson } from '../src/lib/export.ts'
import type { GeometryResult } from '../src/lib/geometry.ts'

const fixture: GeometryResult = {
  status: 'Success',
  units: 'mm',
  is_closed: true,
  vertices: [
    { id: 'p0', x: 0, y: 0 },
    { id: 'p1', x: 1, y: 0 },
  ],
  edges: [{ id: 'e1', type: 'line', from: 'p0', to: 'p1', length: 1 }],
  issues: [],
}

test('JSON preserves the complete server geometry', () => {
  const data = { ...fixture, profile: { view: 'front', half: 'upper' } }
  assert.deepEqual(JSON.parse(exportJson(data)), data)
})
