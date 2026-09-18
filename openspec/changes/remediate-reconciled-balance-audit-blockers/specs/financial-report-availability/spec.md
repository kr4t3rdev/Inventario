# Financial Report Availability Specification

## Purpose

Define truthful availability and immutable snapshot behavior for current and historical financial reports.

## Requirements

### Requirement: Truthful report mode resolution

The system MUST resolve each request as exactly one of `CURRENT_LIVE`, `APPROVED_V2_SNAPSHOT`, `APPROVED_V3_SNAPSHOT`, or `UNSUPPORTED_HISTORICAL_CUTOFF`. A live request without a past cutoff MAY use current mutable state; an approved snapshot request MUST use only its stored immutable payload; and an unsupported past live cutoff MUST return a typed unavailable result.

#### Scenario: Current live request

- GIVEN a tenant requests the current live financial report without an unsupported past cutoff
- WHEN availability is resolved
- THEN the system MUST return `CURRENT_LIVE`
- AND MUST identify the actual current evaluation time without labeling it as an earlier historical instant

#### Scenario: Approved snapshot request

- GIVEN an approved v2 or v3 snapshot exists for the requested tenant and period
- WHEN the historical report is resolved
- THEN the system MUST return the matching approved snapshot mode and stored payload
- AND MUST NOT reconstruct or supplement its values from current mutable state

#### Scenario: Unsupported historical cutoff fails before mutable reads

- GIVEN a requested past cutoff has no eligible approved immutable snapshot
- WHEN availability is resolved
- THEN the system MUST return `UNSUPPORTED_HISTORICAL_CUTOFF` before any current bank, inventory, receivable, payable, or other mutable auxiliary read
- AND MUST NOT return an empty successful report or label current values with the requested cutoff

### Requirement: Distinct snapshot timestamps

A v3 snapshot MUST record `cutoffAt` as the exact semi-open accounting upper boundary, `capturedAt` as the real evidence-capture instant, and `approvedAt` as the real approval instant. These timestamps MUST remain distinct in meaning and MUST satisfy `cutoffAt <= capturedAt <= approvedAt` once approved.

#### Scenario: Capture then approval

- GIVEN cutoff-safe canonical evidence exists through `cutoffAt`
- WHEN a v3 snapshot is captured and later approved
- THEN `capturedAt` MUST record the capture instant and `approvedAt` MUST record the later approval instant
- AND neither timestamp MUST be replaced by `cutoffAt`

#### Scenario: Invalid timestamp chronology

- GIVEN a snapshot candidate has a capture before its cutoff or an approval before capture
- WHEN creation or approval is attempted
- THEN the system MUST reject it with a typed validation or conflict result
- AND MUST NOT persist an approved snapshot

### Requirement: Cutoff-safe v3 creation

Every new snapshot MUST be v3 and MUST be created solely from tenant-scoped canonical evidence that is safe for the semi-open range `[gte, cutoffAt)`. Snapshot creation MUST fail closed when any required mutable auxiliary cannot be proven at the cutoff.

#### Scenario: Later mutation cannot enter snapshot

- GIVEN source state changes after `cutoffAt` but before `capturedAt`
- WHEN the v3 snapshot is captured
- THEN the later change MUST NOT affect its financial values or coverage
- AND the snapshot MUST contain only evidence effective before `cutoffAt`

#### Scenario: Cutoff evidence unavailable

- GIVEN at least one required auxiliary has only current mutable state and no cutoff-safe evidence
- WHEN v3 snapshot creation is requested
- THEN the system MUST return a typed cutoff-evidence-unavailable result
- AND MUST NOT create, approve, or partially publish the snapshot

### Requirement: Immutable approved snapshots and warned v2 compatibility

Approved v2 and v3 snapshots MUST be immutable. Existing approved v2 payloads MUST remain byte-for-byte unchanged and viewable, and every v2 response or presentation MUST carry a neutral international Spanish legacy-evidence warning.

#### Scenario: View approved v2

- GIVEN an approved v2 snapshot exists
- WHEN it is viewed through UI, API or action, comparison, telemetry, CSV, or PDF
- THEN the stored payload MUST be returned unchanged
- AND the consumer MUST expose the v2 legacy-evidence warning without implying v3 provenance completeness

#### Scenario: Attempt to mutate approved snapshot

- GIVEN an approved v2 or v3 snapshot
- WHEN any actor or retry attempts to update, regenerate, backfill, or delete its evidence
- THEN the system MUST reject the operation with a typed conflict
- AND the approved snapshot MUST remain unchanged

#### Scenario: Rollback after v3 failure

- GIVEN v3 capture or approval is failing during rollout
- WHEN the v3 writer is disabled or application code is rolled back
- THEN existing approved v2 and v3 snapshots MUST remain viewable and immutable
- AND the system MUST stop new approvals rather than regenerate snapshots or fall back to cutoff-unsafe creation
