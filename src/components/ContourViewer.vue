<script setup lang="ts">
import { defineAsyncComponent, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { downloadText, exportJson } from '../lib/export'
import {
  edgePath,
  formatNumber as fmt,
  geometryBounds,
  type GeometryResult,
  type Vertex,
} from '../lib/geometry'
const SolidViewer = defineAsyncComponent(() => import('./SolidViewer.vue'))
const viewMode = ref<'2d' | '3d'>('2d')
const props = defineProps<{ geometry: GeometryResult; dxf: string }>()
const exportError = ref('')
function download(format: 'json' | 'dxf') {
  exportError.value = ''
  try {
    downloadText(
      format === 'json' ? exportJson(props.geometry) : props.dxf,
      `cadaico-contour.${format}`,
      format === 'json' ? 'application/json' : 'application/dxf',
    )
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : 'Unable to export this contour.'
  }
}
const svg = ref<SVGSVGElement | null>(null)
const labels = ref(true)
const grid = ref(true)
const selected = ref<string | null>(null)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const viewport = ref({ width: 700, height: 460 })
const box = computed(() => geometryBounds(props.geometry))
const base = computed(() => {
  const b = box.value
  const aspect = viewport.value.width / viewport.value.height
  const width = Math.max(b.maxX - b.minX, (b.maxY - b.minY) * aspect, 1) * 1.5
  return { width, height: width / aspect, cx: (b.maxX + b.minX) / 2, cy: -(b.maxY + b.minY) / 2 }
})
const view = computed(() => {
  const width = base.value.width / zoom.value,
    height = base.value.height / zoom.value
  return {
    x: base.value.cx - width / 2 + pan.value.x,
    y: base.value.cy - height / 2 + pan.value.y,
    width,
    height,
  }
})
const viewBox = computed(
  () => `${view.value.x} ${view.value.y} ${view.value.width} ${view.value.height}`,
)
const unit = computed(() => view.value.width / viewport.value.width)
const paths = computed(() =>
  props.geometry.edges.map((edge) => ({ edge, d: edgePath(edge, props.geometry.vertices) })),
)
const fillPath = computed(
  () => paths.value.map((p, i) => (i ? p.d.replace(/^M [^ ]+ [^ ]+ /, '') : p.d)).join(' ') + ' Z',
)
const step = computed(() => {
  const raw = view.value.width / 9,
    power = 10 ** Math.floor(Math.log10(raw)),
    fraction = raw / power
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
})
function ticks(start: number, extent: number) {
  const first = Math.ceil(start / step.value)
  return Array.from(
    { length: Math.min(40, Math.ceil(extent / step.value) + 1) },
    (_, i) => (first + i) * step.value,
  )
}
const xTicks = computed(() => ticks(view.value.x, view.value.width))
const yTicks = computed(() => ticks(view.value.y, view.value.height))
const chosen = computed(() => props.geometry.vertices.find((p) => p.id === selected.value))
function fit() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}
function zoomBy(factor: number) {
  zoom.value = Math.min(30, Math.max(0.25, zoom.value * factor))
}
function wheel(event: WheelEvent) {
  zoomBy(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.002))
}
let drag: { x: number; y: number; panX: number; panY: number; unit: number; id: number } | null =
  null
function pointerDown(event: PointerEvent) {
  if (event.button !== 0 || !svg.value) return
  drag = {
    x: event.clientX,
    y: event.clientY,
    panX: pan.value.x,
    panY: pan.value.y,
    unit: unit.value,
    id: event.pointerId,
  }
  svg.value.setPointerCapture(event.pointerId)
}
function pointerMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return
  pan.value = {
    x: drag.panX - (event.clientX - drag.x) * drag.unit,
    y: drag.panY - (event.clientY - drag.y) * drag.unit,
  }
}
function pointerUp(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) {
    const matrix = svg.value?.getScreenCTM()
    if (matrix) {
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
      let nearest: Vertex | undefined,
        distance = unit.value * 14
      for (const vertex of props.geometry.vertices) {
        const d = Math.hypot(vertex.x - p.x, -vertex.y - p.y)
        if (d < distance) {
          distance = d
          nearest = vertex
        }
      }
      selected.value = nearest?.id ?? null
    }
  }
  drag = null
  if (svg.value?.hasPointerCapture(event.pointerId))
    svg.value.releasePointerCapture(event.pointerId)
}
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect && rect.width > 0 && rect.height > 0)
      viewport.value = { width: rect.width, height: rect.height }
  })
  if (svg.value) observer.observe(svg.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(
  () => props.geometry,
  () => {
    fit()
    selected.value = null
  },
)
</script>

<template>
  <div class="contour-viewer">
    <div class="export-toolbar">
      <span>Export contour · mm</span>
      <div class="viewer-buttons">
        <button type="button" @click="download('json')">Download JSON ↓</button>
        <button type="button" class="dxf-button" @click="download('dxf')">Download DXF ↓</button>
      </div>
    </div>
    <p v-if="exportError" role="alert" class="export-error">{{ exportError }}</p>
    <div class="view-switch" role="group" aria-label="Contour view">
      <button type="button" :aria-pressed="viewMode === '2d'" @click="viewMode = '2d'">
        2D contour</button
      ><button type="button" :aria-pressed="viewMode === '3d'" @click="viewMode = '3d'">
        3D preview
      </button>
    </div>
    <SolidViewer v-if="viewMode === '3d'" :geometry="geometry" />
    <div v-show="viewMode === '2d'">
      <div class="viewer-toolbar">
        <div class="viewer-toggles">
          <label><input v-model="labels" type="checkbox" /> Coordinates</label
          ><label><input v-model="grid" type="checkbox" /> Grid</label>
        </div>
        <div class="viewer-buttons">
          <button type="button" aria-label="Zoom out" @click="zoomBy(1 / 1.25)">−</button
          ><button type="button" aria-label="Zoom in" @click="zoomBy(1.25)">+</button
          ><button type="button" @click="fit">Fit to view</button>
        </div>
      </div>
      <svg
        ref="svg"
        class="contour-canvas"
        :viewBox="viewBox"
        role="img"
        aria-label="Calculated contour with vertices, straight lines and circular arcs. Vertex coordinates are listed below."
        @wheel.prevent="wheel"
        @pointerdown="pointerDown"
        @pointermove="pointerMove"
        @pointerup="pointerUp"
        @pointercancel="drag = null"
        @lostpointercapture="drag = null"
      >
        <rect :x="view.x" :y="view.y" :width="view.width" :height="view.height" fill="#f8faf4" />
        <g v-if="grid" stroke="#e2e8d9" stroke-width="1">
          <line
            v-for="x in xTicks"
            :key="`x${x}`"
            :x1="x"
            :x2="x"
            :y1="view.y"
            :y2="view.y + view.height"
            vector-effect="non-scaling-stroke"
          />
          <line
            v-for="y in yTicks"
            :key="`y${y}`"
            :y1="y"
            :y2="y"
            :x1="view.x"
            :x2="view.x + view.width"
            vector-effect="non-scaling-stroke"
          />
          <line
            x1="0"
            x2="0"
            :y1="view.y"
            :y2="view.y + view.height"
            stroke="#b3c0a3"
            vector-effect="non-scaling-stroke"
          />
          <line
            y1="0"
            y2="0"
            :x1="view.x"
            :x2="view.x + view.width"
            stroke="#b3c0a3"
            vector-effect="non-scaling-stroke"
          />
        </g>
        <path :d="fillPath" fill="#e8efd9" fill-opacity=".7" />
        <path
          v-for="p in paths"
          :key="p.edge.id"
          :d="p.d"
          fill="none"
          :stroke="p.edge.type === 'arc' ? '#91ac2b' : '#235b50'"
          stroke-width="2.5"
          vector-effect="non-scaling-stroke"
        >
          <title>
            {{ p.edge.id }} ·
            {{
              p.edge.type === 'arc'
                ? `Radius ${fmt(p.edge.radius)} mm · ${fmt(p.edge.sweep_angle_degrees)}°`
                : `Length ${fmt(p.edge.length)} mm`
            }}
          </title>
        </path>
        <g
          v-for="p in geometry.vertices"
          :key="p.id"
          :transform="`translate(${p.x},${-p.y}) scale(${unit})`"
        >
          <circle
            :r="selected === p.id ? 6 : 3.5"
            :fill="selected === p.id ? '#91ac2b' : '#173e39'"
            stroke="#fff"
            stroke-width="1.5"
          />
          <text
            v-if="labels || selected === p.id"
            x="8"
            :y="p.y < 0 ? 21 : -12"
            fill="#173e39"
            stroke="#f8faf4"
            stroke-width="4"
            paint-order="stroke"
            font-size="11"
            font-family="Manrope, Segoe UI, sans-serif"
          >
            {{ p.id }} ({{ fmt(p.x) }}; {{ fmt(p.y) }})
          </text>
        </g>
      </svg>
      <div class="viewer-legend">
        <span><i class="line-key"></i> Lines</span><span><i class="arc-key"></i> Arcs</span
        ><span>mm · X → · Y ↑</span>
      </div>
      <p class="viewer-hint">Scroll to zoom · drag to pan · select a point</p>
      <p v-if="chosen" class="point-selection" role="status">
        {{ chosen.id }} · X {{ fmt(chosen.x) }} mm · Y {{ fmt(chosen.y) }} mm
      </p>
      <details class="geometry-details">
        <summary>
          Vertices & edges
          <span>{{ geometry.vertices.length }} points · {{ geometry.edges.length }} edges</span>
        </summary>
        <div class="table-scroll">
          <table>
            <caption>
              Vertex coordinates · mm
            </caption>
            <thead>
              <tr>
                <th>Point</th>
                <th>X</th>
                <th>Y</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in geometry.vertices"
                :key="p.id"
                :class="{ selected: selected === p.id }"
              >
                <td>
                  <button type="button" :aria-pressed="selected === p.id" @click="selected = p.id">
                    {{ p.id }}
                  </button>
                </td>
                <td>{{ fmt(p.x) }}</td>
                <td>{{ fmt(p.y) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="table-scroll">
          <table>
            <caption>
              Edge dimensions
            </caption>
            <thead>
              <tr>
                <th>Edge</th>
                <th>Points</th>
                <th>Type</th>
                <th>Dimensions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="edge in geometry.edges" :key="edge.id">
                <td>{{ edge.id }}</td>
                <td>{{ edge.from }} → {{ edge.to }}</td>
                <td>{{ edge.type }}</td>
                <td>
                  {{
                    edge.type === 'line'
                      ? `${fmt(edge.length)} mm`
                      : `R ${fmt(edge.radius)} mm · ${fmt(edge.sweep_angle_degrees)}° · ${edge.clockwise ? 'CW' : 'CCW'}`
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.view-switch {
  display: flex;
  gap: 4px;
  width: fit-content;
  background: #edf2e4;
  border-radius: 9px;
  padding: 4px;
  margin-bottom: 18px;
}
.view-switch button {
  border: 0;
  background: transparent;
  padding: 8px 16px;
}
.view-switch button[aria-pressed='true'] {
  background: #fff;
  color: #244327;
  box-shadow: 0 1px 4px #254d3414;
  font-weight: 700;
}
.export-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  border-bottom: 1px solid #e3e8df;
  padding-bottom: 16px;
  margin-bottom: 16px;
}
.export-toolbar > span {
  font-size: 11px;
  color: #71806b;
}
.export-toolbar .dxf-button {
  background: #bed66a;
  border-color: #bed66a;
  color: #244327;
  font-weight: 700;
}
.export-toolbar .dxf-button:hover {
  background: #aec955;
}
.export-error {
  font-size: 12px;
  color: #af3737;
}
.contour-viewer {
  min-width: 0;
}
.viewer-toolbar,
.viewer-toggles,
.viewer-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.viewer-toolbar {
  justify-content: space-between;
  margin-bottom: 16px;
}
.viewer-toggles {
  font-size: 11px;
  color: #71806b;
}
.viewer-toggles label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}
input {
  accent-color: #829f31;
}
button {
  border: 1px solid #dce4d3;
  background: #fff;
  border-radius: 7px;
  color: #345343;
  padding: 7px 10px;
  font-size: 11px;
}
button:hover {
  background: #edf2e4;
}
.viewer-buttons {
  gap: 6px;
}
.contour-canvas {
  width: 100%;
  height: 420px;
  display: block;
  border: 1px solid #e2e8d9;
  border-radius: 12px;
  touch-action: none;
  cursor: grab;
  overflow: hidden;
}
.contour-canvas:active {
  cursor: grabbing;
}
.viewer-legend {
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
  margin: 15px 0 8px;
  font-size: 10px;
  color: #76856d;
}
.viewer-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.viewer-legend span:last-child {
  margin-left: auto;
}
i {
  width: 18px;
  height: 3px;
  display: inline-block;
}
.line-key {
  background: #235b50;
}
.arc-key {
  background: #91ac2b;
}
.viewer-hint {
  font-size: 10px;
  color: #8b9684;
  margin: 0;
}
.point-selection {
  font-size: 12px;
  background: #edf2e4;
  padding: 10px;
  border-radius: 7px;
}
.geometry-details {
  border-top: 1px solid #e3e8df;
  margin-top: 20px;
  padding-top: 16px;
}
summary {
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
summary span {
  font-weight: 400;
  color: #819177;
  margin-left: 8px;
  font-size: 10px;
}
.table-scroll {
  max-height: 260px;
  overflow: auto;
  margin-top: 16px;
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
caption {
  text-align: left;
  font-weight: 600;
  padding-bottom: 10px;
}
th,
td {
  text-align: left;
  border-bottom: 1px solid #edf0e8;
  padding: 8px;
}
th {
  font-weight: 500;
  color: #7e8a74;
}
.selected {
  background: #edf2e4;
}
@media (max-width: 600px) {
  .contour-canvas {
    height: 340px;
  }
}
</style>
