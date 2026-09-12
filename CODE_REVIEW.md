# Dawai-Setu Healthcare Supply Chain - Code Review Report

**Review Date:** 2026-09-12  
**Application:** Dawai-Setu (Regional Medicine Supply Coordination System)  
**Reviewer Focus:** Hackathon Demo Readiness

---

## Executive Summary

The Dawai-Setu application demonstrates solid architectural practices with proper TypeScript configuration, structured database access via Drizzle ORM, and Zod validation. However, there are **critical issues** that could impact demo quality, **high-priority security and error handling gaps**, and several performance/UX concerns that would negatively influence hackathon judges.

**Key Findings:**
- ✅ Good: Type-safe database queries, validation with Zod, proper CORS setup
- ⚠️ Warning: Missing global error handlers, unprotected API endpoints, limited error states in UI
- 🔴 Critical: No error handling in async routes, potential unhandled promise rejections, XSS vulnerability in chart rendering

---

## 🔴 CRITICAL ISSUES (Must Fix Before Demo)

### 1. **No Global Error Handler Middleware in Express API**
**Location:** [artifacts/api-server/src/app.ts](artifacts/api-server/src/app.ts)  
**Severity:** CRITICAL  
**Impact:** Any unhandled error in route handlers crashes the server or returns a generic 500 response

**Current Code:**
```typescript
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);
```

**Issues:**
- No global error handler middleware at the end
- Async route handlers can throw errors that won't be caught
- No validation error handling
- Line 20 ends without error middleware

**Recommended Fix:**
```typescript
// Add before app.listen() - add global error handler middleware
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  
  if (err instanceof Error) {
    if (err.message.includes("validation")) {
      return res.status(400).json({ error: "Invalid request" });
    }
  }
  
  res.status(500).json({ error: "Internal server error" });
});
```

---

### 2. **Unhandled Promise Rejections in Async Route Handlers**
**Location:** [artifacts/api-server/src/routes/supply.ts](artifacts/api-server/src/routes/supply.ts#L276-L300)  
**Severity:** CRITICAL  
**Impact:** Any database error or async operation failure will crash the server

**Affected Routes:**
- `/dashboard` (line 276)
- `/facilities` (line 309)
- `/medicines` (line 318)
- `/inventory` (line 326)
- `/alerts` (line 333)
- `/nearby-suppliers` (line 341)
- `/transfer-requests` (line 346)
- `POST /transfer-requests` (line 354)
- `PATCH /transfer-requests/:id` (line 373)
- `/notifications` (line 421)
- `PATCH /notifications/:id/read` (line 428)

**Example Problem:**
```typescript
router.get("/dashboard", async (req, res) => {
  // If buildAlerts() throws, or db.select() fails, unhandled rejection
  const params = GetDashboardQueryParams.parse(req.query);
  const [facilityRows, inventoryRows, alerts, ...] = await Promise.all([...]);
  // No try-catch here
});
```

**Recommended Fix:**
Wrap all async route handlers in try-catch:
```typescript
router.get("/dashboard", async (req, res, next) => {
  try {
    const params = GetDashboardQueryParams.parse(req.query);
    // ... rest of code
  } catch (error) {
    next(error); // Pass to global error handler
  }
});
```

Or create a wrapper function:
```typescript
const asyncHandler = (fn: express.RequestHandler): express.RequestHandler => 
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get("/dashboard", asyncHandler(async (req, res) => {
  // safe now
}));
```

---

### 3. **XSS Vulnerability in Chart Component**
**Location:** [artifacts/dawai-setu/src/components/ui/chart.tsx](artifacts/dawai-setu/src/components/ui/chart.tsx#L78)  
**Severity:** CRITICAL  
**Impact:** Potential code injection if chart theme data comes from API/user input

**Current Code:**
```typescript
return (
  <style
    dangerouslySetInnerHTML={{
      __html: Object.entries(THEMES)
        .map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig.map([key, itemConfig]) => { ... }).join("")}
```

**Issue:** While this appears to use static `THEMES`, if `THEMES` or `colorConfig` ever includes untrusted data, HTML injection occurs.

**Recommended Fix:**
```typescript
// Better approach: use CSS variables without dangerouslySetInnerHTML
const style = Object.entries(THEMES).map(([theme, prefix]) => 
  `${prefix} [data-chart="${escapeAttr(id)}"] { ${colorConfig...} }`
).join("");

// Use this in a proper stylesheet or CSS-in-JS library
// Or keep dangerouslySetInnerHTML but ensure all values are escaped:
__html: colorConfig
  .map(([key, itemConfig]) => {
    const sanitizedKey = key.replace(/[^a-z0-9-]/gi, "");
    return `--color-${sanitizedKey}: ${itemConfig};`;
  })
```

**Audit Note:** Check if `THEMES` object is hardcoded (appears to be, which is safer) or if it's ever populated from external sources.

---

### 4. **Transaction Error in Transfer Acceptance Not Propagating**
**Location:** [artifacts/api-server/src/routes/supply.ts](artifacts/api-server/src/routes/supply.ts#L380-L412)  
**Severity:** CRITICAL  
**Impact:** Silent failure in transfer acceptance - inventory reserves may not update but client thinks success

**Current Code:**
```typescript
router.patch("/transfer-requests/:id", async (req, res) => {
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Transfer request not found." });
  
  await db.transaction(async (tx) => {
    // If body.status === "accepted":
    // ...reservation logic...
    if (remaining > 0) throw new Error("The source no longer has enough usable stock.");
    // This error gets thrown INSIDE the transaction but:
    // 1. Not caught
    // 2. Client gets no error response
  });
  
  // Code continues to "success" path even if transaction throws
  const transfers = await loadTransferRequests(...);
  const updated = transfers.find(...);
  return res.json(UpdateTransferRequestResponse.parse(updated));
});
```

**The Problem:**
Transaction throws, but route doesn't catch it. Express will send default 500 error, but database state is undefined.

**Recommended Fix:**
```typescript
router.patch("/transfer-requests/:id", async (req, res, next) => {
  try {
    // ... existing validation code ...
    
    await db.transaction(async (tx) => {
      if (body.status === "accepted") {
        // ... reservation logic ...
        if (remaining > 0) throw new Error("...");
      }
      // ... other updates ...
    });
    
    const transfers = await loadTransferRequests(...);
    const updated = transfers.find(...);
    return res.json(UpdateTransferRequestResponse.parse(updated));
  } catch (error) {
    next(error);
  }
});
```

---

## 🟠 HIGH PRIORITY ISSUES (Should Fix Before Demo)

### 5. **Missing Input Validation in POST /transfer-requests Body**
**Location:** [artifacts/api-server/src/routes/supply.ts](artifacts/api-server/src/routes/supply.ts#L354)  
**Severity:** HIGH  
**Impact:** Malformed requests could cause confusing errors or data corruption

**Current Code:**
```typescript
router.post("/transfer-requests", async (req, res) => {
  const body = CreateTransferRequestBody.parse(req.body);
  // parse() will throw if invalid, but no error handler catches it
});
```

**Issues:**
- Zod parse throws `ZodError` but no try-catch
- User gets cryptic Zod error message instead of API error
- No validation of `quantity > 0`

**Recommended Fix:**
```typescript
router.post("/transfer-requests", async (req, res, next) => {
  try {
    const body = CreateTransferRequestBody.parse(req.body);
    
    if (body.quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }
    
    // ... rest of code
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        error: "Validation failed",
        details: error.errors 
      });
    }
    next(error);
  }
});
```

---

### 6. **CORS Configuration Too Permissive**
**Location:** [artifacts/api-server/src/app.ts](artifacts/api-server/src/app.ts#L21)  
**Severity:** HIGH  
**Impact:** Cross-site request forgery possible, any site can make requests to API

**Current Code:**
```typescript
app.use(cors());  // Default: allows all origins
```

**Issue:**
- No CORS origin whitelist configured
- Any website can make authenticated requests to your API
- No credentials mode protection

**Recommended Fix:**
```typescript
import cors from "cors";

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
```

---

### 7. **No Request Validation Middleware**
**Location:** [artifacts/api-server/src/app.ts](artifacts/api-server/src/app.ts)  
**Severity:** HIGH  
**Impact:** Large payloads could cause memory issues; no size limits

**Issues:**
- `express.json()` has no size limit
- No request timeout
- POST requests can be arbitrarily large

**Recommended Fix:**
```typescript
app.use(express.json({ limit: "10mb" })); // Add size limit
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Add request timeout
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout
  res.setTimeout(30000);
  next();
});
```

---

### 8. **Facility ID Hardcoded in Frontend**
**Location:** [artifacts/dawai-setu/src/App.tsx](artifacts/dawai-setu/src/App.tsx#L29)  
**Severity:** HIGH  
**Impact:** Demo only works with Facility ID 1; no multi-facility support; looks unfinished

**Current Code:**
```typescript
const FACILITY_ID = 1;
```

**Issues:**
- All UI assumes only facility 1
- No way to switch facilities during demo
- Transfer logic assumes requester is always facility 1
- Blood bank UI shows "Facility ID 1" hardcoded

**Demo Impact:** Judges see fixed facility context, not a real multi-facility system

**Recommended Fix:**
Create a provider for facility context:
```typescript
interface FacilityContextType {
  facilityId: number;
  facilityName: string;
  setFacility: (id: number) => void;
}

export const FacilityContext = createContext<FacilityContextType | null>(null);

// In Shell component:
const [facilityId, setFacilityId] = useState(1);

<FacilityContext.Provider value={{ facilityId, facilityName: "...", setFacility: setFacilityId }}>
  {children}
</FacilityContext.Provider>

// Then replace all FACILITY_ID with:
const { facilityId } = useContext(FacilityContext)!;
```

---

### 9. **No Loading State for Queries**
**Location:** [artifacts/dawai-setu/src/App.tsx](artifacts/dawai-setu/src/App.tsx#L335-L345)  
**Severity:** HIGH  
**Impact:** Users see empty data briefly; looks like API failure

**Current Code:**
```typescript
const dashboard = useGetDashboard(
  { facilityId: FACILITY_ID }, 
  { query: { refetchInterval: POLL, queryKey: ... } }
);

// No initial loading feedback in several places
{dashboard.data?.summary.criticalAlerts ?? 0}
```

**Missing Loading States:**
- Shell component doesn't show loading for notifications
- Initial page load shows empty metrics briefly
- Maps render with no data skeleton
- Tables show LoadingRows but not all data panels

**Recommended Fix:**
```typescript
// Consistent loading skeleton for all QueryState calls
<QueryState 
  loading={dashboard.isLoading && !dashboard.data}  // Show loading only on first fetch
  error={dashboard.isError} 
  retry={() => dashboard.refetch()}
>
  {/* content */}
</QueryState>
```

---

### 10. **Environment Variables Not Validated at Runtime**
**Location:** [artifacts/api-server/src/index.ts](artifacts/api-server/src/index.ts#L3-L16)  
**Severity:** HIGH  
**Impact:** Missing Swiggy Genie credentials silently degrade feature; no warnings

**Current Code:**
```typescript
const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required...");

// But Swiggy Genie credentials are silently ignored if missing:
router.get("/delivery/status", async (_req, res) => {
  const configured = Boolean(process.env.SWIGGY_GENIE_API_URL && process.env.SWIGGY_GENIE_API_KEY);
  // If missing, status is "not_configured" with no warning to developers
});
```

**Issue:**
- Demo might not show Swiggy Genie integration working
- No indication that credentials are missing
- Frontend shows "not configured" without context

**Recommended Fix:**
```typescript
// At server startup, log missing integrations
if (!process.env.SWIGGY_GENIE_API_URL) {
  logger.warn("Swiggy Genie API URL not configured. Delivery tracking will be simulated.");
}
if (!process.env.SWIGGY_GENIE_API_KEY) {
  logger.warn("Swiggy Genie API key not configured. Delivery tracking will be simulated.");
}
```

---

### 11. **No Offline Support or Error Retry Strategy**
**Location:** [artifacts/dawai-setu/src/components/error-boundary.tsx](artifacts/dawai-setu/src/components/error-boundary.tsx#L45-L80)  
**Severity:** HIGH  
**Impact:** Network blip causes entire section to fail; poor UX during demo

**Current Code:**
```typescript
function ErrorBoundary({ children }: ErrorBoundaryProps) {
  // Error boundary catches React errors but NOT async query failures
  // Query failures show generic "Live signal unavailable" message
}
```

**Issues:**
- QueryState error shows: "We could not reach the regional supply service"
- No automatic retry with exponential backoff
- No stale data fallback
- Users must manually click retry

**Recommended Fix:**
```typescript
// In Shell component, add automatic retry logic:
const [retryCount, setRetryCount] = useState(0);

const handleQueryError = (error: Error) => {
  if (retryCount < 3) {
    setTimeout(() => {
      setRetryCount(r => r + 1);
      queryClient.invalidateQueries();
    }, Math.pow(2, retryCount) * 1000); // Exponential backoff: 1s, 2s, 4s
  }
};

// Configure React Query with retry defaults:
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 1000 * 60, // 1 minute
    },
  },
});
```

---

### 12. **Missing HTTP Status Code in Transfer Creation Success Response**
**Location:** [artifacts/api-server/src/routes/supply.ts](artifacts/api-server/src/routes/supply.ts#L367)  
**Severity:** HIGH  
**Impact:** REST API doesn't follow standards; client might not recognize success

**Current Code:**
```typescript
router.post("/transfer-requests", async (req, res) => {
  // ... validation and creation ...
  const [request] = await db.insert(transferRequestsTable).values(body).returning();
  if (!request) return res.status(500).json({ error: "..." });
  
  // Should return 201 Created, but returns 200
  return res.json(created);  // ← Missing res.status(201)
});
```

**Recommended Fix:**
```typescript
return res.status(201).json(created);
```

---

## 🟡 MEDIUM PRIORITY ISSUES (Nice to Fix)

### 13. **Performance: Unnecessary Re-renders in Shell Component**
**Location:** [artifacts/dawai-setu/src/App.tsx](artifacts/dawai-setu/src/App.tsx#L125-L145)  
**Severity:** MEDIUM  
**Impact:** Sidebar and modals re-render on every notification update

**Issues:**
- `notifications` refetch every 15s triggers full Shell re-render
- Open popovers close when notifications update
- Settings, Help, Account menus lose state on data refresh

**Recommended Fix:**
```typescript
// Use useCallback to memoize handlers
const toggleAccount = useCallback((origin: 'top' | 'sidebar') => {
  setAccountOrigin(origin);
  setAccountOpen((open) => !open);
  setSettingsOpen(false);
  setHelpOpen(false);
}, []);

// Use useMemo to prevent unnecessary updates
const navItems = useMemo(() => [
  { href: '/', label: 'Command center', icon: Home },
  // ... rest of nav
], []);
```

---

### 14. **Performance: Polling Interval Too Aggressive**
**Location:** [artifacts/dawai-setu/src/App.tsx](artifacts/dawai-setu/src/App.tsx#L29)  
**Severity:** MEDIUM  
**Impact:** Network traffic spike; battery drain on mobile; wasteful queries

**Current Code:**
```typescript
const POLL = 15000;  // 15 seconds

// Every component calls:
useGetDashboard(..., { query: { refetchInterval: POLL, ... } });
useListAlerts(..., { query: { refetchInterval: POLL, ... } });
useListInventory(..., { query: { refetchInterval: POLL, ... } });
// ... 10+ queries with 15s interval each
```

**Issue:**
- With ~15 queries, one request fires every second
- Total: ~240 requests/hour per user
- Multiple monitors = exponential server load

**Recommended Fix:**
```typescript
// Use longer intervals for less-critical data
const POLL_FAST = 5000;   // Critical alerts, transfers
const POLL_NORMAL = 15000; // Inventory, facilities
const POLL_SLOW = 30000;   // Blood bank (lower priority)

// Use background sync API if available:
if ("serviceWorker" in navigator) {
  // Reduce polling, use background sync for updates
}

// Or implement WebSocket for real-time updates
```

---

### 15. **Missing Skeleton Loaders During Initial Load**
**Location:** [artifacts/dawai-setu/src/App.tsx](artifacts/dawai-setu/src/App.tsx#L65-L75)  
**Severity:** MEDIUM  
**Impact:** Blank screen on first load looks broken

**Current Code:**
```typescript
function LoadingRows({ count = 4 }: { count?: number }) {
  return <div className="loading-stack">{Array.from({ length: count }).map(...skeletons...)}</div>;
}

// Used in QueryState but not:
// - Overview page heading
// - Metric cards on first load
// - Transfer list
// - Blood bank filters
```

**Recommended Fix:**
Add skeleton UI for all major content areas that load async

---

### 16. **Unused Imports and Dead Code**
**Location:** [artifacts/dawai-setu/src/App.tsx](artifacts/dawai-setu/src/App.tsx#L1-L30)  
**Severity:** MEDIUM  
**Impact:** Larger bundle size; less readable code

**Examples:**
- `useEffect` imported but `DeliveryDemoModal` uses `setInterval`
- `import.meta.env` not used consistently

**Recommended Fix:**
Clean up imports, use tree-shaking optimizations in build

---

### 17. **SQL Injection Risk in Search Queries**
**Location:** [artifacts/api-server/src/routes/supply.ts](artifacts/api-server/src/routes/supply.ts#L318-L325)  
**Severity:** MEDIUM (Mitigated)  
**Impact:** Drizzle ORM provides protection, but parameterization could be better

**Current Code:**
```typescript
router.get("/medicines", async (req, res) => {
  const params = ListMedicinesQueryParams.parse(req.query);
  const search = params.query?.trim();
  
  if (search) {
    conditions.push(or(
      ilike(medicinesTable.genericName, `%${search}%`),  // Parameterized via Drizzle
      ilike(medicinesTable.brandName, `%${search}%`),
      ilike(medicinesTable.strength, `%${search}%`)
    ));
  }
});
```

**Assessment:**
- ✅ Good: Using Drizzle ORM which parameterizes queries
- ✅ Good: `ilike` prevents SQL injection
- ⚠️ Minor: No `%` validation, but ilike handles it

**Recommendation:** Document that Drizzle ORM handles all parameterization

---

### 18. **No Rate Limiting on API Endpoints**
**Location:** [artifacts/api-server/src/app.ts](artifacts/api-server/src/app.ts)  
**Severity:** MEDIUM  
**Impact:** DoS vulnerability; malicious user can spam requests

**Recommended Fix:**
```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // 100 requests per window
});

app.use("/api", limiter);

// Stricter limits for create/update:
const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10
});

app.post("/transfer-requests", createLimiter, ...);
```

**Implementation:** Install `express-rate-limit` and add to package.json

---

### 19. **TypeScript Strict Mode Not Fully Enabled**
**Location:** [artifacts/dawai-setu/tsconfig.json](artifacts/dawai-setu/tsconfig.json#L12)  
**Severity:** MEDIUM  
**Impact:** Type safety gaps; potential runtime errors

**Current Config:**
```json
{
  "strictFunctionTypes": false,
  "noUnusedLocals": false
}
```

**Recommended Fix:**
```json
{
  "noImplicitAny": true,
  "strictFunctionTypes": true,
  "strictBindCallApply": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

---

### 20. **No Mutation Testing or Error Scenarios in Demo**
**Location:** Demo narrative  
**Severity:** MEDIUM  
**Impact:** Judges don't see error handling in action

**Missing Demo Scenarios:**
- What happens if a facility is offline?
- Network error during transfer request?
- Invalid quantity input?
- Facility runs out of stock between query and request?

**Recommendation:**
Prepare demo script that shows:
1. Happy path (create transfer)
2. Error path (try invalid quantity, show validation error)
3. Network recovery (pull network cable, show auto-retry)

---

## 🔵 LOW PRIORITY ISSUES (Can Address Later)

### 21. **Accessibility: Missing ARIA Labels**
**Location:** Multiple components  
**Severity:** LOW  
**Impact:** Screen reader users have poor experience

**Examples:**
- Map markers have no accessible names beyond `aria-label`
- Chart has no `role="img"` and no accessible description
- Filter buttons don't indicate selected state to screen readers

**Recommended Additions:**
```typescript
// For map markers:
<button
  className={`marker ${status}`}
  aria-label={`${facility.name} in ${facility.city}, ${status.label}`}
  aria-pressed={selectedId === facility.id}
>
  {/* ... */}
</button>

// For chart:
<div role="img" aria-label="Medicine pressure chart">
  <ChartComponent />
</div>
```

---

### 22. **Hardcoded Demo Delivery Stages**
**Location:** [artifacts/dawai-setu/src/App.tsx](artifacts/dawai-setu/src/App.tsx#L1070-L1075)  
**Severity:** LOW  
**Impact:** Demo carousel might feel artificial

**Current Code:**
```typescript
const deliveryDemoStages = [
  { title: 'Order accepted', short: 'Accepted', detail: '...', eta: 'Order created' },
  { title: 'Pickup assigned', short: 'Assigned', detail: '...', eta: 'Pickup in 10 min' },
  // ... 5 stages with hardcoded ETAs
];
```

**Observation:** Good for demo, but real integration would use actual Swiggy Genie API

---

### 23. **No Analytics or Error Tracking**
**Location:** Application-wide  
**Severity:** LOW  
**Impact:** Can't debug production issues

**Recommendations for Production:**
- Add Sentry for error tracking
- Add analytics to track user actions
- Monitor API response times

---

### 24. **Missing Form Validation Feedback**
**Location:** [artifacts/dawai-setu/src/App.tsx](artifacts/dawai-setu/src/App.tsx#L1020-L1035)  
**Severity:** LOW  
**Impact:** Users might not understand why form is disabled

**Current Code:**
```typescript
<input 
  id="request-quantity" 
  type="number" 
  min="1" 
  max={supplier.surplusQuantity}
  // No error messages if invalid
/>
```

**Recommended Fix:**
```typescript
const [error, setError] = useState("");

<input
  value={quantity}
  onChange={(e) => {
    const val = Number(e.target.value);
    setQuantity(val);
    if (val < 1) setError("Quantity must be at least 1");
    else if (val > supplier.surplusQuantity) setError("Exceeds available supply");
    else setError("");
  }}
  aria-invalid={!!error}
  aria-describedby={error ? "quantity-error" : undefined}
/>
{error && <div id="quantity-error" className="error-text">{error}</div>}
```

---

### 25. **No Build Output Optimization**
**Location:** [artifacts/dawai-setu/vite.config.ts](artifacts/dawai-setu/vite.config.ts#L59-L63)  
**Severity:** LOW  
**Impact:** Build might be larger than needed

**Current Config:**
```typescript
build: {
  outDir: path.resolve(import.meta.dirname, 'dist/public'),
  emptyOutDir: true,
}
```

**Recommendations:**
```typescript
build: {
  outDir: path.resolve(import.meta.dirname, 'dist/public'),
  emptyOutDir: true,
  minify: 'terser', // Ensure minification
  sourcemap: process.env.NODE_ENV === 'development', // No sourcemaps in production
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor': ['react', 'react-dom'],
        'ui': ['recharts', 'lucide-react']
      }
    }
  }
}
```

---

## Summary Table

| Issue # | Title | Severity | Category | Effort |
|---------|-------|----------|----------|--------|
| 1 | No Global Error Handler | CRITICAL | Error Handling | 30 min |
| 2 | Unhandled Promise Rejections | CRITICAL | Error Handling | 45 min |
| 3 | XSS in Chart Component | CRITICAL | Security | 15 min |
| 4 | Transaction Error Handling | CRITICAL | Database | 20 min |
| 5 | Missing Input Validation | HIGH | Validation | 30 min |
| 6 | CORS Too Permissive | HIGH | Security | 20 min |
| 7 | No Request Size Limits | HIGH | Performance | 15 min |
| 8 | Hardcoded Facility ID | HIGH | Architecture | 60 min |
| 9 | Missing Loading States | HIGH | UX | 40 min |
| 10 | Env Vars Not Validated | HIGH | Configuration | 20 min |
| 11 | No Offline Support | HIGH | Resilience | 60 min |
| 12 | Missing 201 Status Code | HIGH | API Design | 5 min |
| 13 | Unnecessary Re-renders | MEDIUM | Performance | 45 min |
| 14 | Polling Too Aggressive | MEDIUM | Performance | 30 min |
| 15 | Missing Skeletons | MEDIUM | UX | 30 min |
| 16 | Dead Code | MEDIUM | Code Quality | 20 min |
| 17 | SQL Injection Risk | MEDIUM | Security | 0 min (mitigated) |
| 18 | No Rate Limiting | MEDIUM | Security | 30 min |
| 19 | TypeScript Strict Mode | MEDIUM | Type Safety | 45 min |
| 20 | No Error Demo Scenarios | MEDIUM | Demo | 30 min |
| 21 | Missing ARIA Labels | LOW | Accessibility | 40 min |
| 22 | Hardcoded Demo Stages | LOW | Demo | N/A |
| 23 | No Analytics | LOW | Monitoring | 60 min |
| 24 | Missing Form Validation | LOW | UX | 25 min |
| 25 | Build Optimization | LOW | Performance | 30 min |

---

## Recommended Fix Priority for Hackathon Demo

### Phase 1: Critical (90 minutes)
**Complete before any demo:**
1. ✅ Add global error handler middleware (30 min)
2. ✅ Wrap async routes in try-catch (45 min)
3. ✅ Fix XSS in chart.tsx (15 min)

### Phase 2: High-Priority Security & UX (120 minutes)
**Complete for production-ready demo:**
1. ✅ Fix CORS configuration (20 min)
2. ✅ Add input validation (30 min)
3. ✅ Fix facility ID hardcoding (60 min)
4. ✅ Add request size limits (10 min)

### Phase 3: Polish (90 minutes)
**Improve demo presentation:**
1. ✅ Add loading states to all pages (40 min)
2. ✅ Add retry logic to queries (30 min)
3. ✅ Create demo error scenario walkthrough (20 min)

**Total Critical Fixes: ~3-4 hours**

---

## Testing Checklist for Demo

Before presenting to judges:

- [ ] Test network failure scenario (disable WiFi, show recovery)
- [ ] Test invalid input (negative quantity, empty medicine search)
- [ ] Test rapid multi-requests (create multiple transfers quickly)
- [ ] Test on mobile device (check responsive design)
- [ ] Test with API server down (show graceful error)
- [ ] Test page navigation (ensure state persists correctly)
- [ ] Load test (open multiple browser tabs with live polling)
- [ ] Check console for errors/warnings
- [ ] Verify Swiggy Genie status shows correctly (configured or demo mode)
- [ ] Test blood bank filtering (multiple combinations)
- [ ] Test facility network search (various queries)
- [ ] Check initial loading (blank screen or skeleton?)

---

## Build Configuration Notes

### Current Setup
- ✅ TypeScript configured with strict mode (mostly)
- ✅ Vite with React plugin
- ✅ Tailwind CSS integration
- ✅ Path aliases configured (@/ for src)
- ⚠️ Source maps enabled (check for production)
- ⚠️ No minification specified (verify build output)

### Recommendations
1. Ensure production build has minification enabled
2. Disable source maps in production
3. Test build output size: `npm run build` then check `dist/public/` size
4. Verify all assets are included (public/ folder)

---

## Final Assessment

**Overall Quality:** B+ (Good architecture, implementation gaps)

**Demo Readiness:** C (Will work but has obvious bugs)

**Production Readiness:** D (Needs security hardening and error handling)

**Hackathon Impact:**
- ✅ Impressive UI/UX with modern design
- ✅ Good data visualization and domain-specific features
- ⚠️ Brittle error handling will show failures during demo
- 🔴 Hardcoded facility ID undermines "multi-facility network" pitch
- 🔴 No error recovery in UI (looks like app is broken)

**Recommendation:** Spend 3-4 hours on Critical + High-Priority fixes. This will make the demo significantly more impressive to judges and prevent embarrassing crashes.

---

**Report Generated:** 2026-09-12  
**Next Review:** After implementing Critical fixes
