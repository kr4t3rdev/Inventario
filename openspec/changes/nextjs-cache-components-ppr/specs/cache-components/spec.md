# Cache Components Specification

## Purpose

This specification defines how the application uses server-rendered shells, Partial Pre-Rendering (PPR), and cacheable server reads to improve perceived performance without changing business behavior.

## Requirements

### Requirement: Server shells render before deferred content

The application MUST allow selected route shells to render independently from deferred page data.

#### Scenario: Read-heavy route loads with deferred data

- GIVEN a user opens a dashboard or reporting route that has both stable shell content and slower data
- WHEN the route is requested
- THEN the shell MUST become available before the deferred data finishes
- AND the page MUST still render the final data when it arrives

#### Scenario: Mutation-heavy route stays fully dynamic

- GIVEN a user opens a form or upload route
- WHEN the route is requested
- THEN the application MUST NOT force PPR-style caching on the interactive flow

### Requirement: Stable server reads MUST be cacheable

The application MUST cache server reads only when their output is deterministic for the same inputs.

#### Scenario: Same tenant context reused across routes

- GIVEN two routes request the same tenant context with the same inputs
- WHEN the application resolves the server read
- THEN the second request SHOULD reuse the cached result

#### Scenario: Different tenant or user context

- GIVEN two requests differ in tenant or user-scoped inputs
- WHEN the application resolves the server read
- THEN the application MUST treat them as separate cache entries

### Requirement: Dynamic and transactional flows MUST remain uncached

The application MUST keep login, onboarding, create/update, upload, and real-time mutation flows outside the cache boundary.

#### Scenario: Login flow

- GIVEN a user opens the login page
- WHEN the route renders
- THEN the application MUST NOT reuse cached authenticated data for that flow

#### Scenario: Create/update form submits data

- GIVEN a user edits a record in a form
- WHEN the form is submitted
- THEN the application MUST resolve the latest server state rather than a cached snapshot

### Requirement: Deferred sections SHOULD use explicit loading fallbacks

The application SHOULD provide loading fallbacks for deferred route sections so the shell stays responsive.

#### Scenario: Dashboard widgets load after shell

- GIVEN a dashboard has a shell and multiple deferred widgets
- WHEN the shell renders first
- THEN each deferred section SHOULD show a clear loading fallback until data is ready

#### Scenario: Cached helper returns immediately

- GIVEN a cached helper resolves quickly
- WHEN a deferred section requests it
- THEN the section SHOULD render without showing a prolonged loading state
