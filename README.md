# Dawai Setu

Dawai Setu is a live medicine redistribution network for healthcare facilities across coastal Karnataka. It helps facility managers spot shortages, match nearby surplus stock, coordinate transfers, and track last-mile handoff.

## Judge Demo

- GitHub Pages frontend: `https://sumukhsjec2029.github.io/Dawai-Setu/`
- API service: `https://dawai-setu-api.onrender.com`

The public frontend is configured for demo mode and does not require a local database. The API supplies seeded mock facility, inventory, transfer, notification, and blood-bank data.

## Run Locally

```powershell
pnpm install
$env:PORT = 5000; pnpm --filter @workspace/api-server run dev
```

In a second terminal:

```powershell
$env:PORT = 5173; $env:BASE_PATH = "/"
pnpm --filter @workspace/dawai-setu run dev
```

Open `http://localhost:5173`.

## Deploy

### GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and deploys the frontend on every push to `main`. In the repository settings, enable **Pages → Source: GitHub Actions** once.

### Render API

The `render.yaml` blueprint deploys the mock-mode API. In Render, choose **New → Blueprint**, select this repository, and apply the blueprint. The frontend workflow already points to the expected API service URL.

## Architecture

- React, TypeScript, Vite, and Wouter frontend
- Express API with mock mode for reliable demos
- Drizzle/PostgreSQL support for a production database
- Zod schemas shared across API and frontend
- React Query for live polling and cache invalidation
