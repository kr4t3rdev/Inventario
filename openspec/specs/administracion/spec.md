# Specification: Administration Module

---

## Purpose

The Administration Module provides system administrators with comprehensive tools to manage users, monitor system activity, control access, and maintain data integrity. This specification covers all requirements for user management, authentication control, activity tracking, and administrative operations.

---

## Requirements

### Requirement: User Management - Full CRUD Operations

The system MUST provide complete Create, Read, Update, and Delete operations for user accounts.

#### Scenario: Create New User

- **GIVEN** an Admin user accesses the user creation form
- **WHEN** the Admin fills in: name, email, role, initial password, and expiration date
- **THEN** the system MUST:
  - Validate email format (RFC 5322)
  - Validate password strength (min 8 chars, 1 uppercase, 1 number, 1 special char)
  - Hash the password using bcryptjs
  - Store the user in the database with status `isActive = true`
  - Set `createdAt` timestamp
  - Return success with user ID and confirmation message
- **AND** the new user MUST be able to login immediately

#### Scenario: Read User Details

- **GIVEN** an Admin user views a specific user profile
- **WHEN** the Admin clicks on a user in the users table
- **THEN** the system MUST display:
  - All user fields (userId, name, email, role, isActive, createdAt, expiresAt)
  - Current account status (active, locked, expired)
  - Last login timestamp
  - Total login attempts
  - Login history (last 10 sessions)
- **AND** provide links to edit or delete the user

#### Scenario: Update User Information

- **GIVEN** an Admin user is editing an existing user
- **WHEN** the Admin modifies fields (name, email, role, expiration date)
- **THEN** the system MUST:
  - Validate all changes before saving
  - Update the database record
  - Record the change in audit log with timestamp and Admin ID
  - Invalidate any active sessions if email changes
  - Return success message
- **AND** the updated user information MUST be immediately visible in the admin dashboard

#### Scenario: Delete User Account

- **GIVEN** an Admin user initiates deletion of a user account
- **WHEN** the Admin confirms the deletion (two-step confirmation required)
- **THEN** the system MUST:
  - Set `isActive = false` (soft delete, not physical removal)
  - Record deletion in audit log with reason
  - Invalidate all active sessions for that user
  - Prevent the user from logging in
- **AND** the deleted user MUST remain in database for audit trail
- **AND** the user record MUST be recoverable by an Admin if needed

---

### Requirement: User Access Control - Account Lock/Unlock

The system MUST implement automatic account locking after failed login attempts and provide manual unlock capability.

#### Scenario: Automatic Lock After Failed Attempts

- **GIVEN** a user submits an incorrect password
- **WHEN** the login attempt fails
- **THEN** the system MUST:
  - Increment `loginAttempts` counter
  - Increment counter after each failed attempt
  - Check if `loginAttempts >= 3`
- **AND** if 3 failed attempts are reached:
  - Set `lockedUntil = NOW() + 30 minutes`
  - Mark account as locked
  - Show message: "Account locked. Try again after 30 minutes"
  - Do NOT reveal that this is an automatic lock

#### Scenario: Automatic Unlock After Timeout

- **GIVEN** an account is locked with `lockedUntil = 14:00`
- **WHEN** the current time reaches or passes 14:30
- **THEN** the system MUST:
  - Allow the user to attempt login
  - Reset `loginAttempts = 0` automatically
  - Log the unlock event in audit trail

#### Scenario: Manual Unlock by Admin

- **GIVEN** an Admin views a locked user account
- **WHEN** the Admin clicks "Unlock Account" button
- **THEN** the system MUST:
  - Set `lockedUntil = null`
  - Reset `loginAttempts = 0`
  - Log the manual unlock with Admin ID and timestamp
  - Send notification email to the user (optional)

---

### Requirement: User Expiration Management

The system MUST support configurable account expiration dates and provide advance notifications.

#### Scenario: Set Account Expiration

- **GIVEN** an Admin is creating or editing a user
- **WHEN** the Admin sets `expiresAt` to a future date (e.g., 90 days)
- **THEN** the system MUST:
  - Store the expiration date
  - Allow login until expiration date + end of day
  - After expiration, reject login with message: "Account has expired. Contact administrator"

#### Scenario: Identify Expiring Users

- **GIVEN** the system runs a background check (daily)
- **WHEN** users have `expiresAt - NOW() <= 30 days`
- **THEN** the system MUST:
  - Identify those users as "expiring soon"
  - Make them available in a special report view
  - Track expiration status in dashboard KPIs

#### Scenario: Notify Expiring Users

- **GIVEN** users are 7 days before expiration
- **WHEN** a scheduled notification job runs
- **THEN** the system MUST:
  - Send email notification with expiration date
  - Include renewal instructions or contact information
  - Log the notification in audit trail
  - Allow Admin to manually trigger notifications

---

### Requirement: Login History and Activity Tracking

The system MUST record all login events and provide detailed activity audit trail.

#### Scenario: Record Successful Login

- **GIVEN** a user provides valid credentials
- **WHEN** authentication succeeds
- **THEN** the system MUST:
  - Create `UserActivityLog` entry with:
    - userId, timestamp, action="login", status="success"
    - IP address, user agent, device/browser info
    - Session ID
  - Create `UserSession` entry with:
    - sessionId, userId, createdAt, expiresAt, ipAddress
  - Reset `loginAttempts = 0`
  - Update `lastLoginAt` timestamp on user record
  - Return authentication token (JWT)

#### Scenario: Record Failed Login Attempt

- **GIVEN** a user provides invalid credentials
- **WHEN** authentication fails
- **THEN** the system MUST:
  - Create `UserActivityLog` with action="login", status="failed"
  - Record reason (invalid password, user not found, etc.)
  - Log IP address and timestamp
  - Do NOT reveal specifics to user (no email enumeration)

#### Scenario: View Login History

- **GIVEN** an Admin views a user's login history
- **WHEN** the Admin opens the "Login History" dialog
- **THEN** the system MUST display:
  - Last 50 login attempts (successful and failed)
  - Timestamp, status (success/failed), IP address, device/browser
  - Session duration (for successful logins)
  - Sortable and filterable by date, status
- **AND** the data MUST load within 2 seconds

#### Scenario: Session Management

- **GIVEN** a user has multiple active sessions
- **WHEN** an Admin views the user's active sessions
- **THEN** the system MUST display:
  - All active sessions with created time, last activity, IP address
  - Provide ability to terminate individual sessions
  - Automatically expire sessions after 8 hours of inactivity
- **AND** when a session is terminated:
  - Invalidate the JWT token
  - Force re-authentication on next request
  - Log the termination with reason

---

### Requirement: Dashboard and Metrics

The system MUST provide a comprehensive admin dashboard with key performance indicators and analytics.

#### Scenario: Admin Dashboard Display

- **GIVEN** an Admin accesses `/busy/admin/usuarios`
- **WHEN** the dashboard loads
- **THEN** the system MUST display:
  - **KPI Cards (5 total)**:
    1. Total Active Users
    2. Users Expiring Soon (within 30 days)
    3. Locked Accounts
    4. Failed Login Attempts (last 24h)
    5. Active Sessions Right Now
  - **User Table** with columns:
    - Name, Email, Role, Status (Active/Locked/Expired), Last Login, Actions
    - Sortable by each column
    - Pagination (20 rows per page)
    - Search by name/email (real-time, debounced 300ms)
  - **Activity Charts**:
    - Line chart: Daily login count (last 30 days)
    - Bar chart: Logins by role/department
    - Pie chart: Active users by role

#### Scenario: Filter Users in Table

- **GIVEN** an Admin views the users table
- **WHEN** the Admin applies filters (role, status, date range)
- **THEN** the system MUST:
  - Filter results in real-time
  - Show count: "Showing X of Y users"
  - Maintain search term + filters together
  - Persist filter state in URL (for bookmarking)

#### Scenario: Export User Data

- **GIVEN** an Admin views the users table
- **WHEN** the Admin clicks "Export" button
- **THEN** the system MUST:
  - Provide export format options: CSV, JSON, Excel
  - Include all visible columns (name, email, role, status, lastLogin, etc.)
  - Apply current filters to export
  - Include export timestamp and admin ID in file
  - Download file with naming: `users_export_YYYY-MM-DD.csv`

---

### Requirement: Role and Permission System

The system MUST enforce role-based access control with three predefined roles.

#### Scenario: Define Role Permissions

- **GIVEN** the system has three roles defined:
- **WHEN** a user with a role attempts to access a resource
- **THEN** the system MUST enforce these permissions:

**Role: Admin**
- Access: ALL routes (`/api/*`, `/busy/*`)
- Can: Create, read, update, delete users
- Can: View all admin functions, export data
- Can: Manage system configuration
- Can: View all audit logs

**Role: RegularUser**
- Access: `/busy/ventas`, `/busy/servicios`, `/busy/reportes`, `/busy/restaurante`
- Can: Record sales, services, reports
- Cannot: Access admin panel
- Cannot: View other users' activity
- Cannot: Modify system settings

**Role: Dependiente** (Employee)
- Access: `/busy/ventas`, `/busy/servicios`, `/busy/reportes`, `/busy/restaurante`
- Can: Same as RegularUser (sales, services, reports)
- Cannot: Access admin or advanced features

#### Scenario: Check Role on Protected Route

- **GIVEN** a user with role "RegularUser" attempts to access `/busy/admin/usuarios`
- **WHEN** the request is made
- **THEN** the system MUST:
  - Check JWT token and extract role
  - Verify role has permission for route
  - Reject with 403 Forbidden if not authorized
  - Log the unauthorized attempt in audit trail
  - Redirect to unauthorized page or dashboard

#### Scenario: Role Change for User

- **GIVEN** an Admin changes a user's role from "RegularUser" to "Admin"
- **WHEN** the update is saved
- **THEN** the system MUST:
  - Update the user's role in database
  - Invalidate all active sessions for that user (require re-login)
  - Log the role change with timestamp and admin ID
  - Send notification email to user (optional)

---

### Requirement: Audit and Compliance Logging

The system MUST maintain comprehensive audit trail for all administrative actions.

#### Scenario: Log Administrative Action

- **GIVEN** an Admin performs an action (create, update, delete user)
- **WHEN** the action is saved
- **THEN** the system MUST create `UserActivityLog` entry with:
  - Action type (user_created, user_updated, user_deleted, password_reset, role_changed)
  - Admin ID who performed action
  - User ID affected
  - Timestamp
  - Details/changes made
  - IP address
  - Status (success/failure)
- **AND** the audit log MUST be immutable (no edits or deletes)
- **AND** the audit log MUST be retained for minimum 2 years

#### Scenario: View Audit Trail

- **GIVEN** an Admin needs to investigate a security event
- **WHEN** the Admin accesses the audit log report
- **THEN** the system MUST display:
  - All actions filtered by date range, user, action type
  - Details of what changed (before/after values for updates)
  - Admin who made the change
  - Searchable by user email, action type
- **AND** provide export capability (CSV, JSON)

---

### Requirement: Security and Authentication

The system MUST implement industry-standard security practices.

#### Scenario: Secure Password Handling

- **GIVEN** a new password is created
- **WHEN** it is saved
- **THEN** the system MUST:
  - NEVER store plain text password
  - Hash using bcryptjs with salt rounds = 10
  - Compare hashed password on login using secure comparison
  - Prevent password reuse (not allowed if same as previous 3 passwords)

#### Scenario: JWT Token Management

- **GIVEN** a user logs in successfully
- **WHEN** authentication is granted
- **THEN** the system MUST:
  - Generate JWT with payload: userId, email, role, iat, exp
  - Set token expiration to 8 hours
  - Sign with secret key from environment variable
  - Return token in response (httpOnly cookie preferred)
  - Validate token signature on every protected request
  - Reject if token is expired or tampered with

#### Scenario: Session Timeout

- **GIVEN** a user has an active session
- **WHEN** no requests are made for 30 minutes
- **THEN** the system MUST:
  - Invalidate the session token
  - Force user to re-authenticate on next action
  - Show message: "Your session has expired. Please log in again"

---

### Requirement: User Notifications

The system MUST send email notifications for critical user events.

#### Scenario: Welcome Email on Account Creation

- **GIVEN** a new user account is created
- **WHEN** the user is saved to database
- **THEN** the system MUST:
  - Send welcome email with:
    - Username (email)
    - Temporary instructions (if applicable)
    - System access information
    - Link to change password (optional)
  - Log email sent in audit trail
  - Store email address as verified (if created by admin)

#### Scenario: Account Locked Notification

- **GIVEN** a user's account is locked (manual or automatic)
- **WHEN** the lock is applied
- **THEN** the system MUST:
  - Send email notification (optional)
  - Include reason (auto-lock due to failed attempts or manual)
  - Include unlock time (if auto-lock)
  - Include contact information for admin support

#### Scenario: Expiration Warning Notification

- **GIVEN** a user has 7 days until account expiration
- **WHEN** daily notification job runs
- **THEN** the system MUST:
  - Send email with expiration date
  - Include renewal process or contact admin
  - Send reminders at 7 days, 3 days, and 1 day before expiration

---

### Requirement: Monitoring and Reporting

The system MUST provide real-time monitoring and time-based reporting capabilities.

#### Scenario: Real-Time User Monitoring

- **GIVEN** an Admin views the monitoring panel
- **WHEN** the page loads and updates
- **THEN** the system MUST display:
  - List of currently active sessions (live)
  - Users online right now with IP address and device
  - Active users count (updated every 30 seconds)
  - Real-time activity feed (last 20 actions, streaming)
- **AND** refresh without requiring page reload

#### Scenario: Temporal Metrics Dashboard

- **GIVEN** an Admin views the temporal dashboard
- **WHEN** selecting a month/year
- **THEN** the system MUST display:
  - Total logins in period
  - Daily breakdown (line chart)
  - Failed login attempts in period
  - New users created in period
  - Users who expired in period
  - Lockouts in period
  - By role breakdown

#### Scenario: Activity Trends

- **GIVEN** an Admin needs to understand usage patterns
- **WHEN** viewing the analytics section
- **THEN** the system MUST display:
  - Peak usage hours (heatmap)
  - Activity by day of week
  - Logins over 30-day trend
  - Failed attempts trend (for security alerting)

---

### Requirement: Data Migration and Utilities

The system MUST provide tools for data migration and administrative utilities.

#### Scenario: Migrate User Data

- **GIVEN** a system administrator needs to import users
- **WHEN** accessing the migrate page (`/busy/admin/migracion`)
- **THEN** the system MUST:
  - Accept CSV file upload with columns: name, email, role, expiresAt
  - Validate each row before insertion
  - Skip or report errors for invalid rows
  - Show preview of users to import before committing
  - Generate temporary passwords for imported users
  - Send welcome emails to imported users
  - Log migration with count and timestamp
  - Provide import summary report

#### Scenario: Generate Report

- **GIVEN** an Admin needs a custom report
- **WHEN** selecting report type and date range
- **THEN** the system MUST:
  - Support predefined reports: Users (all), Active Users, Locked Users, Expiring Soon
  - Allow date range filtering
  - Export in CSV or JSON format
  - Include generated timestamp and admin ID in report
  - Store report for later retrieval

---

### Requirement: Performance and Reliability

The system MUST meet performance and availability requirements.

#### Scenario: Dashboard Load Performance

- **GIVEN** an Admin opens the admin dashboard
- **WHEN** the page loads
- **THEN** the system MUST:
  - Display KPI cards within 500ms
  - Display user table with pagination within 1 second
  - Charts render within 2 seconds
  - Use RTK Query caching to avoid redundant API calls

#### Scenario: Large User List Handling

- **GIVEN** the system has 10,000+ users
- **WHEN** an Admin filters or searches
- **THEN** the system MUST:
  - Execute search in < 500ms
  - Use indexed database queries (on email, userId)
  - Implement pagination to load only 20 users at a time
  - Avoid loading entire dataset into memory

#### Scenario: Concurrent Admin Operations

- **GIVEN** multiple admins are working simultaneously
- **WHEN** both edit the same user or access reports
- **THEN** the system MUST:
  - Handle concurrent requests without data corruption
  - Use optimistic locking or conflict detection if needed
  - Prevent race conditions with database transactions
  - Provide clear conflict resolution (last-write-wins or manual)

---

### Requirement: API Endpoints Specification

The system MUST provide RESTful API endpoints for admin operations.

#### Scenario: GET /api/admin/users

- **GIVEN** an authenticated admin makes a GET request
- **WHEN** the request includes query parameters (optional): `?role=Admin&status=active&page=1&limit=20&search=john`
- **THEN** the system MUST return:
  - HTTP 200 with JSON array of users
  - Each user includes: userId, name, email, role, isActive, createdAt, expiresAt, lastLoginAt
  - Pagination metadata: { total, page, limit, totalPages }
  - Results filtered by parameters

#### Scenario: POST /api/admin/users

- **GIVEN** an authenticated admin sends a POST request with user data
- **WHEN** request body contains: { name, email, role, expiresAt }
- **THEN** the system MUST:
  - Validate all required fields
  - Hash password with bcryptjs
  - Create user in database
  - Return HTTP 201 with new user object and userId
  - Return HTTP 400 if validation fails (with error details)

#### Scenario: PUT /api/admin/users/:id

- **GIVEN** an authenticated admin sends PUT request
- **WHEN** request contains updated fields
- **THEN** the system MUST:
  - Validate changes
  - Update user record
  - Return HTTP 200 with updated user
  - Log change in audit trail
  - Return HTTP 404 if user not found
  - Return HTTP 400 if validation fails

#### Scenario: DELETE /api/admin/users/:id

- **GIVEN** an authenticated admin sends DELETE request
- **WHEN** the request is to delete an existing user
- **THEN** the system MUST:
  - Perform soft delete (set isActive = false)
  - Return HTTP 204 (No Content)
  - Log deletion in audit trail
  - Return HTTP 404 if user not found

#### Scenario: POST /api/admin/users/:id/lock

- **GIVEN** an admin manually locks a user
- **WHEN** making POST request
- **THEN** the system MUST:
  - Set lockedUntil = NOW() + duration (optional, default 30 min)
  - Invalidate all active sessions
  - Return HTTP 200 with updated user
  - Log lock action with admin ID

#### Scenario: POST /api/admin/users/:id/unlock

- **GIVEN** an admin unlocks an account
- **WHEN** making POST request
- **THEN** the system MUST:
  - Set lockedUntil = null
  - Reset loginAttempts = 0
  - Return HTTP 200 with updated user
  - Log unlock action with admin ID

#### Scenario: GET /api/admin/users/:id/login-history

- **GIVEN** an admin requests login history
- **WHEN** making GET request with optional `?limit=20&offset=0`
- **THEN** the system MUST return:
  - HTTP 200 with array of login attempts (last 50 by default)
  - Each entry: timestamp, status, ipAddress, userAgent, sessionDuration
  - Sorted by timestamp descending

#### Scenario: GET /api/admin/users/expiring-soon

- **GIVEN** an admin needs to find expiring users
- **WHEN** making GET request
- **THEN** the system MUST return:
  - HTTP 200 with users expiring within 30 days
  - Include: userId, name, email, expiresAt, daysUntilExpiry
  - Sorted by expiresAt ascending

#### Scenario: POST /api/admin/users/notify-expiring

- **GIVEN** an admin wants to send expiration notifications
- **WHEN** making POST request
- **THEN** the system MUST:
  - Send emails to users expiring within specified days
  - Return HTTP 200 with count of emails sent
  - Log notification batch with timestamp

#### Scenario: GET /api/admin/users/export

- **GIVEN** an admin requests data export
- **WHEN** making GET request with `?format=csv&filters=...`
- **THEN** the system MUST:
  - Return HTTP 200 with file attachment
  - Content-Type: text/csv or application/json
  - Include all filtered users
  - Filename: `users_export_YYYY-MM-DD.csv`

#### Scenario: GET /api/admin/users/user-metrics

- **GIVEN** an admin views metrics dashboard
- **WHEN** making GET request with optional `?month=2024-01&year=2024`
- **THEN** the system MUST return:
  - HTTP 200 with metrics object:
    - totalLogins, failedLogins, newUsers, expiredUsers, lockedUsers
    - dailyBreakdown: [{ date, loginCount, failedCount }]
    - byRole: [{ role, loginCount, activeUserCount }]

---

## Error Handling

### General API Error Responses

All endpoints MUST return proper HTTP status codes and error messages:

- **400 Bad Request**: Validation errors, missing required fields
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: User lacks required role/permission
- **404 Not Found**: Resource (user) not found
- **409 Conflict**: Resource already exists or constraint violation
- **500 Internal Server Error**: Server error with error ID for debugging

Error response format:
```json
{
  "error": "error_code",
  "message": "Human readable error message",
  "details": { "field": "specific error" }
}
```

---

## Database Schema

The Administration Module uses these Prisma models:

### User Model
- userId (PK)
- email (unique)
- name
- password (hashed)
- role (enum: Admin, RegularUser, Dependiente)
- isActive (boolean)
- createdAt (timestamp)
- expiresAt (timestamp, nullable)
- lastLoginAt (timestamp, nullable)
- lockedUntil (timestamp, nullable)
- loginAttempts (integer, default 0)
- relationships: ActivityLogs, Sessions

### UserActivityLog Model
- logId (PK)
- userId (FK)
- action (enum: login, logout, create_user, update_user, delete_user, lock, unlock, password_reset, role_change)
- status (enum: success, failed)
- ipAddress
- userAgent
- details (JSON, for before/after values)
- timestamp

### UserSession Model
- sessionId (PK)
- userId (FK)
- ipAddress
- userAgent
- createdAt
- expiresAt
- lastActivityAt
- isActive (boolean)

---

## UI/UX Considerations

- Dashboard MUST be responsive and work on mobile devices
- Dark mode support required
- ARIA labels and semantic HTML for accessibility
- Loading states and skeletons for async operations
- Toast notifications for user feedback
- Animations using Framer Motion for transitions
- Search should be debounced (300ms) to reduce API calls
- Filters should persist in URL for bookmarking

---

## Testing Requirements

- Unit tests for validation logic (password strength, email format)
- Integration tests for CRUD endpoints
- API tests for all 12+ endpoints with various scenarios
- Test coverage minimum 80% for critical paths
- E2E tests for login flow and user management workflow

---

## Security Requirements

- All passwords MUST be hashed with bcryptjs (salt rounds ≥ 10)
- JWT tokens MUST have secure signature and expiration
- All API endpoints MUST require authentication (JWT token)
- Admin operations MUST require Admin role
- Audit trail MUST be immutable
- HTTPS required for all communications
- CSRF protection on state-changing operations
- Rate limiting on login endpoint (max 5 attempts per 15 minutes per IP)
- SQL injection prevention (use Prisma parameterized queries)

---

## Performance Targets

- Dashboard load: < 1.5 seconds (KPIs, table, charts)
- Search response: < 500ms for 10,000 users
- API response time: < 200ms for standard queries
- Export operation: < 5 seconds for 10,000 users
- Concurrent users: Support 50+ simultaneous admins

---

## Compliance and Audit

- GDPR compliance: Users can request data export/deletion
- SOC 2: Audit logs retained for 2+ years
- Change tracking: Before/after values logged for updates
- Admin accountability: All actions traced to specific admin ID
- Failed login tracking: Security alerting for suspicious activity
