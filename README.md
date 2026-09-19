# CADAICO Frontend

Vue 3 + Vite + TypeScript. The interface is in English.

## Local development (Windows PowerShell)

Node.js ^22.18.0 or >=24.12.0 is required.
Start the backend in a separate terminal, following its README:

```powershell
cd fastapi-project
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --env-file .env
```

Then, from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the address printed by Vite (usually http://localhost:5173).
The development proxy forwards /api and /health to http://127.0.0.1:8000.

## Photo-to-contour workflow

1. Choose or drop one JPG, PNG or WebP image, up to 10 MB.
2. Review the photo, then click **Process drawing**.
3. The frontend sends multipart form field `file` to `POST /api/v1/extractions`.
4. A loading indicator appears while FastAPI extracts and calculates geometry.
5. A `Success` result displays the original photo next to the complete contour,
   with vertices, coordinates, straight lines and circular arcs. Scroll to zoom,
   drag to pan, use **Fit to view**, and expand **Vertices & edges** for dimensions.

The viewer uses equal X/Y scale and includes arc extrema when fitting the view.
Successful results offer **Download JSON** (the full geometry response) and
**Download DXF** (AutoCAD 2000 ASCII DXF with LINE and ARC entities in mm).
DXF contains the actual world-coordinate contour, without screen labels,
grid, photo or viewport zoom. Clockwise arcs are reversed to DXF's
counterclockwise convention while preserving their full sweep.
`Unresolved`, `Ambiguous`, and `Invalid` results show explanations, not guessed
geometry. HTTP errors preserve the photo and allow retrying. Requests time out
in the browser after four minutes. Cancelling stops waiting in the browser;
server-side analysis may continue and incur usage. No automatic retries run.
A successful replacement or removal clears the previous result. Photos and
results are kept only in page memory and disappear on refresh.

AI analysis uses the backend's configured provider and API quota. Secret API
keys belong only in the backend environment, never in frontend variables.

## Deployment

`npm run build` outputs static assets in `dist`. Production builds use
`https://cadaicotesttask.onrender.com` by default. Set `VITE_API_BASE_URL` to
override the backend origin (see `.env.example`). VITE variables are public and
embedded at build time.

## Checks

```powershell
npm run test
npm run lint
npm run build
npm run preview
```

Tests cover arc direction, major-arc bounds and response validation.
`lint` includes automatic fixes. `build` checks types and builds the app.
`preview` serves the build locally; it is not a production server.
`npm run format` formats source files.

## 3D preview

After a successful calculation, choose **3D preview** to revolve the upper
profile around the X axis. Drag to orbit, scroll/pinch to zoom, right-drag to
pan, or use the zoom buttons and **Reset view**. This shows only the external
shape, without holes or threads. Circular arcs are sampled at up to one-degree
intervals for the preview; the exact JSON/DXF geometry is unchanged.
Three.js loads on demand. WebGL is required only for 3D; 2D and exports remain
available when it is unavailable.
