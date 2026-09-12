# Dawai-Setu - Quick Fix Implementation Guide

This document contains ready-to-implement fixes for the Critical and High-Priority issues identified in CODE_REVIEW.md.

---

## CRITICAL FIX #1: Add Global Error Handler Middleware

**File:** `artifacts/api-server/src/app.ts`

**Add after all route definitions (before export):**

```typescript
// Error handling middleware - must be last
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({ 
      error: "Validation failed",
      issues: err.errors.map(e => ({ path: e.path.join("."), message: e.message }))
    });
  }
  
  // Handle known errors
  if (err instanceof Error) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ error: "Resource not found" });
    }
    if (err.message.includes("already been resolved")) {
      return res.status(409).json({ error: "This transfer has already been resolved" });
    }
    if (err.message.includes("no longer has enough")) {
      return res.status(400).json({ error: "Insufficient stock available" });
    }
  }
  
  // Default error response
  res.status(500).json({ error: "Internal server error" });
});
```

**Also add to imports:**
```typescript
import { ZodError } from "zod";
```

---

## CRITICAL FIX #2: Async Route Wrapper Function

**File:** `artifacts/api-server/src/routes/supply.ts`

**Add at the top of the file (after imports):**

```typescript
// Wrapper to handle async errors in Express routes
const asyncHandler = (fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>) => 
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
```

**Then wrap all route handlers:**

Replace:
```typescript
router.get("/dashboard", async (req, res) => {
```

With:
```typescript
router.get("/dashboard", asyncHandler(async (req, res) => {
```

And close the parenthesis at the end:
```typescript
  return res.json(GetDashboardResponse.parse(payload));
})); // Changed from just });
```

**Apply to all async routes:**
- Line 276: `/dashboard`
- Line 309: `/facilities`
- Line 318: `/medicines`
- Line 326: `/inventory`
- Line 333: `/alerts`
- Line 341: `/nearby-suppliers`
- Line 346: `/transfer-requests` (GET)
- Line 354: `/transfer-requests` (POST)
- Line 373: `/transfer-requests/:id` (PATCH)
- Line 421: `/notifications` (GET)
- Line 428: `/notifications/:id/read` (PATCH)
- Line 438: `/delivery/status` (GET)

---

## CRITICAL FIX #3: Fix Transfer Request Transaction Error Handling

**File:** `artifacts/api-server/src/routes/supply.ts`

**Replace the entire PATCH /transfer-requests/:id route (lines 373-417):**

```typescript
router.patch("/transfer-requests/:id", asyncHandler(async (req, res, next) => {
  const params = UpdateTransferRequestParams.parse(req.params);
  const body = UpdateTransferRequestBody.parse(req.body);
  
  const existingRows = await db.select().from(transferRequestsTable).where(eq(transferRequestsTable.id, params.id)).limit(1);
  const existing = existingRows[0];
  
  if (!existing) return res.status(404).json({ error: "Transfer request not found." });
  if (existing.status !== "pending") return res.status(409).json({ error: "This transfer request has already been resolved." });

  try {
    await db.transaction(async (tx) => {
      if (body.status === "accepted") {
        const supplierRows = await tx.select().from(inventoryTable)
          .where(and(eq(inventoryTable.facilityId, existing.supplierFacilityId), eq(inventoryTable.medicineId, existing.medicineId)))
          .orderBy(asc(inventoryTable.expiryDate));
        
        let remaining = existing.quantity;
        for (const row of supplierRows) {
          const available = Math.max(0, row.quantityOnHand - row.reservedQuantity);
          const reserve = Math.min(available, remaining);
          if (reserve > 0) {
            await tx.update(inventoryTable).set({
              reservedQuantity: row.reservedQuantity + reserve,
              updatedAt: new Date(),
            }).where(eq(inventoryTable.id, row.id));
            remaining -= reserve;
          }
          if (remaining === 0) break;
        }
        
        if (remaining > 0) {
          throw new Error("The source no longer has enough usable stock.");
        }
      }
      
      await tx.update(transferRequestsTable).set({
        status: body.status,
        deliveryStatus: body.status === "accepted" ? "awaiting_dispatch" : "not_configured",
        respondedAt: new Date(),
      }).where(eq(transferRequestsTable.id, existing.id));
      
      await tx.insert(notificationsTable).values({
        facilityId: existing.requesterFacilityId,
        transferRequestId: existing.id,
        type: body.status === "accepted" ? "transfer_accepted" : "transfer_rejected",
        title: body.status === "accepted" ? "Transfer accepted" : "Transfer declined",
        body: body.status === "accepted"
          ? `Your request for ${existing.quantity} units has been accepted. Swiggy Genie handoff is queued for this transfer.`
          : `Your request for ${existing.quantity} units was declined by the source facility.`,
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("no longer has enough")) {
        return res.status(400).json({ error: "Insufficient stock available for this transfer." });
      }
    }
    throw error; // Re-throw to let global handler catch it
  }

  const transfers = await loadTransferRequests(existing.requesterFacilityId, "all");
  const updated = transfers.find((transfer) => transfer.id === existing.id);
  return res.json(UpdateTransferRequestResponse.parse(updated));
}));
```

---

## CRITICAL FIX #4: Fix XSS Vulnerability in Chart Component

**File:** `artifacts/dawai-setu/src/components/ui/chart.tsx`

**Replace the dangerouslySetInnerHTML section (around line 78):**

```typescript
// Helper function to safely escape CSS values
function escapeCssValue(value: string): string {
  return value.replace(/['"\\]/g, (char) => `\\${char}`);
}

// ... in the component return statement:

return (
  <style
    dangerouslySetInnerHTML={{
      __html: Object.entries(THEMES)
        .map(
          ([theme, prefix]) => `
${prefix} [data-chart="${escapeCssValue(id)}"] {
${colorConfig
  .map(([key, itemConfig]) => {
    // Sanitize key to prevent CSS injection
    const sanitizedKey = key.replace(/[^a-z0-9-]/gi, "");
    const color = itemConfig.css || "hsl(0 0% 50%)";
    // Ensure color value doesn't contain injection attempts
    const sanitizedColor = escapeCssValue(color);
    return `  --color-${sanitizedKey}: ${sanitizedColor};`;
  })
  .join("\n")}
}
`,
        )
        .join("\n"),
    }}
  />
);
```

---

## HIGH PRIORITY FIX #5: Improve CORS Configuration

**File:** `artifacts/api-server/src/app.ts`

**Replace the cors() call (line 21):**

```typescript
import cors from "cors";

// Get allowed origins from environment variable or use defaults
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [
      "http://localhost:5173",
      "http://localhost:3000",
      process.env.FRONTEND_URL || "", // Added in production
    ].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, "CORS rejected for origin");
      callback(new Error("Not allowed by CORS policy"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"],
  maxAge: 86400, // 24 hours
}));
```

**Add to .env.example:**
```
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

---

## HIGH PRIORITY FIX #6: Add Request Size Limits & Timeouts

**File:** `artifacts/api-server/src/app.ts`

**Replace the middleware setup (lines 19-22):**

```typescript
// Set request size limits to prevent DoS
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Set request/response timeouts
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 seconds
  res.setTimeout(30000);
  next();
});

app.use(cors({ ... })); // Your CORS config here
```

---

## HIGH PRIORITY FIX #7: Return 201 Status Code on Creation

**File:** `artifacts/api-server/src/routes/supply.ts`

**Line 367, change:**
```typescript
return res.json(created);
```

**To:**
```typescript
return res.status(201).json(created);
```

---

## HIGH PRIORITY FIX #8: Add Input Validation Error Handling

**File:** `artifacts/api-server/src/routes/supply.ts`

**Update POST /transfer-requests route:**

```typescript
router.post("/transfer-requests", asyncHandler(async (req, res, next) => {
  try {
    const body = CreateTransferRequestBody.parse(req.body);
    
    // Validate business logic
    if (body.quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }
    
    const matches = await buildSupplierMatches(body.requesterFacilityId, body.medicineId, body.quantity);
    const supplier = matches.find((match) => match.facility.id === body.supplierFacilityId);
    
    if (!supplier || supplier.availableQuantity < body.quantity) {
      return res.status(400).json({ error: "The selected source does not have enough usable stock." });
    }
    
    const [request] = await db.insert(transferRequestsTable).values(body).returning();
    
    if (!request) {
      return res.status(500).json({ error: "Transfer request could not be created." });
    }
    
    await db.insert(notificationsTable).values({
      facilityId: body.supplierFacilityId,
      transferRequestId: request.id,
      type: "transfer_request",
      title: "New stock request",
      body: `A nearby facility requested ${body.quantity} units of ${supplier.medicine.genericName}.`,
    });
    
    const transfers = await loadTransferRequests(body.requesterFacilityId, "outgoing");
    const created = transfers.find((transfer) => transfer.id === request.id);
    
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        issues: error.errors
      });
    }
    throw error;
  }
}));
```

---

## HIGH PRIORITY FIX #9: Environment Variable Warnings at Startup

**File:** `artifacts/api-server/src/index.ts`

**Add after PORT validation (after line 16):**

```typescript
// Warn about missing integrations
if (!process.env.SWIGGY_GENIE_API_URL) {
  logger.warn("Swiggy Genie API URL not configured. Delivery tracking will be simulated.");
}

if (!process.env.SWIGGY_GENIE_API_KEY) {
  logger.warn("Swiggy Genie API key not configured. Delivery tracking will be simulated.");
}

// Log environment info for troubleshooting
logger.info({ 
  nodeEnv: process.env.NODE_ENV,
  port,
  logLevel: process.env.LOG_LEVEL ?? "info",
  swiggyConfigured: Boolean(process.env.SWIGGY_GENIE_API_URL && process.env.SWIGGY_GENIE_API_KEY),
}, "Starting server");
```

---

## HIGH PRIORITY FIX #10: Improve Query Client Configuration

**File:** `artifacts/dawai-setu/src/App.tsx`

**Replace the QueryClient creation (line 31):**

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes (was cacheTime)
      retry: 3, // Retry failed requests up to 3 times
      retryDelay: (attemptIndex) => 
        Math.min(1000 * Math.pow(2, attemptIndex), 30000), // Exponential backoff: 1s, 2s, 4s... max 30s
      refetchOnWindowFocus: "stale", // Only refetch if data is stale
      refetchOnReconnect: "stale",
    },
    mutations: {
      retry: 1,
      retryDelay: 500,
    },
  },
});
```

---

## MEDIUM PRIORITY: Enable TypeScript Strict Mode

**File:** `artifacts/dawai-setu/tsconfig.json`

**Update compilerOptions:**

```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitThis": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true
  }
}
```

---

## MEDIUM PRIORITY: Add Rate Limiting

**File:** `artifacts/api-server/package.json`

**Add to dependencies:**
```json
"express-rate-limit": "^7.1.0"
```

**File:** `artifacts/api-server/src/app.ts`

**Add after imports:**
```typescript
import rateLimit from "express-rate-limit";

// Create rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip specific paths if needed
  skip: (req) => req.path === "/api/healthz",
});

const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 create requests per minute
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Apply limiters
app.use("/api", generalLimiter);
app.post("/api/transfer-requests", createLimiter);
```

---

## Testing Checklist After Fixes

```bash
# 1. Start the API server with environment variables
export PORT=3000
export NODE_ENV=development
export ALLOWED_ORIGINS=http://localhost:5173
npm run dev

# 2. Test each endpoint with curl to verify error handling:

# Test 401 CORS
curl -H "Origin: http://evil.com" http://localhost:3000/api/dashboard

# Test validation error
curl -X POST http://localhost:3000/api/transfer-requests \
  -H "Content-Type: application/json" \
  -d '{"quantity": -1}' 

# Test 201 status code
curl -i -X POST http://localhost:3000/api/transfer-requests \
  -H "Content-Type: application/json" \
  -d '{"requesterFacilityId":1,"supplierFacilityId":2,"medicineId":1,"quantity":10}'

# Test rate limiting (should get 429 after limit)
for i in {1..15}; do curl http://localhost:3000/api/facilities & done; wait

# 3. In frontend, check:
# - No console errors
# - Network failures show retry behavior
# - Form validation prevents invalid submissions
# - Loading states appear correctly

# 4. Load test
# Open 5 browser tabs with the app
# Check if server stays responsive
# Check browser console for errors

# 5. Mobile test
# Use device emulation in DevTools
# Verify responsive design
# Check touch interactions work
```

---

## Deployment Checklist

- [ ] All environment variables are set in `.env.production`
- [ ] ALLOWED_ORIGINS includes production domain
- [ ] SWIGGY_GENIE_API_URL and KEY are configured
- [ ] Log level is set to "info" (not "debug")
- [ ] Node build uses `--enable-source-maps` for error tracking
- [ ] Database backups are configured
- [ ] Error logging service (Sentry) is configured
- [ ] CORS credentials are appropriate for domain
- [ ] Rate limiting is active
- [ ] Request size limits are enforced

---

## Implementation Time Estimate

| Fix | Time | Difficulty | Impact |
|-----|------|-----------|--------|
| Fix #1: Global Error Handler | 15 min | Easy | Critical |
| Fix #2: Async Wrapper | 30 min | Medium | Critical |
| Fix #3: Transaction Errors | 20 min | Medium | Critical |
| Fix #4: XSS in Chart | 10 min | Easy | Critical |
| Fix #5: CORS Config | 15 min | Easy | High |
| Fix #6: Request Limits | 10 min | Easy | High |
| Fix #7: 201 Status Code | 2 min | Trivial | High |
| Fix #8: Input Validation | 20 min | Easy | High |
| Fix #9: Env Validation | 10 min | Easy | High |
| Fix #10: Query Config | 15 min | Easy | High |
| Strict TypeScript | 30 min | Medium | Medium |
| Rate Limiting | 20 min | Easy | Medium |

**Total: ~3.5 hours for all fixes**

**Minimum for demo safety: Fixes #1-4 (1.25 hours)**

---

## Version Control Notes

When implementing these fixes:

```bash
# Create feature branch
git checkout -b fix/critical-error-handling

# Implement fixes one by one, test each
git add artifacts/api-server/src/app.ts
git commit -m "fix: add global error handler middleware"

git add artifacts/api-server/src/routes/supply.ts
git commit -m "fix: wrap async routes to catch errors"

# After all fixes and testing
git push origin fix/critical-error-handling

# Create PR for review before merge to main
```

---

**Last Updated:** 2026-09-12  
**Status:** Ready for Implementation
