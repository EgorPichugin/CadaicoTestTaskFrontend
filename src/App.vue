<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import ContourViewer from './components/ContourViewer.vue'
import { processDrawing } from './lib/api'
import type { GeometryResult } from './lib/geometry'

const processing = ref(false)
const processingError = ref('')
const result = ref<GeometryResult | null>(null)
let request: AbortController | null = null
const resultMessages = {
  Success: 'Your contour is ready',
  Unresolved: 'The contour could not be confirmed',
  Ambiguous: 'More than one contour is possible',
  Invalid: 'The drawing contains conflicting geometry',
}

function cancelRequest() {
  request?.abort()
}

async function submitDrawing() {
  if (!selectedFile.value || processing.value || loading.value) return
  const controller = new AbortController()
  request = controller
  processing.value = true
  processingError.value = ''
  result.value = null
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 240_000)
  try {
    const geometry = await processDrawing(selectedFile.value, controller.signal)
    if (request === controller) result.value = geometry
  } catch (error) {
    if (request === controller) {
      processingError.value = controller.signal.aborted
        ? timedOut
          ? 'Processing took too long. Please try again.'
          : 'Request cancelled. The server may still finish processing your drawing.'
        : error instanceof Error
          ? error.message
          : 'Processing failed. Please try again.'
    }
  } finally {
    window.clearTimeout(timer)
    if (request === controller) {
      processing.value = false
      request = null
    }
  }
}

const input = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const preview = ref('')
const error = ref('')
const dragDepth = ref(0)
const loading = ref(false)
let selection = 0
const selectedExample = ref<string | null>(null)
const examples = [
  { file: 'Drehteil.jpg', title: 'Drehteil', detail: 'Original task drawing' },
  { file: 'sample_1.jpg', title: 'Rounded nose', detail: 'Circular arc & steps' },
  { file: 'sample_2.png', title: 'Stepped shaft', detail: 'Three diameters' },
  { file: 'sample_6.png', title: 'Drawing photo', detail: 'A photographed profile' },
  { file: 'sample_7.jpg', title: 'Round ends', detail: 'Two circular radii' },
]
const exampleUrl = (file: string) => `${import.meta.env.BASE_URL}examples/${file}`
async function selectExample(file: string) {
  if (processing.value) return
  const current = ++selection
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(exampleUrl(file))
    if (!response.ok) throw new Error('Example unavailable')
    const blob = await response.blob()
    if (current !== selection) return
    await selectFiles(
      [new File([blob], file, { type: file.endsWith('.png') ? 'image/png' : 'image/jpeg' })],
      file,
    )
  } catch {
    if (current === selection)
      error.value = 'Unable to load this example. Please try again or choose your own photo.'
  } finally {
    if (current === selection) loading.value = false
  }
}
const fileSize = computed(() => {
  const bytes = selectedFile.value?.size ?? 0
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

async function selectFiles(files: FileList | File[] | null, example: string | null = null) {
  if (processing.value) return
  const current = ++selection
  error.value = ''
  loading.value = false
  if (!files?.length) return
  if (files.length !== 1) {
    error.value = 'Please select one photo at a time.'
    return
  }
  const file = files[0]!
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    error.value = 'Only JPG, PNG and WebP images are supported.'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    error.value = 'This file is too large. Please choose a photo up to 10 MB.'
    return
  }
  const url = URL.createObjectURL(file)
  loading.value = true
  const image = new Image()
  image.src = url
  try {
    await image.decode()
    if (current !== selection) {
      URL.revokeObjectURL(url)
      return
    }
    if (preview.value) URL.revokeObjectURL(preview.value)
    preview.value = url
    selectedFile.value = file
    selectedExample.value = example
    result.value = null
    processingError.value = ''
  } catch {
    URL.revokeObjectURL(url)
    if (current === selection) error.value = 'Unable to open this image. Please try another file.'
  } finally {
    if (current === selection) loading.value = false
  }
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  void selectFiles(target.files)
  target.value = ''
}

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  void selectFiles(event.dataTransfer?.files ?? null)
}

function removeFile() {
  request?.abort()
  request = null
  processing.value = false
  processingError.value = ''
  result.value = null
  selection++
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  selectedFile.value = null
  selectedExample.value = null
  error.value = ''
  loading.value = false
}

onBeforeUnmount(removeFile)
</script>

<template>
  <div class="page" @dragover.prevent @drop.prevent>
    <header class="header">
      <a class="brand" href="/" aria-label="CADAICO — Home"
        >CAD<span>AI</span>CO<span class="brand-dot">.</span></a
      >
      <div class="header-divider"></div>
      <span class="product-name">CAD Builder</span>
      <a
        class="about-link"
        href="https://www.cadai.co/en"
        target="_blank"
        rel="noopener noreferrer"
      >
        About CADAICO <span aria-hidden="true">↗</span>
      </a>
    </header>

    <div class="app-layout">
      <aside class="examples-panel" aria-labelledby="examples-title">
        <div class="examples-heading">
          <h2 id="examples-title">Try an example</h2>
          <p>Pick a drawing to start</p>
        </div>
        <div class="examples-list">
          <button
            v-for="(example, index) in examples"
            :key="example.file"
            type="button"
            class="example-card"
            :class="{ 'is-selected': selectedExample === example.file }"
            :aria-pressed="selectedExample === example.file"
            :aria-label="`Select ${example.title} example`"
            :disabled="processing"
            @click="selectExample(example.file)"
          >
            <div class="example-thumbnail">
              <img :src="exampleUrl(example.file)" :alt="example.title" loading="lazy" /><span
                class="example-number"
                >0{{ index + 1 }}</span
              ><span
                v-if="selectedExample === example.file"
                class="example-check"
                aria-hidden="true"
                >✓</span
              >
            </div>
            <span class="example-title">{{ example.title }}</span
            ><span class="example-detail">{{ example.detail }}</span>
          </button>
        </div>
        <p class="examples-note">Choose an example, then click <strong>Process drawing</strong>.</p>
      </aside>
      <main :class="{ 'has-workspace': processing || result || processingError }">
        <section class="intro" aria-labelledby="page-title">
          <div class="eyebrow"><span></span> FROM DRAWING TO DIGITAL GEOMETRY</div>
          <h1 id="page-title">Big ideas.<br /><span>Start with a drawing.</span></h1>
          <p class="description">
            Your first step to a digital contour starts with a photo.<br class="desktop-break" />
            Upload a drawing with clearly visible lines and dimensions.
          </p>
        </section>

        <div class="workspace" :class="{ 'is-active': processing || result || processingError }">
          <section class="upload-card" aria-labelledby="upload-title">
            <div class="card-heading">
              <div class="heading-label">
                <span class="step">01</span>
                <h2 id="upload-title">Upload your drawing</h2>
              </div>
              <span class="file-count">One image at a time</span>
            </div>
            <form @submit.prevent="submitDrawing">
              <input
                ref="input"
                class="visually-hidden"
                :disabled="processing"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose a photo of your drawing"
                aria-describedby="file-help upload-error"
                @change="onChange"
              />
              <div
                class="drop-zone"
                :class="{ 'is-dragging': dragDepth > 0, 'has-preview': preview }"
                :aria-busy="loading"
                @dragenter.prevent="dragDepth++"
                @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
                @dragover.prevent
                @drop.prevent="onDrop"
              >
                <template v-if="!preview">
                  <div class="upload-symbol" aria-hidden="true">
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M12 16V4m-4 4 4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
                    </svg>
                  </div>
                  <h3>
                    {{ dragDepth ? 'Drop to add your photo' : 'Drag and drop your photo here' }}
                  </h3>
                  <p class="drop-description">or choose a file from your device</p>
                  <button class="choose-button" type="button" @click="input?.click()">
                    Choose a photo <span aria-hidden="true">↗</span>
                  </button>
                  <p id="file-help" class="file-help">
                    JPG, PNG or WebP <span>·</span> up to 10 MB
                  </p>
                </template>
                <template v-else>
                  <img
                    class="image-preview"
                    :src="preview"
                    alt="Preview of your selected drawing"
                  />
                  <div class="preview-bar">
                    <div class="file-details">
                      <span class="file-name">{{ selectedFile?.name }}</span
                      ><span id="file-help" class="file-meta"
                        >{{ fileSize }} · Selected locally</span
                      >
                    </div>
                    <div class="preview-actions">
                      <button
                        type="button"
                        class="secondary-button"
                        :disabled="processing"
                        @click="input?.click()"
                      >
                        Replace</button
                      ><button
                        type="button"
                        class="remove-button"
                        :disabled="processing"
                        aria-label="Remove photo"
                        @click="removeFile"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </template>
              </div>
              <p v-if="loading" class="loading-message" role="status">Opening image…</p>
              <p id="upload-error" class="error-message" role="alert">{{ error }}</p>
              <button
                v-if="selectedFile"
                class="choose-button process-button"
                type="submit"
                :disabled="processing || loading"
              >
                <span v-if="processing" class="spinner small-spinner" aria-hidden="true"></span>
                {{
                  processing
                    ? 'Processing…'
                    : result || processingError
                      ? 'Process again'
                      : 'Process drawing'
                }}
                <span v-if="!processing" aria-hidden="true">↗</span>
              </button>
              <div class="privacy-note">
                <svg
                  aria-hidden="true"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
                </svg>
                Your photo is sent for AI analysis only when you click Process drawing.
              </div>
            </form>
          </section>
          <section
            v-if="processing || result || processingError"
            class="result-card"
            aria-labelledby="result-title"
            :aria-busy="processing"
          >
            <div class="card-heading">
              <div class="heading-label">
                <span class="step">02</span>
                <h2 id="result-title">Calculated contour</h2>
              </div>
              <span v-if="result?.status === 'Success'" class="success-badge">Complete · mm</span>
            </div>
            <div v-if="processing" class="processing-state" role="status" aria-live="polite">
              <span class="spinner" aria-hidden="true"></span>
              <h3>Bringing your drawing to life</h3>
              <p>
                Reading dimensions and calculating the contour.<br />This may take a few minutes.
              </p>
              <button type="button" class="secondary-button" @click="cancelRequest">
                Cancel request
              </button>
            </div>
            <div v-else-if="processingError" class="result-message" role="alert">
              <span class="message-symbol" aria-hidden="true">!</span>
              <h3>We couldn’t process this drawing</h3>
              <p>{{ processingError }}</p>
              <button type="button" class="choose-button" @click="submitDrawing">
                Try again <span aria-hidden="true">↗</span>
              </button>
            </div>
            <template v-else-if="result">
              <ContourViewer v-if="result.status === 'Success'" :geometry="result" />
              <div v-else class="result-message" role="status">
                <span class="message-symbol" aria-hidden="true">!</span>
                <h3>{{ resultMessages[result.status] }}</h3>
                <p>
                  No confirmed contour is available. Check that all dimensions are visible, then try
                  another photo.
                </p>
              </div>
              <div v-if="result.issues.length" class="result-issues">
                <h3>
                  {{
                    result.status === 'Success' ? 'Notes from the analysis' : 'What needs attention'
                  }}
                </h3>
                <ul>
                  <li v-for="(issue, index) in result.issues" :key="index">
                    <strong v-if="issue.target">{{ issue.target }}: </strong>{{ issue.reason }}
                  </li>
                </ul>
              </div>
            </template>
          </section>
        </div>
        <p class="photo-tip">
          <span aria-hidden="true">↳</span> For best results, photograph your drawing straight from
          above, without shadows.
        </p>
      </main>
    </div>

    <footer>
      <span>CADAICO <span class="footer-separator">/</span> The Chat-to-Design Company</span
      ><span class="footer-caption">Made for your ideas.</span>
    </footer>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

:root {
  font-family: 'Manrope', 'Segoe UI', sans-serif;
  color: #173e39;
  background: #f8faf6;
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  min-width: 320px;
}
button,
input {
  font: inherit;
}
button,
a {
  -webkit-tap-highlight-color: transparent;
}
button {
  cursor: pointer;
}
a {
  color: inherit;
  text-decoration: none;
}
button:focus-visible,
a:focus-visible {
  outline: 3px solid #809e23;
  outline-offset: 5px;
}
.page {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse at 85% 28%, #eaf0d755, transparent 48%);
}
.header {
  height: 96px;
  display: flex;
  align-items: center;
  gap: 25px;
  max-width: 1440px;
  width: 100%;
  padding: 0 64px;
  margin: 0 auto;
}
.brand {
  font-size: 29px;
  font-weight: 500;
  letter-spacing: -1.8px;
}
.brand > span {
  color: #91ac2b;
}
.brand .brand-dot {
  color: #173e39;
}
.header-divider {
  height: 22px;
  width: 1px;
  background: #d9dfd6;
}
.product-name {
  font-size: 13px;
  font-weight: 600;
  color: #738179;
}
.about-link {
  margin-left: auto;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  gap: 17px;
  align-items: center;
}
.about-link:hover {
  color: #728c24;
}
.about-link span {
  font-size: 20px;
}
main {
  width: 100%;
  max-width: 1000px;
  margin: auto;
  padding: 28px 32px 42px;
}
.intro {
  text-align: center;
}
.eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.eyebrow > span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #99b735;
  box-shadow: 0 0 0 4px #edf2df;
}
h1 {
  font-size: clamp(38px, 4.6vw, 62px);
  font-weight: 500;
  letter-spacing: -2.8px;
  line-height: 1.14;
  margin: 26px 0 22px;
}
h1 > span {
  color: #819d24;
}
.description {
  color: #758079;
  font-size: 14px;
  line-height: 1.9;
  margin: 0;
}
.upload-card {
  max-width: 716px;
  margin: 30px auto 0;
  padding: 26px;
  border-radius: 20px;
  border: 1px solid #e3e8df;
  background: #fff;
  box-shadow:
    0 12px 45px -24px #254d342d,
    0 2px 4px #1d3e2d03;
}
.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 0 22px;
}
.heading-label {
  display: flex;
  align-items: center;
  gap: 12px;
}
.step {
  width: 27px;
  height: 27px;
  border: 1px solid #e3e8dd;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: #7d8c70;
  font-size: 10px;
  font-weight: 700;
}
h2 {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.3px;
}
.file-count {
  font-size: 10px;
  color: #939a92;
}
.drop-zone {
  border: 1.5px dashed #ced9bd;
  border-radius: 12px;
  background: #f8faf4;
  padding: 24px 16px 22px;
  text-align: center;
  transition:
    background 0.2s,
    border-color 0.2s;
}
.drop-zone.is-dragging {
  background: #edf4d9;
  border-color: #86a328;
}
.drop-zone.is-dragging > * {
  pointer-events: none;
}
.upload-symbol {
  height: 56px;
  width: 56px;
  display: grid;
  place-items: center;
  margin: 0 auto 19px;
  border: 1px solid #e1e8d5;
  border-radius: 16px;
  background: #fff;
  color: #65813d;
  box-shadow: 0 4px 10px #45612405;
}
h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  letter-spacing: -0.3px;
}
.drop-description {
  font-size: 12px;
  color: #939c8e;
  margin: 0 0 23px;
}
.choose-button {
  border: 0;
  border-radius: 8px;
  background: #bed66a;
  color: #244327;
  padding: 13px 20px;
  display: inline-flex;
  align-items: center;
  gap: 24px;
  font-weight: 700;
  font-size: 12px;
  transition:
    background 0.2s,
    transform 0.2s;
}
.choose-button:hover {
  background: #aec955;
  transform: translateY(-1px);
}
.choose-button > span {
  font-size: 18px;
  line-height: 1;
}
.file-help {
  font-size: 10px;
  color: #939c8e;
  margin: 17px 0 0;
}
.file-help span {
  padding: 0 6px;
}
.privacy-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #92998f;
  font-size: 10px;
  margin-top: 19px;
}
.privacy-note svg {
  flex-shrink: 0;
}
.photo-tip {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 20px auto 0;
  font-size: 10px;
  line-height: 1.7;
  color: #939b8d;
  text-align: center;
}
.photo-tip > span {
  color: #7f9662;
  font-size: 16px;
  line-height: 1;
}
footer {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  margin: 0 64px;
  padding: 25px 0;
  border-top: 1px solid #e3e8df;
  color: #98a095;
  font-size: 10px;
}
.footer-separator {
  margin: 0 10px;
  color: #c3cbbb;
}
.footer-caption {
  color: #7f8d77;
}
.visually-hidden {
  position: absolute;
  height: 1px;
  width: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
form:has(input:focus-visible) .drop-zone {
  outline: 3px solid #809e23;
  outline-offset: 3px;
}
.drop-zone.has-preview {
  padding: 12px;
}
.image-preview {
  display: block;
  width: 100%;
  height: 240px;
  object-fit: contain;
  border-radius: 6px;
  background: #fff;
}
.preview-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 4px 4px;
  text-align: left;
}
.file-details {
  min-width: 0;
  display: grid;
  gap: 5px;
}
.file-name {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-meta {
  font-size: 10px;
  color: #7f8d77;
}
.preview-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.secondary-button,
.remove-button {
  background: #fff;
  border: 1px solid #dce4d3;
  border-radius: 7px;
  color: #456044;
  font-size: 11px;
  padding: 9px 12px;
}
.remove-button {
  font-size: 20px;
  line-height: 16px;
}
.secondary-button:hover,
.remove-button:hover {
  background: #edf2e4;
}
.error-message {
  margin: 12px 0 0;
  font-size: 12px;
  color: #af3737;
}
.error-message:empty {
  display: none;
}
.loading-message {
  font-size: 12px;
  color: #6c8135;
}
@media (min-width: 1600px) {
  main {
    padding-top: 80px;
    padding-bottom: 80px;
  }
}
@media (max-width: 600px) {
  .header {
    height: 78px;
    padding: 0 24px;
    gap: 14px;
  }
  .brand {
    font-size: 25px;
  }
  .product-name {
    font-size: 10px;
  }
  .about-link {
    font-size: 0;
    gap: 0;
  }
  .about-link span {
    font-size: 22px;
  }
  main {
    padding: 36px 20px 42px;
  }
  .eyebrow {
    font-size: 8px;
    letter-spacing: 1.1px;
  }
  h1 {
    font-size: clamp(33px, 7.6vw, 45px);
    letter-spacing: -1.7px;
  }
  .description {
    font-size: 12px;
    max-width: 340px;
    margin: auto;
  }
  .desktop-break {
    display: none;
  }
  .upload-card {
    padding: 17px;
    margin-top: 30px;
    border-radius: 16px;
  }
  .file-count {
    display: none;
  }
  h3 {
    font-size: 14px;
  }
  .drop-zone {
    padding: 28px 10px 23px;
  }
  .privacy-note {
    font-size: 9px;
    align-items: flex-start;
    line-height: 1.7;
    text-align: center;
  }
  .photo-tip {
    font-size: 9px;
    max-width: 300px;
  }
  footer {
    margin: 0 24px;
    font-size: 9px;
  }
  .footer-caption {
    display: none;
  }
  .preview-bar {
    flex-wrap: wrap;
  }
  .file-details {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
  }
}
.has-workspace {
  max-width: 1380px;
}
.workspace.is-active {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: 24px;
  align-items: start;
  margin-top: 30px;
}
.workspace.is-active .upload-card {
  width: 100%;
  margin: 0;
}
.workspace.is-active .image-preview {
  height: 420px;
}
.result-card {
  min-width: 0;
  background: #fff;
  border: 1px solid #e3e8df;
  border-radius: 20px;
  padding: 26px;
  box-shadow: 0 12px 45px -24px #254d342d;
}
.process-button {
  width: 100%;
  justify-content: center;
  margin-top: 18px;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}
.processing-state,
.result-message {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
}
.processing-state p,
.result-message p {
  font-size: 12px;
  line-height: 1.9;
  color: #7c8874;
  max-width: 350px;
  margin: 12px 0 24px;
}
.processing-state h3,
.result-message h3 {
  line-height: 1.6;
}
.spinner {
  display: inline-block;
  width: 42px;
  height: 42px;
  border: 3px solid #e6edd8;
  border-top-color: #89a62f;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 24px;
  flex-shrink: 0;
}
.small-spinner {
  width: 16px;
  height: 16px;
  border-width: 2px;
  margin: 0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.success-badge {
  font-size: 10px;
  color: #6a8429;
  background: #f0f5e4;
  border-radius: 20px;
  padding: 6px 10px;
}
.message-symbol {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #f4f0dc;
  color: #8c752b;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
  font-size: 22px;
}
.result-issues {
  margin-top: 20px;
  padding: 16px;
  background: #f9f8ee;
  border: 1px solid #ece8cd;
  border-radius: 10px;
}
.result-issues h3 {
  font-size: 12px;
}
.result-issues ul {
  font-size: 11px;
  line-height: 1.8;
  color: #7c795e;
  padding-left: 18px;
  margin-bottom: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 900px) {
  .workspace.is-active {
    grid-template-columns: 1fr;
    max-width: 716px;
    margin-left: auto;
    margin-right: auto;
  }
  .workspace.is-active .image-preview {
    height: 300px;
  }
}
@media (max-width: 600px) {
  .result-card {
    padding: 17px;
  }
  .workspace.is-active .image-preview {
    height: 240px;
  }
  .processing-state,
  .result-message {
    min-height: 280px;
    padding: 16px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 3s;
  }
}
.app-layout {
  display: grid;
  grid-template-columns: 162px minmax(0, 1fr);
  gap: 28px;
  width: 100%;
  max-width: 1640px;
  margin: 0 auto;
  padding: 12px 32px 0;
  flex: 1;
  align-items: start;
}
.app-layout main {
  min-width: 0;
}
.examples-panel {
  position: sticky;
  top: 24px;
  padding: 22px 0;
}
.examples-heading h2 {
  font-size: 13px;
}
.examples-heading p {
  font-size: 10px;
  color: #87917f;
  margin: 7px 0 18px;
}
.examples-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.example-card {
  width: 100%;
  text-align: left;
  border: 1px solid #e0e7d7;
  border-radius: 12px;
  background: #ffffffb8;
  padding: 8px;
  color: #244337;
  transition:
    border-color 0.15s,
    background 0.15s;
}
.example-card:hover:not(:disabled) {
  border-color: #a4bd61;
  background: #fff;
}
.example-card.is-selected {
  border-color: #91ac2b;
  background: #f0f5e4;
  box-shadow: 0 0 0 1px #91ac2b;
}
.example-thumbnail {
  position: relative;
  height: 83px;
  background: #fff;
  border-radius: 7px;
  overflow: hidden;
}
.example-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 6px;
  display: block;
}
.example-number {
  position: absolute;
  top: 4px;
  left: 4px;
  background: #ffffffed;
  color: #8a977e;
  font-size: 9px;
  border-radius: 4px;
  padding: 2px 4px;
}
.example-check {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 19px;
  height: 19px;
  display: grid;
  place-items: center;
  background: #bed66a;
  color: #244327;
  border-radius: 50%;
  font-size: 11px;
}
.example-title {
  display: block;
  font-size: 11px;
  font-weight: 700;
  margin: 10px 3px 4px;
}
.example-detail {
  display: block;
  font-size: 9px;
  color: #87917f;
  margin: 0 3px 4px;
}
.examples-note {
  font-size: 10px;
  line-height: 1.8;
  color: #87917f;
  margin: 16px 2px 0;
}
.examples-note strong {
  font-weight: 500;
  color: #60744d;
}
@media (max-width: 1100px) {
  .app-layout {
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 12px;
    padding-left: 24px;
    padding-right: 12px;
  }
  .app-layout .workspace.is-active {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .app-layout {
    display: flex;
    flex-direction: column;
    padding: 0;
    gap: 0;
  }
  .examples-panel {
    position: static;
    width: 100%;
    padding: 12px 20px 0;
  }
  .examples-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .examples-heading p {
    margin: 0 0 12px;
  }
  .examples-list {
    flex-direction: row;
    overflow-x: auto;
    padding: 2px 2px 8px;
    gap: 10px;
  }
  .example-card {
    flex: 0 0 132px;
  }
  .example-thumbnail {
    height: 70px;
  }
  .examples-note {
    display: none;
  }
}
</style>
