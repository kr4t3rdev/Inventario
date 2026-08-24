# Canonical Financial Contracts Specification

## Purpose

Define one authoritative accounting contract for financial values, date boundaries, cash semantics, and coverage.

## Requirements

### Requirement: One canonical financial source

The canonical accounting domain MUST be the sole source of classification, normalization, sign, currency conversion, consolidation, coverage, result, balance, and gross cash-flow values. Reports, v3 snapshots, closing, API routes, server actions, comparison, telemetry, CSV, and PDF MUST consume those canonical outputs and MUST NOT recompute financial formulas.

#### Scenario: Same evidence across consumers

- GIVEN the same tenant, range, and immutable evidence
- WHEN report, snapshot, closing, API or action, comparison, telemetry, CSV, and PDF consumers present financial values
- THEN every value MUST trace to the same canonical output
- AND formatting or projection differences MUST NOT change classification, sign, conversion, range, aggregation, or totals

#### Scenario: Duplicate formula path is detected

- GIVEN a consumer can produce a financial total without a canonical output
- WHEN release conformance is evaluated
- THEN the system MUST fail the canonical-consumer gate
- AND the duplicate path MUST NOT remain available as a fallback for current reports or new writes

#### Scenario: Legacy compatibility read

- GIVEN an immutable approved legacy payload requires display
- WHEN it is read
- THEN the system MAY project its stored fields for compatibility
- AND MUST NOT run legacy formulas to regenerate, close, compare, or create new evidence

### Requirement: Semi-open accounting ranges

All accounting queries and calculators MUST use semi-open ranges `[gte, lt)`. The lower boundary MUST be included and the upper boundary MUST be excluded across source reads and every canonical consumer.

#### Scenario: Exact lower and upper boundaries

- GIVEN one eligible movement occurs exactly at `gte` and another exactly at `lt`
- WHEN any report, snapshot, closing, comparison, telemetry, or export is calculated for `[gte, lt)`
- THEN the movement at `gte` MUST be included exactly once
- AND the movement at `lt` MUST be excluded

#### Scenario: Adjacent periods

- GIVEN two adjacent ranges `[a, b)` and `[b, c)`
- WHEN both are calculated
- THEN a movement at `b` MUST appear only in the second range
- AND no movement MUST be duplicated or omitted because of end-of-day expansion

### Requirement: Correct gross cash semantics

Canonical cash flow MUST expose gross cash inflow and gross cash outflow independently from net cash flow. COGS, OPEX, and other accrual result concepts MUST NOT be labeled or used as gross cash outflow.

#### Scenario: Accrual expense without cash movement

- GIVEN COGS or OPEX is recognized without an in-range cash payment
- WHEN closing and cash flow are produced
- THEN the expense MUST affect result according to existing recognition policy
- AND MUST NOT increase gross cash outflow

#### Scenario: Gross and net cash reconcile

- GIVEN canonical cash movements exist in a range
- WHEN cash flow is calculated
- THEN gross inflow and gross outflow MUST each equal their eligible movement totals
- AND net cash flow MUST reconcile from those gross values under the canonical sign contract

### Requirement: Reconciled report coverage

The canonical report MUST expose count and amount evidence for candidate, normalized, classified, linked, included, estimated, unresolved, and excluded states across result and balance. Candidate disposition MUST reconcile as `included + unresolved + excluded`, while normalization, classification, linking, and estimation MUST remain separately identifiable stages or attributes; an estimate MUST NOT be treated as resolution of an omission.

#### Scenario: Complete coverage

- GIVEN every candidate is normalized, classified, linked when required, and included with complete evidence
- WHEN report coverage is calculated
- THEN unresolved and excluded totals MUST be zero
- AND the report MAY be marked complete only when balance and result coverage both satisfy the complete contract

#### Scenario: Estimated and unresolved candidates coexist

- GIVEN one included candidate is estimated and another candidate lacks required conversion evidence
- WHEN coverage is calculated
- THEN the estimate MUST appear in estimated and included evidence
- AND the missing-evidence candidate MUST appear in unresolved evidence
- AND the report MUST NOT combine them into one generic covered total

#### Scenario: Coverage totals do not reconcile

- GIVEN candidate counts or amounts do not reconcile with included, unresolved, and excluded dispositions
- WHEN publication or snapshot approval is attempted
- THEN the system MUST surface a canonical invariant failure
- AND MUST NOT publish a complete report or approve a v3 snapshot
