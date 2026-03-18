# ParkEase Smart Campus Parking Ecosystem
# Production Readiness Improvement Plan

**Generated:** March 17, 2026
**Current Status:** ~30-35% of planned features implemented (functional MVP)
**Goal:** Transform from hackathon prototype into a production-ready, real-world campus parking application

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Phase 1: Critical Security Fixes (Week 1-2)](#2-phase-1-critical-security-fixes-week-1-2)
3. [Phase 2: Architecture & Code Quality (Week 3-4)](#3-phase-2-architecture--code-quality-week-3-4)
4. [Phase 3: Core Feature Completion (Week 5-8)](#4-phase-3-core-feature-completion-week-5-8)
5. [Phase 4: Real-Time & Notifications (Week 9-10)](#5-phase-4-real-time--notifications-week-9-10)
6. [Phase 5: Analytics & Reporting (Week 11-12)](#6-phase-5-analytics--reporting-week-11-12)
7. [Phase 6: Production Infrastructure (Week 13-14)](#7-phase-6-production-infrastructure-week-13-14)
8. [Phase 7: Advanced Features (Week 15-18)](#8-phase-7-advanced-features-week-15-18)
9. [Phase 8: Testing & QA (Week 19-20)](#9-phase-8-testing--qa-week-19-20)
10. [Database Schema Changes](#10-database-schema-changes)
11. [File-by-File Issues & Fixes](#11-file-by-file-issues--fixes)
12. [Estimated Effort & Priority Matrix](#12-estimated-effort--priority-matrix)

---

## 1. Current State Assessment

### What Works Today
- Email/password auth with role-based routing (student, staff, faculty, guard, admin)
- Vehicle registration with zone auto-allocation
- QR-based check-in/check-out via guard scanner
- ANPR (Automatic Number Plate Recognition) microservice
- Guest invite passes with OTP
- Walk-in visitor registration
- Admin dashboard (vehicles, zones, guest passes, guard management)
- Student/Staff dashboards with parking status

### Architecture
| Layer | Current | Problem |
|-------|---------|---------|
| Frontend | React 19 + Vite + Tailwind | Monolithic components (1000+ line files), no state management library |
| Backend | None (Supabase direct from browser) | All business logic is client-side, easily bypassed |
| Database | Supabase PostgreSQL + RLS | Schema works but no server-side enforcement |
| ANPR | Python FastAPI + EasyOCR | No auth, CORS wide open, public SSH tunnel |
| Deployment | Vercel (frontend only) | No containerization, no CI/CD |

### Critical Findings (63 total issues identified)
- **4 CRITICAL** issues (exposed credentials, CORS *, no ANPR auth, zero ARIA labels)
- **23 HIGH** severity issues (client-side role assignment, race conditions, no error handling)
- **24 MEDIUM** issues (code duplication, memory leaks, missing pagination)
- **12 LOW** issues (styling inconsistencies, minor UX issues)

---

## 2. Phase 1: Critical Security Fixes (Week 1-2)

### 1.1 Fix Client-Side Role Assignment Vulnerability
**Severity:** CRITICAL
**Files:** `Register.jsx:63-68`, `StaffRegister.jsx:62-68`, `AdminDashboard.jsx:409`

**Problem:** Role is passed via `options.data.role` in `signUp()`. Any user can call the Supabase auth API directly with `role: 'admin'` and gain full access.

**Solution:**
- Create a Supabase Database Function (or Edge Function) that validates role assignment
- The DB trigger that creates profiles must ONLY allow `student`, `faculty`, `staff` roles from self-registration
- `guard` role can only be set by an existing `admin` (verify via `auth.uid()` in the trigger)
- `admin` role can only be set by another `admin` or via direct database access
- Add a Supabase Edge Function for guard creation instead of using `supabaseSecondary`

### 1.2 Remove Exposed Credentials from Git
**Severity:** CRITICAL
**File:** `.env`

**Problem:** `.env` file with live Supabase credentials is committed to the repository.

**Solution:**
- Add `.env` to `.gitignore` (verify it's there)
- Rotate the Supabase anon key and URL if the repo is public
- Use `git filter-branch` or `BFG Repo-Cleaner` to remove `.env` from git history
- Document required env vars in `.env.example` (already exists)

### 1.3 Secure the ANPR Server
**Severity:** CRITICAL
**Files:** `anpr_server.py:56-61, 220-294, 328, 100-101`

**Problem:** CORS allows all origins, `/detect` has no auth, SSH tunnel with `StrictHostKeyChecking=no`, no request size limit.

**Solution:**
- Restrict CORS to specific frontend domains: `allow_origins=["https://parkease.vercel.app", "http://localhost:5173"]`
- Add API key authentication middleware (check `X-API-Key` header against env var)
- Add request body size limit (e.g., 10MB max for image uploads)
- Remove or secure the SSH tunnel (use proper deployment instead)
- Add `StrictHostKeyChecking=yes` if tunnel is kept
- Return proper HTTP error codes (4xx/5xx) instead of empty 200 responses
- Add rate limiting (e.g., `slowapi` library for FastAPI)

### 1.4 Secure OTP Generation
**Severity:** HIGH
**Files:** `GuestInvites.jsx:94`, `AdminDashboard.jsx:311`, `WalkInRegistration.jsx:42`

**Problem:** OTP uses `Math.random()` which is not cryptographically secure.

**Solution:**
```javascript
// Replace: Math.floor(100000 + Math.random() * 900000)
// With:
const array = new Uint32Array(1);
crypto.getRandomValues(array);
const otp = String(100000 + (array[0] % 900000));
```

### 1.5 Secure Walk-In Registration Endpoint
**Severity:** HIGH
**File:** `App.jsx:73`, `WalkInRegistration.jsx`

**Problem:** `/visitor` route has no rate limiting. Anyone can flood the pending walk-in queue.

**Solution:**
- Add CAPTCHA (e.g., hCaptcha or Cloudflare Turnstile) to the walk-in form
- Implement rate limiting via Supabase RLS policy (max N inserts per IP per hour)
- Add input validation and sanitization server-side

---

## 3. Phase 2: Architecture & Code Quality (Week 3-4)

### 2.1 Create a Shared Utilities Library
**Problem:** Massive code duplication across 14+ files.

**Create these shared modules:**

```
src/
  lib/
    supabase.js          (existing)
    constants.js          (NEW - all magic numbers and shared constants)
    validators.js         (NEW - regex patterns, input validation)
  utils/
    capacity.js           (NEW - fetchCapacity logic, used in 3 places)
    qrDownload.js         (NEW - QR canvas download, duplicated in 3 files)
    format.js             (NEW - formatDuration, formatDate, etc.)
    otp.js                (NEW - secure OTP generation)
  hooks/
    useCapacity.js        (NEW - capacity polling hook)
    useSupabaseQuery.js   (NEW - generic query hook with error handling)
```

**Specific deduplication targets:**
| Duplicated Code | Files | Extract To |
|-----------------|-------|------------|
| `fetchCapacity()` | GuardScanner, AdminDashboard, StudentDashboard | `utils/capacity.js` |
| `downloadQR()` | GuestInvites, AdminDashboard, MyVehicles | `utils/qrDownload.js` |
| `generatePassString()` | GuestInvites, AdminDashboard, WalkInRegistration | `utils/qrDownload.js` |
| `formatDuration()` | GuardScanner:697, AdminDashboard:425 | `utils/format.js` |
| Vehicle plate regex | GuestInvites:76, AdminDashboard:301, VehicleRegister | `lib/constants.js` |
| Department list | Register:106-119, StaffRegister:105-118 | `lib/constants.js` |
| Photo size limit (5MB) | Register:22, StaffRegister:22, StudentProfile | `lib/constants.js` |
| 90-day cooldown logic | MyVehicles:18, VehicleRegister | `lib/constants.js` |
| Polling intervals | GuardScanner:46, AdminDashboard:60 | `lib/constants.js` |

### 2.2 Refactor GuardScanner.jsx (1070 lines)
**Problem:** Monolithic component with 15+ useState hooks, duplicated logic, inline styles.

**Solution -- Split into sub-components and hooks:**
```
src/pages/GuardScanner.jsx         (orchestrator, ~200 lines)
src/components/guard/
  QRScannerPanel.jsx               (QR scanning UI and logic)
  ManualSearchPanel.jsx            (manual plate number entry)
  ANPRPanel.jsx                    (ANPR camera integration)
  ScanResultCard.jsx               (display scan results)
  CheckInOutActions.jsx            (check-in/check-out buttons + logic)
  GuestScanHandler.jsx             (guest pass scanning logic)
  VehicleInfo.jsx                  (existing, keep)
  GuestInfo.jsx                    (existing, keep)
  CapacityWidget.jsx               (existing, keep)
  OverstayPanel.jsx                (existing, keep)
  PendingWalkins.jsx               (existing, keep)
src/hooks/
  useScanner.js                    (camera + QR scanning state)
  useVehicleLookup.js              (vehicle search + check-in/out)
  useGuestPassScan.js              (guest pass validation)
```

### 2.3 Refactor AdminDashboard.jsx (861 lines)
**Problem:** 7-tab dashboard crammed into one component with shared state leaking.

**Solution -- Extract each tab into its own component:**
```
src/pages/AdminDashboard.jsx       (tab navigation only, ~100 lines)
src/components/admin/
  AdminOverviewTab.jsx             (stats + capacity)
  AdminUsersTab.jsx                (user management - NEW)
  AdminVehiclesTab.jsx             (vehicle list + approval)
  AdminZonesTab.jsx                (existing, keep)
  AdminGuestPassTab.jsx            (existing, keep)
  AdminGuardsTab.jsx               (guard management)
  AdminLogsTab.jsx                 (parking logs viewer)
  AddGuardForm.jsx                 (existing, keep)
  AdminVehicleDetails.jsx          (existing, keep)
```

### 2.4 Add Proper Error Handling Everywhere
**Problem:** 30+ Supabase queries ignore the `error` return value. Users see empty data with no feedback.

**Solution:**
- Create a `useSupabaseQuery` hook that handles loading, error, and data states
- Every Supabase call must check `if (error)` and display a user-visible error message
- Add a global React Error Boundary component wrapping `<App />`
- Add toast/notification system for transient errors (e.g., `react-hot-toast`)

```javascript
// Example: useSupabaseQuery hook
function useSupabaseQuery(queryFn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    queryFn()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        else setData(data);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, deps);

  return { data, error, loading };
}
```

### 2.5 Fix Race Conditions and Memory Leaks
| Issue | File | Fix |
|-------|------|-----|
| Stale state read after async setState | `GuardScanner.jsx:344-345` | Use return value from `processGuest()` instead of reading state |
| No AbortController for fetches | `GuardScanner.jsx:36-51` | Add AbortController, pass signal to fetch, abort on cleanup |
| Blob URL leak | `Register.jsx:27`, `StaffRegister.jsx:27` | Call `revokeObjectURL()` before creating new one |
| Missing useEffect dependency | `StudentDashboard.jsx:14`, `StaffDashboard.jsx:14`, `GuestInvites.jsx:25` | Add `profile?.id` to dependency arrays |
| Overlapping poll + initial fetch | `AdminDashboard.jsx:58-61` | Use `setTimeout` chain or `useInterval` hook that waits for previous call |
| `window.location.reload()` usage | `MyVehicles.jsx:108` | Update local state instead of reloading page |
| `window.location.href` navigation | `Register.jsx:91`, `StaffRegister.jsx:90` | Use React Router `navigate()` |

---

## 4. Phase 3: Core Feature Completion (Week 5-8)

### 3.1 Capacity Enforcement at Entry
**Currently Missing:** Guards can check in vehicles even when a zone is at full capacity.

**Implementation:**
- Before check-in, query current zone occupancy vs capacity
- If zone is full, show warning to guard with options:
  - Deny entry
  - Allow entry to overflow slots (if available)
  - Redirect to nearest zone with available space
- Add `overflow_mode` flag to zones that activates when regular capacity is reached
- Log capacity violations for admin review

### 3.2 Vehicle Approval Workflow
**Currently:** Vehicles default to `active` status immediately after registration.

**Implementation:**
- New vehicles should get `pending_approval` status
- Admin dashboard should show pending vehicles with approve/reject buttons (partially exists)
- Students cannot check-in until vehicle is approved
- Email notification to student on approval/rejection
- Allow admin to set auto-approval rules (e.g., faculty vehicles auto-approved)

### 3.3 Proper QR Code Security
**Currently:** QR contains raw UUID or plain JSON -- easily forged.

**Implementation:**
- QR payload should be a signed JWT token (use Supabase Edge Function to generate)
- Token contains: `{ userId, vehicleId, vehicleNumber, issuedAt, expiresAt }`
- Token is signed with a server-side secret (HMAC-SHA256)
- Guard scanner verifies the signature before processing
- Tokens expire after configurable period (e.g., 30 days)
- Add QR refresh mechanism in MyVehicles page

### 3.4 Per-Vehicle QR Codes
**Currently:** One QR code per user (contains user UUID).

**Implementation:**
- Generate one QR per registered vehicle
- QR payload: signed JWT with vehicle-specific data
- Guard scanner identifies the specific vehicle being checked in
- Useful when a user has multiple vehicles

### 3.5 Role-Specific Vehicle Limits
**Currently:** All roles have the same limits (2 two-wheelers, 1 four-wheeler).

**Implementation:**
- Move limits to a config table in the database:
  | Role | Max 2W | Max 4W |
  |------|--------|--------|
  | student | 1 | 0 |
  | faculty | 2 | 1 |
  | staff | 1 | 1 |
  | admin | 2 | 2 |
- Enforce limits in both client-side UI and database RLS policies
- Allow admin to override limits per-user

### 3.6 Priority-Based Access System
**Currently Missing.**

**Implementation:**
- Define priority levels: Faculty > Staff > Student
- When a zone is near capacity (e.g., >90%), lower-priority users are redirected to overflow zones
- Faculty/staff get reserved slots that students cannot use
- Implement priority queue for peak hours
- Admin can configure priority rules per zone

### 3.7 Multi-Gate Support
**Currently:** Gates are stored in zone data but not used in entry/exit logic.

**Implementation:**
- Each guard is assigned to a specific gate
- Check-in/check-out logs record which gate was used
- Gate-specific capacity views (how many entered/exited per gate)
- Gate status management (open/closed/maintenance)
- Admin can assign guards to gates

### 3.8 User Account Management (Admin)
**Currently Missing:** Admin cannot suspend users, change roles, or manage accounts.

**Implementation:**
- Admin Users tab with search/filter/sort
- Actions: suspend/activate account, change role, reset password
- View user's vehicles, parking history, violations
- Bulk actions (CSV import of users)
- Audit log for all admin actions

### 3.9 Pagination for All List Views
**Currently:** `AdminDashboard.jsx:146-148` has `.limit(100)` hardcoded. No pagination.

**Implementation:**
- Add cursor-based pagination to all list queries
- UI: page numbers or infinite scroll
- Affected views: vehicle list, user list, logs, guest passes
- Add search and filter capabilities to each list

### 3.10 Blacklist Management
**Currently Missing.**

**Implementation:**
- Admin can blacklist vehicles by plate number
- Blacklisted vehicles are flagged at check-in
- Guard scanner shows alert with reason
- Auto-reject check-in for blacklisted vehicles (configurable)
- Blacklist history with add/remove dates and reasons

---

## 5. Phase 4: Real-Time & Notifications (Week 9-10)

### 4.1 Supabase Realtime Integration
**Currently:** Polling with `setInterval` (10-30 second intervals).

**Implementation:**
- Subscribe to `parkease_logs` changes for live capacity updates
- Subscribe to `parkease_guest_passes` for guard's pending walk-in panel
- Subscribe to `parkease_vehicles` for admin's pending approval queue
- Remove all `setInterval` polling -- replace with Supabase Realtime channels

```javascript
// Example: Real-time capacity subscription
const channel = supabase
  .channel('capacity-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'parkease_logs'
  }, (payload) => {
    // Recalculate capacity on any log change
    fetchCapacity();
  })
  .subscribe();
```

### 4.2 Email Notifications
**Implementation using Supabase Edge Functions + Resend/SendGrid:**
- Vehicle approved/rejected -> email to owner
- Guest pass created -> email to guest with QR code
- Overstay alert -> email to vehicle owner
- Zone violation -> email to vehicle owner
- Account status change -> email to user

### 4.3 Push Notifications (PWA)
**Implementation:**
- Convert app to PWA (service worker, manifest.json)
- Register for push notifications
- Push events: parking duration warnings, guest pass expiry, vehicle approval
- Offline fallback page for guards

### 4.4 In-App Notification Center
**Implementation:**
- New `parkease_notifications` table
- Notification bell icon in the header with unread count
- Notification types: info, warning, alert
- Mark as read, clear all, notification preferences

---

## 6. Phase 5: Analytics & Reporting (Week 11-12)

### 5.1 Admin Analytics Dashboard
**Currently Missing. Add a new Analytics tab to AdminDashboard.**

**Implementation:**
- **Occupancy trends:** Line chart showing zone occupancy over time (hourly/daily/weekly)
- **Peak hours heatmap:** When is parking most/least utilized
- **Average parking duration:** By zone, vehicle type, user role
- **Zone utilization rate:** Percentage of capacity used, overflow frequency
- **Department-wise breakdown:** Which departments use which zones most
- **Guest pass statistics:** Passes created/used/expired per day
- **Violation statistics:** Zone violations, overstays, blacklist hits
- **Chart library:** Use `recharts` or `chart.js` (already React-friendly)

### 5.2 Report Generation
**Implementation:**
- Daily/weekly/monthly automated reports
- PDF export using `jspdf` or server-side PDF generation
- CSV export for raw data download
- Report types:
  - Parking utilization summary
  - Revenue report (if payments added)
  - Violation report
  - Zone capacity report
  - User activity report

### 5.3 Audit Trail
**Implementation:**
- New `parkease_audit_log` table
- Log all admin actions: user management, zone changes, vehicle approvals, config changes
- Log all guard actions: check-ins, check-outs, guest approvals, manual overrides
- Immutable audit log (append-only, no deletes)
- Admin can view and filter audit log

---

## 7. Phase 6: Production Infrastructure (Week 13-14)

### 6.1 Supabase Edge Functions (Server-Side Logic)
**Currently:** All business logic runs client-side. This is the single biggest architectural gap.

**Create Edge Functions for:**
| Function | Purpose |
|----------|---------|
| `create-guard` | Admin-only guard account creation with server-side role validation |
| `generate-qr-token` | Sign QR tokens with server secret |
| `verify-qr-token` | Verify QR token signature at check-in |
| `check-in` | Server-side check-in with capacity enforcement |
| `check-out` | Server-side check-out with duration calculation |
| `create-guest-pass` | Validate sponsor, generate secure OTP, enforce daily limits |
| `approve-vehicle` | Admin-only vehicle approval with notification |
| `generate-report` | Server-side report generation |

### 6.2 Strengthen RLS Policies
**Current state:** RLS exists but hasn't been audited for completeness.

**Ensure these policies exist:**
- Users can only read/write their own profiles
- Users can only read/write their own vehicles
- Users can only read/write their own guest passes
- Guards can read all vehicles and logs, write logs
- Admins can read/write everything
- No user can modify their own role
- Audit log is append-only (no updates, no deletes)
- Walk-in registration is insert-only for anonymous users (with rate limit)

### 6.3 CI/CD Pipeline
**Currently Missing.**

**Implementation with GitHub Actions:**
```yaml
# .github/workflows/ci.yml
- Lint (ESLint)
- Type check (if TypeScript migration done)
- Unit tests (Vitest)
- Integration tests
- Build verification
- Preview deployment (Vercel)
- Production deployment (on merge to main)
```

### 6.4 Environment Management
**Implementation:**
- Separate Supabase projects for dev/staging/production
- Environment-specific `.env` files managed via CI/CD secrets
- Feature flags for gradual rollout
- Database migration scripts (Supabase CLI migrations)

### 6.5 Monitoring & Observability
**Implementation:**
- Error tracking: Sentry integration (free tier available)
- Performance monitoring: Vercel Analytics (built-in)
- Supabase dashboard monitoring (built-in)
- Custom health check endpoint for ANPR server
- Uptime monitoring (e.g., UptimeRobot)

### 6.6 Containerize ANPR Server
**Currently:** ANPR runs as a bare Python script with an SSH tunnel.

**Implementation:**
- Create `Dockerfile` for the ANPR server
- Deploy to a proper cloud service (Railway, Fly.io, or AWS EC2)
- Use HTTPS with proper TLS certificate
- Add health check endpoint (exists but not monitored)
- Implement graceful shutdown
- Add structured logging (JSON format)

---

## 8. Phase 7: Advanced Features (Week 15-18)

### 7.1 Payment & Fine System
**Implementation:**
- Integrate Razorpay (popular in India) for UPI/card payments
- Parking fee calculation based on duration and vehicle type
- Fine system for violations (overstay, wrong zone, blacklisted vehicle)
- Payment history and receipts
- Admin can configure fee structure per zone

### 7.2 Document Management
**Implementation:**
- Vehicle document upload: Registration Certificate (RC), Insurance, PUC
- Document verification workflow (admin approval)
- Expiry tracking with notifications
- Document viewer in admin panel

### 7.3 Parking Slot Reservation
**Implementation:**
- Faculty/staff can reserve specific parking slots
- Time-based reservations (e.g., 9 AM - 5 PM on weekdays)
- Reservation calendar view
- Auto-release unreserved slots after grace period

### 7.4 Emergency Vehicle Support
**Currently:** `emergency_vehicle_until` field exists in profiles but isn't used.

**Implementation:**
- Admin can grant temporary emergency vehicle access
- Emergency vehicles bypass capacity checks
- Special indicator on guard scanner
- Auto-expiry after configured duration

### 7.5 Mobile-Responsive Redesign
**Currently:** Basic responsiveness but not optimized for mobile.

**Implementation:**
- Mobile-first redesign for guard scanner (primary mobile use case)
- Touch-friendly UI elements
- Bottom navigation for mobile
- Responsive data tables (card view on mobile)

### 7.6 Offline Mode for Guards (PWA)
**Implementation:**
- Service worker caches essential assets and recent vehicle data
- Guards can scan QR codes offline
- Offline check-ins queue locally and sync when online
- Offline capacity estimates based on last-known state
- Visual indicator showing online/offline status

### 7.7 Multi-Language Support (i18n)
**Implementation:**
- Use `react-i18next` for internationalization
- Support English, Hindi, Gujarati (relevant for SCET campus)
- Language switcher in profile settings

---

## 9. Phase 8: Testing & QA (Week 19-20)

### 8.1 Unit Tests
**Currently:** Zero automated tests. Only manual Supabase query scripts.

**Implementation:**
- Testing framework: Vitest (already compatible with Vite)
- Test shared utilities: `capacity.js`, `format.js`, `validators.js`, `otp.js`
- Test custom hooks: `useCapacity`, `useSupabaseQuery`
- Test auth context logic
- Target: 80% code coverage on utility functions

### 8.2 Component Tests
**Implementation:**
- Use React Testing Library + Vitest
- Test form validation (Register, VehicleRegister, GuestInvites)
- Test role-based routing (ProtectedRoute, DashboardRedirect)
- Test QR code generation and display
- Test loading/error states

### 8.3 Integration Tests
**Implementation:**
- Test check-in/check-out flow end-to-end
- Test guest pass creation and scanning flow
- Test vehicle registration and zone allocation
- Test admin vehicle approval workflow
- Use Supabase local development (Docker) for test database

### 8.4 E2E Tests
**Implementation:**
- Use Playwright or Cypress
- Critical user journeys:
  - Student: Register -> Login -> Add Vehicle -> View QR -> Check-in -> Check-out
  - Guard: Login -> Scan QR -> Check-in -> Check-out
  - Admin: Login -> Approve Vehicle -> Create Guard -> View Logs
  - Guest: Receive Invite -> Walk-in Registration -> Guard Approval

### 8.5 Accessibility Audit
**Currently:** Zero ARIA labels, no semantic HTML, no keyboard navigation support.

**Implementation:**
- Add `aria-label` to all icon-only buttons (hamburger menu, close buttons, action icons)
- Add `role="tab"`, `aria-selected`, `aria-controls` to tab controls
- Add `role="status"` and `aria-live="polite"` to loading spinners
- Add skip navigation link ("Skip to main content")
- Replace `<div>` containers with semantic elements (`<nav>`, `<section>`, `<article>`)
- Add `:focus-visible` styles to all interactive elements
- Add `prefers-color-scheme` media query support
- Add color-blind-friendly status indicators (icons + text, not just color)
- Test with screen reader (NVDA or VoiceOver)
- Fix contrast issues: `#94a3b8` label text and `#64748b` placeholder text
- Run axe-core automated accessibility audit

---

## 10. Database Schema Changes

### New Tables Needed

```sql
-- Notification system
CREATE TABLE parkease_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('info', 'warning', 'alert', 'success')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log (append-only)
CREATE TABLE parkease_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Blacklist
CREATE TABLE parkease_blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_number TEXT NOT NULL,
  reason TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  removed_at TIMESTAMPTZ
);

-- Vehicle documents
CREATE TABLE parkease_vehicle_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES parkease_vehicles(id),
  document_type TEXT CHECK (document_type IN ('rc', 'insurance', 'puc', 'other')),
  file_url TEXT NOT NULL,
  expiry_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Role-specific vehicle limits config
CREATE TABLE parkease_vehicle_limits (
  role TEXT PRIMARY KEY,
  max_two_wheeler INT NOT NULL DEFAULT 1,
  max_four_wheeler INT NOT NULL DEFAULT 0
);

-- Gate assignments
CREATE TABLE parkease_gate_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guard_id UUID REFERENCES auth.users(id),
  zone_id UUID REFERENCES parkease_zones(id),
  gate_name TEXT NOT NULL,
  shift TEXT CHECK (shift IN ('morning', 'afternoon', 'night')),
  is_active BOOLEAN DEFAULT true
);

-- Parking reservations
CREATE TABLE parkease_reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  zone_id UUID REFERENCES parkease_zones(id),
  vehicle_id UUID REFERENCES parkease_vehicles(id),
  reserved_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Modifications to Existing Tables

```sql
-- Add to parkease_vehicles
ALTER TABLE parkease_vehicles ADD COLUMN approved_by UUID REFERENCES auth.users(id);
ALTER TABLE parkease_vehicles ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE parkease_vehicles ADD COLUMN rejection_reason TEXT;

-- Add to parkease_logs
ALTER TABLE parkease_logs ADD COLUMN gate_id UUID;
ALTER TABLE parkease_logs ADD COLUMN entry_method TEXT CHECK (entry_method IN ('qr', 'anpr', 'manual'));
ALTER TABLE parkease_logs ADD COLUMN capacity_at_entry INT;

-- Add to parkease_zones
ALTER TABLE parkease_zones ADD COLUMN overflow_mode BOOLEAN DEFAULT false;
ALTER TABLE parkease_zones ADD COLUMN priority_threshold_pct INT DEFAULT 90;

-- Add to parkease_profiles
ALTER TABLE parkease_profiles ADD COLUMN is_suspended BOOLEAN DEFAULT false;
ALTER TABLE parkease_profiles ADD COLUMN notification_preferences JSONB DEFAULT '{"email": true, "push": true}';
ALTER TABLE parkease_profiles ADD COLUMN language TEXT DEFAULT 'en';
```

---

## 11. File-by-File Issues & Fixes

### Critical / High Priority Fixes

| File | Line(s) | Issue | Fix |
|------|---------|-------|-----|
| `.env` | 1-2 | Credentials committed to git | Add to `.gitignore`, rotate keys |
| `Register.jsx` | 63-68 | Client-side role assignment | Move to Edge Function |
| `StaffRegister.jsx` | 62-68 | Client-side role assignment | Move to Edge Function |
| `AdminDashboard.jsx` | 405-421 | Guard creation via anon key | Use Edge Function |
| `anpr_server.py` | 56-61 | CORS `allow_origins=["*"]` | Restrict to specific domains |
| `anpr_server.py` | 220-294 | No auth on `/detect` | Add API key middleware |
| `anpr_server.py` | 100-101 | No request size limit | Add `max_length` to Pydantic field |
| `anpr_server.py` | 292-294 | Errors return HTTP 200 | Return proper 4xx/5xx |
| `anpr_server.py` | 328 | `StrictHostKeyChecking=no` | Change to `yes` or remove tunnel |
| `GuardScanner.jsx` | 344-345 | Race condition (stale state) | Use function return value |
| `GuardScanner.jsx` | 36-51 | No cleanup for async fetches | Add AbortController |
| `GuardScanner.jsx` | 19-32 | 15+ useState hooks | Extract to custom hooks |
| `GuardScanner.jsx` | 77-108 | Duplicated fetchCapacity | Extract to shared utility |
| `AdminDashboard.jsx` | 69-93 | No error handling on queries | Check error return values |
| `AdminDashboard.jsx` | 146-148 | `.limit(100)` hardcoded | Add pagination |
| `AdminDashboard.jsx` | 60 | 10-second polling (aggressive) | Use Supabase Realtime |
| `GuestInvites.jsx` | 94 | `Math.random()` for OTP | Use `crypto.getRandomValues()` |
| `MyVehicles.jsx` | 108 | `window.location.reload()` | Update local state |
| `Register.jsx` | 91-93 | `window.location.href` | Use `navigate()` |
| `StaffRegister.jsx` | 90-92 | `window.location.href` | Use `navigate()` |
| `Register.jsx` | 27 | Blob URL not revoked | Call `revokeObjectURL()` |
| `StaffRegister.jsx` | 27 | Blob URL not revoked | Call `revokeObjectURL()` |
| `StudentDashboard.jsx` | 14 | Missing useEffect dependency | Add `profile?.id` |
| `StaffDashboard.jsx` | 14 | Missing useEffect dependency | Add `profile?.id` |
| `GuestInvites.jsx` | 25 | Missing useEffect dependency | Add `profile?.id` |

### Medium / Low Priority Fixes

| File | Line(s) | Issue | Fix |
|------|---------|-------|-----|
| `index.css` | 156 | `outline: none` on inputs | Add `:focus-visible` style |
| `index.css` | 84-144 | No focus styles on buttons | Add `:focus-visible` ring |
| `index.css` | 199 | Low contrast label text | Increase contrast ratio |
| `index.css` | 164 | Low contrast placeholder | Increase contrast ratio |
| `Layout.jsx` | 191-196 | Hamburger button no aria-label | Add `aria-label="Toggle menu"` |
| `App.jsx` | 144 | No 404 page | Create NotFound page |
| `App.jsx` | 55-61 | Unknown role defaults to student | Show error page |
| `App.jsx` | 77 | `/reset-password` not in PublicRoute | Wrap in appropriate route guard |
| All JSX files | Various | Inline style objects | Move to CSS classes or Tailwind |
| All JSX files | Various | Hardcoded color hex codes | Use CSS custom properties |
| `GuardScanner.jsx` | 716-742 | Custom tab controls lack ARIA | Add `role="tab"`, `aria-selected` |
| All dashboards | Various | Loading spinners lack `role="status"` | Add `role="status"` + `aria-live` |

---

## 12. Estimated Effort & Priority Matrix

| Phase | Priority | Effort | Impact | Description |
|-------|----------|--------|--------|-------------|
| **Phase 1** | P0 (Critical) | 2 weeks | Security | Fix security vulnerabilities that could lead to data breach or system abuse |
| **Phase 2** | P0 (Critical) | 2 weeks | Maintainability | Code architecture that enables all future work |
| **Phase 3** | P1 (High) | 4 weeks | Functionality | Core features needed for real campus deployment |
| **Phase 4** | P1 (High) | 2 weeks | UX | Real-time updates and notifications for responsive experience |
| **Phase 5** | P2 (Medium) | 2 weeks | Insights | Analytics and reporting for campus administration |
| **Phase 6** | P1 (High) | 2 weeks | Reliability | Infrastructure for production deployment |
| **Phase 7** | P3 (Low) | 4 weeks | Enhancement | Advanced features for a polished product |
| **Phase 8** | P1 (High) | 2 weeks | Quality | Testing ensures reliability in production |

### Recommended Implementation Order

```
Week 1-2:   Phase 1 (Security)       <- START HERE, non-negotiable
Week 3-4:   Phase 2 (Code Quality)   <- enables everything else
Week 5-6:   Phase 6 (Infrastructure) <- CI/CD, Edge Functions, monitoring
Week 7-10:  Phase 3 (Core Features)  <- capacity enforcement, approvals, QR security
Week 11-12: Phase 4 (Real-Time)      <- replace polling with Realtime
Week 13-14: Phase 8 (Testing)        <- automated tests before going live
Week 15-16: Phase 5 (Analytics)      <- admin reporting
Week 17-20: Phase 7 (Advanced)       <- payments, reservations, PWA, i18n
```

### Quick Wins (Can Be Done in 1-2 Days Each)
1. Add `.env` to `.gitignore` and rotate keys
2. Replace `Math.random()` OTP with `crypto.getRandomValues()`
3. Add `aria-label` to all icon buttons
4. Create `constants.js` and extract all magic numbers
5. Add React Error Boundary
6. Fix `window.location.reload()` and `window.location.href` usages
7. Fix missing useEffect dependencies
8. Add 404 page
9. Add `:focus-visible` styles to inputs and buttons
10. Restrict ANPR server CORS origins

---

## Summary

ParkEase has a solid MVP foundation with working check-in/check-out, QR scanning, guest passes, and admin management. However, **it is not production-ready** due to critical security vulnerabilities (client-side role assignment, exposed credentials, unsecured ANPR server) and architectural limitations (no server-side logic, no error handling, no tests).

The most important transformation is **moving business logic server-side** via Supabase Edge Functions. This single change addresses the majority of security concerns and enables proper validation, rate limiting, and audit logging.

The estimated timeline is **20 weeks** for a full production-ready deployment, or **6-8 weeks** for a minimally secure deployment (Phases 1, 2, and critical parts of Phase 3).
