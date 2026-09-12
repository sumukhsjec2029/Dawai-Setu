# 🚀 Quick Start Guide - Dawai-Setu Hackathon Demo

## Prerequisites

- Node.js 24+ installed
- pnpm package manager (run: `npm install -g pnpm`)
- PostgreSQL database running locally or remote connection string

---

## Setup (First Time Only)

### 1. Install Dependencies
```bash
cd "c:\replit dawai\Dawai-Setu-Website"
pnpm install
```

### 2. Set Environment Variables
Create `.env.local` file in the root directory:

```env
# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/dawai_setu_db

# Frontend
PORT=5173
BASE_PATH=/

# Backend
API_PORT=5000
NODE_ENV=development

# CORS (optional, default: localhost:5173)
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Swiggy Genie (optional - leave blank for demo)
SWIGGY_GENIE_API_URL=
SWIGGY_GENIE_API_KEY=
```

### 3. Initialize Database
```bash
pnpm --filter @workspace/db run push
```

This creates tables and seeds sample data for testing.

---

## Running the Application

### Option 1: Run Both Frontend & Backend (Recommended for Demo)

**Terminal 1 - Backend API Server:**
```bash
cd "c:\replit dawai\Dawai-Setu-Website"
$env:PORT = 5000; $env:NODE_ENV = "development"
pnpm --filter @workspace/api-server run dev
```

Expected output:
```
Server listening { port: 5000 }
```

**Terminal 2 - Frontend Development Server:**
```bash
cd "c:\replit dawai\Dawai-Setu-Website"
$env:PORT = 5173; $env:BASE_PATH = "/"
pnpm --filter @workspace/dawai-setu run dev
```

Expected output:
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

**Then**: Open browser to http://localhost:5173

---

### Option 2: Run Only Frontend (If Backend Already Running)
```bash
cd "c:\replit dawai\Dawai-Setu-Website\artifacts\dawai-setu"
$env:PORT = 5173; $env:BASE_PATH = "/"
pnpm run dev
```

---

### Option 3: Production Build & Run
```bash
# Build everything
pnpm run build

# Run backend in production
cd "c:\replit dawai\Dawai-Setu-Website\artifacts\api-server"
$env:NODE_ENV = "production"; $env:PORT = 5000
pnpm run start

# In another terminal, serve frontend
cd "c:\replit dawai\Dawai-Setu-Website\artifacts\dawai-setu"
pnpm run serve
```

---

## Common Issues & Fixes

### ❌ "pnpm is not recognized"
```bash
npm install -g pnpm
```

### ❌ "PORT environment variable is required"
Set before running:
```bash
$env:PORT = 5000
$env:BASE_PATH = "/"
```

### ❌ "Cannot connect to database"
Check your `DATABASE_URL`:
- If using local PostgreSQL: `postgresql://postgres:password@localhost:5432/db_name`
- If using remote: Ensure IP whitelisting is configured

### ❌ "Frontend shows blank page"
1. Check browser console (F12) for errors
2. Verify backend is running: `curl http://localhost:5000/api/healthz`
3. Check CORS - make sure `ALLOWED_ORIGINS` includes `http://localhost:5173`

### ❌ "API calls failing in browser"
1. Open DevTools → Network tab
2. Check if requests going to `http://localhost:5000/api/...`
3. Look for CORS errors in console
4. Verify backend is accessible: `curl http://localhost:5000/api/healthz`

---

## Testing the Application

### Check Backend Health
```bash
curl http://localhost:5000/api/healthz
```

Expected response:
```json
{ "status": "ok" }
```

### Get Dashboard Data
```bash
curl "http://localhost:5000/api/dashboard?facilityId=1"
```

### List Facilities
```bash
curl "http://localhost:5000/api/facilities"
```

### Create Transfer Request (POST)
```bash
curl -X POST http://localhost:5000/api/transfer-requests \
  -H "Content-Type: application/json" \
  -d '{
    "requesterFacilityId": 1,
    "supplierFacilityId": 2,
    "medicineId": 1,
    "quantity": 100,
    "note": "Emergency stock shortage"
  }'
```

---

## Development Tips

### Run TypeScript Type Check
```bash
pnpm run typecheck
```

### View Backend Logs
Both development and production modes output structured logs with request details.

### Hot Reload
- **Frontend**: Automatic (Vite watches files)
- **Backend**: Requires restart after code changes

### Database Migrations
```bash
# Push schema changes
pnpm --filter @workspace/db run push

# View current schema
pnpm --filter @workspace/db run studio
```

---

## Demo Mode Script

### Step 1: Verify Setup
```bash
# Terminal 1: Backend
pnpm --filter @workspace/api-server run dev

# Terminal 2: Frontend  
pnpm --filter @workspace/dawai-setu run dev

# Terminal 3: Check APIs
curl http://localhost:5000/api/healthz
```

### Step 2: Open Application
```
Browser: http://localhost:5173
```

### Step 3: Walk Through Features
1. **Dashboard**: Shows 3 critical alerts, 2 pending transfers
2. **Shortage Watch**: Click "Shortage watch" → See all alerts with risk levels
3. **Redistribute Stock**: Create a transfer request
   - Select facility requesting stock
   - Pick medicine and quantity
   - See matching suppliers sorted by score
4. **Accept Transfer**: Go to "Transfer inbox" → Click pending request → "Accept"
   - Shows status changing to "accepted"
   - Notification appears
5. **Blood Bank**: Browse blood inventory by group

---

## Clean Up & Reset

### Reset Database (WARNING: Deletes all data)
```bash
# Drop all tables and recreate
pnpm --filter @workspace/db run drop
pnpm --filter @workspace/db run push
```

### Clear Node Modules
```bash
rm -r node_modules -Force
pnpm install
```

### Clear Pnpm Cache
```bash
pnpm store prune
```

---

## Performance Tuning

### Reduce API Polling
In `artifacts/dawai-setu/src/App.tsx`, change:
```typescript
const POLL = 15000; // milliseconds (currently 15 seconds)
```

To poll less frequently (reduce server load):
```typescript
const POLL = 30000; // 30 seconds
```

### Enable Query Caching
The app uses React Query with default stale time. To increase:
```typescript
query: { 
  refetchInterval: POLL, 
  staleTime: 5000 // Data stays fresh for 5s
}
```

---

## Deployment

### Build for Production
```bash
pnpm run build
```

Output:
- `artifacts/api-server/dist/index.mjs` - Backend bundle
- `artifacts/dawai-setu/dist/` - Frontend static files

### Deploy Backend
Upload `artifacts/api-server/dist/` to server and run:
```bash
NODE_ENV=production PORT=5000 node dist/index.mjs
```

### Deploy Frontend
Upload `artifacts/dawai-setu/dist/` to web server (Nginx, Apache, Vercel, etc.)

---

## Support

### Logs Location
- **Development**: Console output
- **Production**: Check application logs directory

### Database
- **Dev**: Local PostgreSQL
- **Prod**: Remote managed database (AWS RDS, Azure Database, etc.)

### API Documentation
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Generated client: `lib/api-client-react/src/generated/`

---

**Ready to demo! 🎉**

*If issues persist, check the HACKATHON_DEMO_CHECKLIST.md for troubleshooting.*
