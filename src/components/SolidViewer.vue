<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import type { GeometryResult } from '../lib/geometry'
import { revolutionProfile } from '../lib/revolution'
const props = defineProps<{ geometry: GeometryResult }>()
const host = ref<HTMLDivElement | null>(null)
const error = ref('')
let renderer: THREE.WebGLRenderer | undefined
let controls: OrbitControls | undefined
let observer: ResizeObserver | undefined
let mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 10000)
let radius = 1
function render() {
  if (renderer && !error.value) renderer.render(scene, camera)
}
function reset() {
  const distance =
    (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) *
    Math.max(1, 1 / camera.aspect) *
    1.15
  camera.position.copy(new THREE.Vector3(1.3, 0.85, 1.7).normalize().multiplyScalar(distance))
  camera.near = Math.max(radius / 1000, 0.00001)
  camera.far = distance * 100
  camera.updateProjectionMatrix()
  controls?.target.set(0, 0, 0)
  controls?.update()
  render()
}
function zoom(factor: number) {
  if (!controls) return
  const offset = camera.position.clone().sub(controls.target)
  offset.setLength(
    THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance),
  )
  camera.position.copy(controls.target).add(offset)
  controls.update()
  render()
}
function build() {
  if (!renderer) return
  error.value = ''
  if (mesh) {
    scene.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.dispose()
    mesh = undefined
  }
  try {
    const profile = revolutionProfile(props.geometry)
    const lathe = new THREE.LatheGeometry(
      profile.map((p) => new THREE.Vector2(p.y, p.x)),
      128,
    )
    const geometry = toCreasedNormals(lathe, Math.PI / 6)
    lathe.dispose()
    geometry.rotateZ(-Math.PI / 2)
    geometry.center()
    geometry.computeBoundingSphere()
    radius = Math.max(geometry.boundingSphere?.radius ?? 1, 0.0001)
    mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: '#9aaa7d', metalness: 0.25, roughness: 0.38 }),
    )
    scene.add(mesh)
    if (controls) {
      controls.minDistance = radius * 1.15
      controls.maxDistance = radius * 30
    }
    reset()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to build the 3D preview.'
  }
}
function lostContext(event: Event) {
  event.preventDefault()
  error.value = '3D graphics were interrupted. Switch to 2D and back to retry.'
}
onMounted(() => {
  if (!host.value) return
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor('#f8faf4', 1)
    renderer.domElement.setAttribute(
      'aria-label',
      '3D external shape. Drag to rotate, scroll to zoom.',
    )
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.addEventListener('webglcontextlost', lostContext)
    host.value.append(renderer.domElement)
    scene.add(new THREE.HemisphereLight('#ffffff', '#586947', 2.4))
    const key = new THREE.DirectionalLight('#ffffff', 3)
    key.position.set(3, 5, 4)
    scene.add(key)
    const fill = new THREE.DirectionalLight('#eef7db', 2)
    fill.position.set(-4, 1, -3)
    scene.add(fill)
    controls = new OrbitControls(camera, renderer.domElement)
    controls.addEventListener('change', render)
    observer = new ResizeObserver(() => {
      if (!host.value || !renderer) return
      const { width, height } = host.value.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height)
      camera.aspect = width / height
      reset()
    })
    observer.observe(host.value)
    build()
  } catch {
    error.value =
      '3D preview is unavailable in this browser. You can still use the 2D contour and downloads.'
  }
})
watch(() => props.geometry, build)
onBeforeUnmount(() => {
  observer?.disconnect()
  controls?.dispose()
  mesh?.geometry.dispose()
  mesh?.material.dispose()
  renderer?.domElement.removeEventListener('webglcontextlost', lostContext)
  renderer?.dispose()
  renderer?.forceContextLoss()
  renderer?.domElement.remove()
})
</script>
<template>
  <div class="solid-viewer">
    <div class="solid-toolbar">
      <span>360° revolution · X axis</span>
      <div>
        <button type="button" aria-label="Zoom out 3D" :disabled="!!error" @click="zoom(1.25)">
          −</button
        ><button type="button" aria-label="Zoom in 3D" :disabled="!!error" @click="zoom(0.8)">
          +</button
        ><button type="button" :disabled="!!error" @click="reset">Reset view</button>
      </div>
    </div>
    <div class="solid-stage">
      <div ref="host" class="solid-canvas"></div>
      <p v-if="error" class="solid-error" role="alert">{{ error }}</p>
    </div>
    <p class="solid-hint">Drag to rotate · scroll or pinch to zoom · right-drag to pan</p>
    <p class="solid-note">External shape preview only. Holes and threads are not included.</p>
  </div>
</template>
<style scoped>
.solid-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  color: #71806b;
  font-size: 11px;
}
.solid-toolbar > div {
  display: flex;
  gap: 6px;
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
.solid-stage {
  position: relative;
  border: 1px solid #e2e8d9;
  border-radius: 12px;
  overflow: hidden;
  background: #f8faf4;
}
.solid-canvas {
  height: 420px;
  width: 100%;
  touch-action: none;
  cursor: grab;
}
.solid-canvas:active {
  cursor: grabbing;
}
.solid-canvas :deep(canvas) {
  display: block;
}
.solid-error {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  padding: 30px;
  text-align: center;
  font-size: 13px;
  color: #71806b;
  background: #f8faf4;
}
.solid-hint {
  font-size: 10px;
  color: #8b9684;
  margin: 14px 0;
}
.solid-note {
  font-size: 11px;
  line-height: 1.7;
  color: #71806b;
  padding: 12px;
  background: #f0f4e8;
  border-radius: 8px;
}
@media (max-width: 600px) {
  .solid-canvas {
    height: 340px;
  }
}
</style>
