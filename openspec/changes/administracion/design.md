# Design: Administration Module

## Technical Approach

The Administration Module will be documented comprehensively through:
1. **Specification**: Capture all 15 main requirements with 42+ given/when/then scenarios
2. **Architecture Documentation**: Preserve design decisions for User model, RBAC, audit logging, and API patterns
3. **Interface Contracts**: Define API endpoints, data structures, and type signatures
4. **Testing Strategy**: Multi-layer approach (unit, integration, E2E) with 80%+ coverage targets

This approach leverages the **existing codebase patterns** (RTK Query, Zod validation, middleware-based auth, Prisma ORM) and documents how they apply to admin features. No refactoring is required; documentation establishes the baseline for future enhancements (2FA, password reset, rate limiting, etc.).

**Key principle**: Follow existing patterns in the codebase rather than introducing new paradigms.

---

## Architecture Decisions

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| **API Pattern** | RESTful with middleware auth | GraphQL, RPC | REST is established in project; `withAuthGet`/`withAuthPost` middleware already used project-wide for consistency |
| **Password Hashing** | bcryptjs (salt=12) | Argon2, scrypt | bcryptjs already in use; 12 rounds provides good security/perf balance for admin operations |
| **JWT Token Expiry** | 8 hours | 24h, 30m | Balances convenience (same workday) with security (limits token reuse window) |
| **Audit Logging** | Immutable append-only UserActivityLog | Mutable history in User model | Immutable design prevents tampering; separate table follows single-responsibility principle |
| **Session Management** | UserSession table with token tracking | JWT-only (stateless) | Allows server-side revocation (critical for logout) and session monitoring; hybrid approach |
| **Role-Based Access Control** | 3 hardcoded roles in enum (Admin, RegularUser, Dependiente) | Attribute-Based Access Control (ABAC) | 3 roles sufficient for current needs; ABAC adds complexity without current benefit (future enhancement) |
| **Account Lock Mechanism** | Auto-lock after 3 failed attempts (30 min) | IP-based rate limiting, password expiry | Clear UX; prevents brute force while allowing legitimate retries after timeout |
| **Expiration Handling** | Configurable per-user date with advance notifications | System-wide expiration policy | Per-user flexibility for contract renewals, temporary access, etc. |
| **Activity Chart Rendering** | Client-side (Recharts in React component) | Server-side (static image), WebGL (Visx) | Client-side is responsive, interactive; matches existing dashboard patterns in project |
| **Export Format** | CSV + JSON (Excel via third-party) | CSV-only, Excel-only | Multiple formats serve different workflows; Zod validation ensures data integrity on export |
| **Real-Time Monitoring** | Polling with React Query + optional WebSocket future | Polling-only, WebSocket-only | Polling is reliable with RTK Query caching; WebSocket added in Phase 2 if needed |
| **Database Indexing** | Composite index on (email, userId) for search | No indexing, full-table scan | Email/userId are frequent query filters; index improves search < 500ms target |

### Rationale for Key Decisions

**Why preserve existing patterns?**
- **Consistency**: Using `withAuthGet`/`withAuthPost` middleware maintains parity with all other API routes
- **Maintainability**: Team is familiar with Zod validation, RTK Query caching, Prisma ORM
- **Testing**: Existing test infrastructure (Vitest, Testing Library) applies directly

**Why immutable audit logs?**
- **Compliance**: Meets SOC 2, GDPR audit trail requirements (2+ year retention)
- **Integrity**: Prevents accidental deletion or tampering of access logs
- **Traceability**: Every action (create, update, delete, lock) is traceable to an admin

**Why 3 hardcoded roles instead of custom roles?**
- **Current State**: Project operates with 3 clear roles
- **Future Enhancement**: ABAC in Phase 2 adds granular permissions without breaking this baseline
- **Simplicity**: Reduces configuration surface area during initial implementation

---

## Data Flow

### User CRUD Flow

```
Admin View /busy/admin/usuarios
    │
    ├─→ RTK Query Hook: useGetUserQuery()
    │       │
    │       └─→ GET /api/admin/users (with JWT)
    │            │
    │            ├─ Middleware validates token + Admin role
    │            │
    │            └─ Prisma User.findMany() [indexed on email]
    │                 │
    │                 └─ Returns: [{ userId, name, email, role, isActive, lastLoginAt, expiresAt }, ...]
    │
    ├─ RTK Query caches result (tagged: 'Admin')
    │
    └─ Table renders with filtering/sorting (client-side)

On Create User:
    │
    ├─→ CreateUserDialog
    │       │
    │       └─→ POST /api/admin/users (with body: name, email, password, role, daysToExpire)
    │            │
    │            ├─ Zod schema validates: email format, password strength, role enum
    │            │
    │            ├─ Check duplicate: Prisma findUnique on email
    │            │
    │            ├─ Hash password: bcryptjs.hash(password, 12)
    │            │
    │            ├─ Create user: Prisma User.create()
    │            │    └─ Set: isActive=false (requires admin activation), activatedAt=NOW()
    │            │
    │            ├─ Log action: Prisma UserActivityLog.create()
    │            │    └─ action='create_user', performedBy=adminId
    │            │
    │            ├─ Send email: sendNewUserNotification(email, role, adminEmail)
    │            │
    │            └─ Return: HTTP 201 with new user object
    │
    └─ RTK Query invalidates 'Admin' tag → refetch list

On Update/Delete/Lock/Unlock:
    └─ Same pattern: POST/PUT → Middleware validates role → Prisma mutation → Log action → Invalidate cache
```

### Login & Session Flow

```
User Login at /auth/login
    │
    ├─→ POST /auth/login (email, password)
    │       │
    │       ├─ Find user: Prisma User.findUnique(email)
    │       │
    │       ├─ Check if active: isActive === true
    │       │
    │       ├─ Check if not locked: lockedUntil < NOW() (else reject)
    │       │
    │       ├─ Check if not expired: expiresAt > NOW() (else reject)
    │       │
    │       ├─ Compare password: bcryptjs.compare(password, hashedPassword)
    │       │    │
    │       │    ├─ On success:
    │       │    │    ├─ Reset loginAttempts = 0
    │       │    │    ├─ Set lastLoginAt = NOW()
    │       │    │    ├─ Generate JWT: { userId, email, role, iat, exp: NOW + 8h }
    │       │    │    ├─ Create session: Prisma UserSession.create()
    │       │    │    │    └─ store token (hashed), ipAddress, userAgent
    │       │    │    └─ Log: UserActivityLog (action='login', status='success')
    │       │    │
    │       │    └─ On failure:
    │       │         ├─ Increment loginAttempts++
    │       │         ├─ If loginAttempts >= 3: Set lockedUntil = NOW() + 30min
    │       │         ├─ Log: UserActivityLog (action='login', status='failed')
    │       │         └─ Reject with generic "Invalid credentials"
    │       │
    │       └─ Return: { token, userId, role, expiresAt }
    │
    └─ Client stores JWT in httpOnly cookie (or localStorage with CSRF token)

On Protected Request (e.g., POST /api/admin/users):
    │
    ├─ Middleware: withAuthPost extracts JWT from Authorization header
    │       │
    │       ├─ Verify signature + expiry
    │       │
    │       ├─ Look up session: Prisma UserSession.findUnique(token)
    │       │    └─ Check isActive=true and not expired
    │       │
    │       └─ Extract userId, email, role
    │
    ├─ Route handler receives { userId, email, role } as 'user' parameter
    │
    ├─ If operation requires Admin: isAdminRole(user.role) check
    │
    └─ On success/failure: optionally update lastActive in UserSession
```

### Audit & Activity Flow

```
Every CRUD/sensitive operation:
    │
    ├─→ Prisma UserActivityLog.create()
    │       │
    │       └─ Record: {
    │            userId: affected user,
    │            action: 'create_user' | 'update_user' | 'delete_user' | 'lock' | 'unlock' | 'password_reset',
    │            status: 'success' | 'failed',
    │            performedBy: admin userId,
    │            ipAddress: request.headers['x-forwarded-for'],
    │            userAgent: request.headers['user-agent'],
    │            details: JSON.stringify({ before, after, reason }),
    │            createdAt: NOW()
    │          }
    │
    └─ Audit log is immutable (no update/delete operations allowed)

View Login History:
    │
    ├─→ GET /api/admin/users/:id/login-history?limit=50&offset=0
    │       │
    │       ├─ Filter: action IN ['login', 'logout', 'session_terminated']
    │       │
    │       └─ Prisma UserActivityLog.findMany({ where: { userId, action }, orderBy: { createdAt: 'desc' } })
    │            │
    │            └─ Return: [{ timestamp, status, ipAddress, userAgent, action, details }, ...]
    │
    └─ Display in LoginHistoryDialog with sortable/filterable table
```

### Dashboard & Metrics Flow

```
Open /busy/admin/usuarios:
    │
    ├─→ Load KPI Cards (parallel):
    │    ├─ Total Active Users: COUNT(User.isActive=true)
    │    ├─ Expiring Soon: COUNT(User.expiresAt BETWEEN NOW and NOW+30d)
    │    ├─ Locked Accounts: COUNT(User.lockedUntil > NOW)
    │    ├─ Failed Logins (24h): COUNT(UserActivityLog.action='login' AND status='failed' AND createdAt > NOW-24h)
    │    └─ Active Sessions: COUNT(UserSession.isActive=true)
    │
    ├─→ Load UserActivityCharts (dynamic import):
    │    │
    │    ├─ GET /api/admin/users/user-metrics?months=1
    │    │       │
    │    │       └─ Aggregate: {
    │    │            dailyLogins: [{ date, count }, ...],
    │    │            loginsByRole: { admin: N, regularUser: M, dependiente: K },
    │    │            failedLoginTrend: [{ date, count }, ...],
    │    │            newUsersByMonth: N
    │    │          }
    │    │
    │    └─ Recharts render: Line chart (daily logins), Bar chart (by role), Pie chart (by status)
    │
    ├─→ Load TemporalDashboard (dynamic import):
    │    │
    │    └─ Allow month/year selection → GET /api/admin/users/user-metrics?months=1&month=2024-03
    │         └─ Show drill-down metrics for selected month
    │
    └─ Load UserMonitoringPanel (dynamic import):
        │
        ├─ Poll GET /api/admin/sessions (every 10s)
        │    └─ List active sessions: userId, email, role, ipAddress, createdAt, lastActivity
        │
        └─ Show activity feed: [{ timestamp, action, userId, details }, ...] (last 20, streaming updates)
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `openspec/specs/administracion/spec.md` | Create | Full specification (15 requirements, 42+ scenarios, 446 lines) |
| `openspec/changes/administracion/proposal.md` | Create | Proposal documenting scope, success criteria, timeline |
| `openspec/changes/administracion/design.md` | Create | This file; architecture decisions and technical approach |
| `prisma/schema.prisma` | Modify | Add database indexes on `User.email` and `UserActivityLog.userId` for performance; ensure nullable fields align with spec |
| `src/lib/auth/roles.ts` | Verify/Modify | Ensure 3 roles (Admin, RegularUser, Dependiente) are defined; document role definitions clearly |
| `src/lib/auth-middleware.ts` | Verify | Validate `withAuthGet`/`withAuthPost` implement JWT verification + session lookup as designed |
| `src/app/api/admin/users/route.ts` | Verify | Confirm GET (list), POST (create) follow spec; add pagination, filtering, search |
| `src/app/api/admin/users/[id]/route.ts` | Verify | Confirm PUT (update), DELETE (soft delete) follow spec |
| `src/app/api/admin/users/[id]/login-history/route.ts` | Verify | Confirm GET returns login history with filters |
| `src/app/api/admin/users/lock/route.ts` | Verify | Confirm POST locks account, sets lockedUntil, invalidates sessions |
| `src/app/api/admin/users/unlock/route.ts` | Verify | Confirm POST unlocks, resets loginAttempts |
| `src/app/api/admin/users/expiring-soon/route.ts` | Verify | Confirm GET returns users expiring within N days |
| `src/app/api/admin/users/export/route.ts` | Verify | Confirm GET supports CSV/JSON export with filtering |
| `src/app/api/admin/users/user-metrics/route.ts` | Verify | Confirm GET returns temporal metrics (daily logins, by role, trends) |
| `src/lib/admin/schemas.ts` | Verify | Zod schemas for validation (createUserBodySchema, updateUserBodySchema, etc.) |
| `src/lib/redux/services/adminApi.tsx` | Verify | RTK Query endpoints for all admin operations (getUser, addUser, updateUser, deleteUser, etc.) |
| `src/components/admin/admin-users-table.tsx` | Verify | Table with filtering, search, sorting, delete confirm dialog |
| `src/components/admin/create-user-dialog.tsx` | Verify | Form for creating users; validates input with Zod schemas |
| `src/components/admin/edit-user-dialog.tsx` | Verify | Form for editing user; supports role/status/expiration changes |
| `src/components/admin/login-history-dialog.tsx` | Verify | Dialog showing user's login history; sortable by date/status |
| `src/components/admin/user-activity-charts.tsx` | Verify | Recharts components for daily logins, by role, by status trends |
| `src/components/admin/temporal-dashboard.tsx` | Verify | Month/year selector with metrics drill-down |
| `src/components/admin/user-monitoring-panel.tsx` | Verify | Real-time polling of active sessions and activity feed |
| `src/app/busy/admin/usuarios/page.tsx` | Verify | Main admin dashboard; integrates table, KPIs, charts, dialogs |
| `src/app/busy/admin/migrate/page.tsx` | Verify | Data migration UI for bulk user import from CSV |
| `src/app/models/model.ts` | Verify | TypeScript interfaces (Usuario, UserActivityLog, UserSession) match Prisma schema |
| `src/lib/email.ts` | Verify | Email functions: sendNewUserNotification, sendExpirationWarning, sendAccountLockedNotification |
| `src/lib/__tests__/admin-*.test.ts` | Create | Unit tests for validation, password hashing, audit logging |
| `src/app/api/admin/**/__tests__/route.test.ts` | Create | Integration tests for all 12 API endpoints |
| `src/components/admin/__tests__/*.test.tsx` | Create | React Testing Library tests for components (table, forms, charts) |
| `src/__tests__/e2e/admin-flow.test.ts` | Create | E2E tests: login, create user, edit, lock/unlock, export |

**Summary of Changes**:
- **New**: 3 documentation files (spec, proposal, design), ~20 test files
- **Verify**: 22 existing files (no breaking changes; tests validate current behavior)
- **Modify**: 2 files (schema indexes, roles documentation)

---

## Interfaces / Contracts

### API Response Types

```typescript
// User DTO (returned from all endpoints)
interface UserDTO {
  userId: string
  name: string
  email: string
  role: 'admin' | 'regularUser' | 'dependiente'
  isActive: boolean
  createdAt: Date
  activatedAt?: Date | null
  expiresAt?: Date | null
  lastLoginAt?: Date | null
  lastModifiedBy?: string | null
}

// Create User Payload
interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: 'admin' | 'regularUser' | 'dependiente'
  daysToExpire?: number
}

// Update User Payload (all fields optional)
interface UpdateUserPayload {
  name?: string
  email?: string
  password?: string
  role?: 'admin' | 'regularUser' | 'dependiente'
  isActive?: boolean
  daysToExpire?: number
}

// Activity Log Entry
interface ActivityLogEntry {
  id: string
  userId: string
  action: 'login' | 'logout' | 'create_user' | 'update_user' | 'delete_user' | 'lock' | 'unlock' | 'password_reset' | 'session_terminated'
  status: 'success' | 'failed'
  performedBy?: string
  ipAddress?: string | null
  userAgent?: string | null
  details?: string | null
  createdAt: Date
}

// Session Info
interface SessionInfo {
  id: string
  userId: string
  token: string
  ipAddress?: string | null
  userAgent?: string | null
  isActive: boolean
  expiresAt?: Date | null
  createdAt: Date
  lastActive: Date
}

// Metrics Response
interface MetricsResponse {
  dailyLogins: { date: string; count: number }[]
  loginsByRole: { admin: number; regularUser: number; dependiente: number }
  failedLoginTrend: { date: string; count: number }[]
  newUsersByMonth: number
  activeUsersByMonth: number
  expiredUsersByMonth: number
}

// Export Response (streamed as attachment)
interface ExportData {
  format: 'csv' | 'json'
  data: UserDTO[]
  exportedAt: Date
  exportedBy: string
}

// Error Response
interface ErrorResponse {
  error: string
  message: string
  details?: Record<string, unknown>
  statusCode: number
}
```

### RTK Query Endpoints

```typescript
export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUser: builder.query<UserDTO[], void>
    addUser: builder.mutation<UserDTO, CreateUserPayload>
    updateUser: builder.mutation<UserDTO, UpdateUserPayload & { userId: string }>
    deleteUser: builder.mutation<{ success: boolean; userId: string }, string>
    lockUser: builder.mutation<UserDTO, { userId: string; reason?: string }>
    unlockUser: builder.mutation<UserDTO, string>
    getLoginHistory: builder.query<ActivityLogEntry[], { userId: string; limit?: number }>
    getExpiringUsers: builder.query<UserDTO[], { days?: number }>
    notifyExpiringUsers: builder.mutation<{ sent: number }, { days?: number }>
    exportUsers: builder.query<Blob, { format: 'csv' | 'json' }>
    getUserMetrics: builder.query<MetricsResponse, { months?: number }>
    getSessions: builder.query<SessionInfo[], void>
  })
})
```

### Validation Schemas (Zod)

```typescript
export const createUserBodySchema = z.object({
  name: z.string().trim().min(1, 'Name required'),
  email: z.string().trim().email('Invalid email'),
  password: z.string()
    .min(8, 'Min 8 chars')
    .regex(/[A-Z]/, 'Needs uppercase')
    .regex(/[0-9]/, 'Needs number')
    .regex(/[!@#$%^&*]/, 'Needs special char'),
  role: z.enum(['admin', 'regularUser', 'dependiente']),
  daysToExpire: z.number().int().min(1).max(3650).optional()
})

export const updateUserBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['admin', 'regularUser', 'dependiente']).optional(),
  isActive: z.boolean().optional(),
  daysToExpire: z.number().int().min(1).max(3650).optional()
}).refine(obj => Object.keys(obj).length > 0, 'At least one field required')
```

---

## Testing Strategy

### Unit Tests

| What to Test | Location | Approach |
|--|--|--|
| Password strength validation | `src/lib/__tests__/password-strength.test.ts` | Zod schema validation: min 8 chars, uppercase, number, special |
| Email format validation | `src/lib/__tests__/email-validation.test.ts` | Zod schema validation: RFC 5322 |
| Role-based permission check | `src/lib/__tests__/auth-roles.test.ts` | isAdminRole(role) returns true for 'admin' only |
| Account lock after 3 attempts | `src/lib/__tests__/account-lock.test.ts` | Simulate 3 failed logins, verify lockedUntil set |
| Password hashing | `src/lib/__tests__/password-hash.test.ts` | bcryptjs.hash() produces consistent salted hashes |
| JWT token generation | `src/lib/__tests__/jwt.test.ts` | Token signed, expired after 8h, verified on decode |
| Session creation | `src/lib/__tests__/session.test.ts` | UserSession record created, token stored, isActive=true |
| Activity log immutability | `src/lib/__tests__/audit-log.test.ts` | UserActivityLog has no delete/update operations |
| Expiration check | `src/lib/__tests__/expiration.test.ts` | User rejected at login if expiresAt < NOW |
| CSV export formatting | `src/lib/admin/__tests__/csv.test.ts` | Existing; verify escaping, headers, data integrity |

**Coverage Target**: 85%+ for unit tests

### Integration Tests

| What to Test | Location | Approach |
|--|--|--|
| POST /api/admin/users (create with validation) | `src/app/api/admin/users/__tests__/route.test.ts` | Valid payload → 201, invalid → 400 |
| POST /api/admin/users (duplicate email) | Same | Create 2 users with same email → 409 Conflict |
| GET /api/admin/users (list with pagination) | Same | Query ?page=2&limit=20 → returns paginated, tagged results |
| GET /api/admin/users (search by name/email) | Same | Query ?search=john → filters on client OR server-side |
| PUT /api/admin/users/:id (update role) | `src/app/api/admin/users/[id]/__tests__/route.test.ts` | Update role → invalidates sessions → user must re-auth |
| DELETE /api/admin/users/:id (soft delete) | Same | Delete user → isActive=false, audit logged |
| POST /api/admin/users/:id/lock | `src/app/api/admin/users/[id]/lock/__tests__/route.test.ts` | Lock → lockedUntil set, sessions invalidated |
| POST /api/admin/users/:id/unlock | `src/app/api/admin/users/[id]/unlock/__tests__/route.test.ts` | Unlock → lockedUntil=null, loginAttempts=0 |
| GET /api/admin/users/:id/login-history | `src/app/api/admin/users/[id]/login-history/__tests__/route.test.ts` | Return last 50 logins, filterable by status |
| GET /api/admin/users/expiring-soon | `src/app/api/admin/users/expiring-soon/__tests__/route.test.ts` | List users expiring in next N days |
| GET /api/admin/users/export | `src/app/api/admin/users/export/__tests__/route.test.ts` | Export CSV/JSON with filters applied |
| GET /api/admin/users/user-metrics | `src/app/api/admin/users/user-metrics/__tests__/route.test.ts` | Return daily logins, by role, trends |
| Auth middleware (withAuthPost) | `src/lib/__tests__/auth-middleware.test.ts` | Valid JWT → grants access, invalid → 401 |
| Role check (isAdminRole) | `src/lib/__tests__/auth-roles.test.ts` | Admin role → allowed, RegularUser → 403 |
| Email notification | `src/lib/__tests__/email-notifications.test.ts` | sendNewUserNotification() queues email |

**Coverage Target**: 80%+ for integration tests

### E2E Tests

| What to Test | Location | Approach | Tool |
|--|--|--|--|
| Login flow: successful | `src/__tests__/e2e/admin-flow.test.ts` | User logs in → redirects to /busy/admin → sees dashboard | Playwright |
| Login flow: failed (3 attempts) | Same | User fails 3 times → account locked → tries 4th → 30min wait message | Playwright |
| Create user workflow | Same | Admin fills form → submits → user appears in table → email sent | Playwright + mock email |
| Edit user & role change | Same | Admin edits user role → session invalidated → user re-auth required | Playwright |
| Export CSV | Same | Admin clicks export → CSV downloads → has correct headers/data | Playwright |
| Real-time monitoring update | Same | New user created → monitoring panel updates (if WebSocket) | Playwright |

**Coverage Target**: Core workflows + happy path + error scenarios

### Test Infrastructure

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      lines: 80
    }
  }
})

// Testing Library + RTK setup
import { renderHook, waitFor } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { rest } from 'msw'

// Mock API responses in tests
const server = setupServer(
  rest.get('/api/admin/users', (req, res, ctx) =>
    res(ctx.json([{ userId: '1', name: 'John', email: 'john@ex.com', role: 'admin' }]))
  )
)
```

---

## Migration / Rollout

### Phase 1: Documentation (This Change)
1. **Week 1**: Write specification (42+ scenarios)
2. **Week 1-2**: Create design document (architecture decisions)
3. **Week 2**: Task breakdown (implementation checklist)
4. **Week 2**: Verification against existing code

**No schema changes required.** The specification documents the current state.

### Phase 2: Enhancements (Backlog - Separate Changes)
1. **Password Reset**: New endpoint, email token, secure flow
2. **2FA / TOTP**: Google Authenticator integration
3. **Rate Limiting**: Redis-backed rate limiter on login
4. **Granular Permissions**: Custom role creation UI
5. **Webhooks**: Event-based notifications
6. **OpenAPI**: Auto-generated API documentation

Each Phase 2 item will have its own proposal, spec, and design.

---

## Open Questions

- [ ] **Email Verification**: Should newly created users have email verification before activation, or is admin creation sufficient?
  - *Current assumption*: Admin creation is sufficient (admin verified the email address)
  - *Decision needed*: Or require email verification link?

- [ ] **Password Reset**: Should users be able to reset their own password, or only admin-initiated?
  - *Current assumption*: Admin-initiated only (future feature for Phase 2)
  - *Decision needed*: Scope this for Phase 2 or earlier?

- [ ] **2FA Requirement**: Should admins be required to use 2FA, or optional?
  - *Current assumption*: Optional in Phase 2
  - *Decision needed*: Mandatory for production?

- [ ] **Export Retention**: How long should exported data be retained in audit trail?
  - *Current assumption*: Log the export action, but not the actual data (privacy)
  - *Decision needed*: Or store exported data snapshots for recovery?

- [ ] **Rate Limiting**: Should rate limiting be global (5 attempts per IP per 15 min) or per email?
  - *Current assumption*: Per IP (prevents enumeration attacks)
  - *Decision needed*: Or per email (prevents account lockout spam)?

---

## Risk Assessment

### Low Risk
- ✅ Documentation of existing features (no code changes)
- ✅ Following established patterns (RTK Query, Zod, middleware)
- ✅ No database schema breaking changes (just add indexes)

### Medium Risk
- ⚠️ Test coverage may reveal edge cases (design handles but code may not)
- ⚠️ Performance targets (< 500ms search) may require index optimization
- ⚠️ Security baseline may identify vulnerabilities in existing code

### Mitigation
- Review existing code against spec in verification phase (sdd-verify)
- Run performance tests with 10K+ users to validate targets
- Security audit of password hashing, JWT implementation, SQL injection prevention
- Fix issues in separate Phase 2 change if identified

---

## Success Criteria

✅ **Specification**: 15 main requirements, 42+ Given/When/Then scenarios documented
✅ **Design**: Architecture decisions with rationales for all 10+ key choices
✅ **Interfaces**: API contracts (request/response types) fully defined
✅ **Testing**: Multi-layer strategy (unit, integration, E2E) with coverage targets
✅ **Files**: All 22 existing files verified against spec; no breaking changes
✅ **Performance**: Targets set (< 1.5s dashboard, < 500ms search)
✅ **Security**: Baseline established (bcryptjs, JWT, audit, rate limiting)
✅ **Zero Blockers**: All open questions resolved or documented for Phase 2

---

## Next Steps

1. **Create Task Breakdown** (sdd-tasks): Convert spec + design into implementation checklist
2. **Verify Implementation** (sdd-verify): Run all 42+ scenarios against existing code
3. **Test Execution**: Write and run unit/integration/E2E tests to 80%+ coverage
4. **Security Audit**: External review of password hashing, JWT, session management
5. **Performance Testing**: Load test with 10K+ users, verify < 500ms search
6. **Phase 2 Planning**: Create proposals for password reset, 2FA, rate limiting, etc.

