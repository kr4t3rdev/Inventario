# Financial Report Experience Specification

## Purpose

Define independent report loading, truthful comparison and coverage states, canonical exports, and accessible neutral-Spanish presentation.

## Requirements

### Requirement: Independent balance and result states

Balance and result MUST load independently and MUST each expose `loading`, `ready`, `stale`, and `error` states. A failure or refresh in one section MUST NOT conceal or block an available section, while report-level availability and coverage MUST remain coherent.

#### Scenario: Result fails while balance succeeds

- GIVEN balance data loads successfully and result loading fails
- WHEN the report is presented
- THEN balance MUST remain available with its own coverage
- AND result MUST show a user-visible error state
- AND the report MUST NOT claim complete coverage

#### Scenario: Failed refresh retains prior data

- GIVEN a section has previously loaded data
- WHEN its refresh fails while the other section refreshes successfully
- THEN the retained section MAY remain visible only when marked stale with its evidence time
- AND the successful section MUST remain ready and MUST NOT inherit the stale or error state

#### Scenario: Concurrent responses arrive out of order

- GIVEN overlapping section requests complete out of order
- WHEN state is updated
- THEN an older response MUST NOT replace newer balance or result evidence
- AND each section's status MUST correspond to the evidence currently displayed

### Requirement: Snapshot-backed previous-period comparison

Previous-period comparison MUST use an eligible approved immutable snapshot from the same tenant. If none exists, comparison MUST be explicitly unavailable and MUST NOT use live reconstruction, current state, or an estimate.

#### Scenario: Eligible approved comparison

- GIVEN an eligible approved prior-period snapshot exists for the tenant
- WHEN comparison is requested
- THEN canonical current values MUST be compared with that stored snapshot
- AND the response MUST identify the snapshot version and evidence boundary

#### Scenario: No eligible snapshot

- GIVEN no eligible approved prior-period snapshot exists
- WHEN comparison is requested
- THEN the system MUST return an explicit comparison-unavailable state
- AND MUST NOT issue mutable historical reads or show zero deltas as a substitute

#### Scenario: Prior snapshot is v2

- GIVEN the eligible comparison snapshot is approved v2
- WHEN comparison is shown or exported
- THEN the comparison MAY remain available
- AND the neutral international Spanish legacy-evidence warning MUST accompany it

### Requirement: User-visible coverage telemetry

The report MUST present whether evidence is complete, estimated, unresolved, partial, legacy, or unavailable and MUST expose authorized candidate, included, estimated, unresolved, and excluded aggregates sufficient to explain report coverage. Operational telemetry MUST use redacted tenant-safe identifiers and MUST NOT reveal sensitive source details.

#### Scenario: Partial coverage is visible

- GIVEN balance or result contains unresolved evidence
- WHEN a user views the report
- THEN the report and affected section MUST visibly indicate partial or unresolved coverage
- AND the unresolved condition MUST NOT be hidden by available totals or estimates

#### Scenario: Telemetry access across tenants

- GIVEN a tenant A actor requests coverage telemetry using tenant B identifiers
- WHEN access is evaluated
- THEN the system MUST return a non-disclosing failure
- AND MUST NOT expose tenant B aggregates, timing, source types, or existence

### Requirement: Canonical CSV and real PDF exports

CSV and PDF exports MUST use the same canonical report and availability contracts as on-screen and API consumers. A PDF MUST be a real parseable PDF with a valid PDF signature and MUST contain tenant and report identity, financial range or snapshot version, canonical values, coverage state, comparison availability, and any required v2 warning.

#### Scenario: Export canonical current report

- GIVEN an authorized current report is ready
- WHEN CSV or PDF is exported
- THEN exported financial values and coverage MUST equal the canonical report
- AND the exporter MUST NOT independently classify, convert, sign, aggregate, or replace unavailable values with zero

#### Scenario: Parse v2 PDF

- GIVEN an authorized approved v2 snapshot is exported
- WHEN the produced file is inspected and parsed
- THEN its bytes MUST begin with a valid PDF signature and a standard parser MUST extract the required identity, version, values, coverage, and legacy-warning text
- AND a download event, file extension, or content type alone MUST NOT count as success

#### Scenario: Export generation fails

- GIVEN canonical report resolution succeeds but PDF generation fails
- WHEN export is requested
- THEN the system MUST return a typed export failure without corrupt or placeholder bytes
- AND the canonical API report MUST remain authoritative and available

### Requirement: Neutral Spanish and accessible report states

Every new user-visible warning, error, status, telemetry label, comparison message, CSV label, and PDF string MUST use neutral international Spanish. Loading, stale, partial, warning, unavailable, error, comparison, telemetry, and export interactions MUST satisfy the project's Impeccable review and applicable WCAG requirements for keyboard operation, focus, semantics, contrast, and announcements.

#### Scenario: Non-happy-path announcement

- GIVEN a section changes to stale, partial, warning, unavailable, or error
- WHEN an assistive-technology user is on the report
- THEN the state and actionable next step MUST be announced in neutral international Spanish
- AND keyboard focus MUST remain visible and predictable

#### Scenario: New localized copy review

- GIVEN a new user-visible string is introduced in scope
- WHEN release evidence is reviewed
- THEN the string MUST be verified as neutral international Spanish in UI and generated documents
- AND region-specific wording or an untranslated English fallback MUST fail the copy-quality gate
