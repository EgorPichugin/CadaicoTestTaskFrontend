# CADAICO Frontend

Web interface for extracting an outer contour from a technical drawing. Upload an image, inspect the 2D contour and 3D preview, then download JSON and DXF. If the backend cannot build the contour, the interface shows the reported issues.

**[Live app](https://cadaico-client.vercel.app/)** · [Architecture, limits and demo GIF](https://github.com/EgorPichugin/CadaicoTestTask#cadaico-cad-builder)

Built with Vue, TypeScript and Three.js. Recognition, geometry calculation and DXF generation run on the backend. The 3D preview shows the external shape without internal holes or threads.

## Run locally

Requires Git and **Node.js 22.18+ within v22, or 24.12+**. First [set up and start the backend](https://github.com/EgorPichugin/CadaicoTestTask#run-the-web-service).

In a separate PowerShell terminal:

```powershell
git clone https://github.com/EgorPichugin/CadaicoTestTaskFrontend.git
cd CadaicoTestTaskFrontend
npm ci
Copy-Item .env.example .env
```

Set the local backend address in `.env`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then run:

```powershell
npm run dev
```

Open the address printed by Vite, usually [http://localhost:5173](http://localhost:5173). Choose a JPG, PNG or WebP drawing up to 10 MB and click **Process drawing**.

Without an explicit API URL, the app connects to the hosted backend on Render. Keep the OpenAI API key in the backend only; frontend environment variables are public.

## Checks and build

```powershell
npm test
npm run build
```

The build checks TypeScript and writes the site to `dist/`. Set `VITE_API_BASE_URL` before building when deploying with a different backend.

Planned improvements, including manual contour editing, are listed in the [backend roadmap](https://github.com/EgorPichugin/CadaicoTestTask#todo).
