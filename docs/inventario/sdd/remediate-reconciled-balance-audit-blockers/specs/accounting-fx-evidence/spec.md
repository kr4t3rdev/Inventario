# Accounting FX Evidence Specification

## Purpose

Define tenant currency policy, governed exchange-rate use, immutable conversion evidence, and truthful unresolved coverage.

## Requirements

### Requirement: Tenant-owned functional currency and governed rates

Each tenant MUST own its functional-currency policy. Exchange rates MAY be shared through a governed global catalog, but every catalog lookup and application MUST occur within an authenticated tenant context and MUST NOT infer functional currency from a global default.

#### Scenario: Tenant-specific functional currencies

- GIVEN tenants A and B have different functional currencies
- WHEN otherwise identical source amounts are normalized
- THEN each conversion MUST use the requesting tenant's functional currency
- AND neither tenant's policy MUST alter or disclose the other's policy

#### Scenario: Global catalog used in tenant context

- GIVEN a governed global rate is eligible for a tenant conversion
- WHEN the rate is applied
- THEN the system MUST record the tenant context and immutable applied evidence
- AND catalog mutability MUST NOT change the completed conversion

### Requirement: Complete immutable applied FX evidence

Every newly converted reconciliation MUST persist tenant, operation time, original currency and amount, functional currency, applied rate, converted amount, actual rate effective time, provenance kind and source, and an optional catalog rate identifier when one exists. Persisted applied values and provenance MUST be immutable.

#### Scenario: Complete new conversion

- GIVEN a foreign-currency reconciliation has eligible governed evidence
- WHEN the conversion succeeds
- THEN all mandatory applied-evidence fields MUST be present and internally consistent
- AND later catalog edits or deletions MUST NOT change the persisted accounting result

#### Scenario: Incomplete evidence

- GIVEN a writer cannot provide the actual effective time or another mandatory evidence field
- WHEN conversion is attempted
- THEN the system MUST represent the movement as unresolved or reject the write according to its lifecycle
- AND MUST NOT persist a normalized conversion that appears complete

### Requirement: No synthetic, current, or future evidence

A conversion MUST NOT synthesize `rateEffectiveAt` from operation, reconciliation, creation, update, capture, or current time. A selected rate MUST be effective no later than the relevant operation time for reconciliations and no later than the report cutoff for balance translation.

#### Scenario: Future rate rejected at boundary

- GIVEN a rate is effective exactly after the operation time or cutoff
- WHEN eligibility is evaluated
- THEN the rate MUST be rejected
- AND the amount MUST remain unresolved when no earlier eligible evidence exists

#### Scenario: Rate effective exactly at boundary

- GIVEN a governed rate is effective exactly at the operation time or cutoff
- WHEN eligibility is evaluated
- THEN the rate MAY be selected if all other evidence requirements are satisfied

#### Scenario: Missing timestamp is not inferred

- GIVEN a legacy reconciliation stores an applied value but no independently proven effective time
- WHEN it is read by a strict canonical consumer
- THEN the system MUST report unresolved provenance
- AND MUST NOT copy any neighboring timestamp into the missing field

### Requirement: Cutoff-safe foreign bank translation

Every foreign-currency bank balance included in a report MUST either be translated using deterministic governed evidence effective at or before the cutoff or appear in explicit unresolved balance coverage. It MUST NOT be silently omitted, valued as zero, or translated with a later fallback rate.

#### Scenario: Eligible as-of translation

- GIVEN a foreign bank balance and one or more governed rates effective no later than the cutoff
- WHEN the balance is reported
- THEN the system MUST use the deterministically eligible as-of evidence
- AND MUST expose the native amount, translated amount, applied rate, effective time, and coverage disposition to authorized consumers

#### Scenario: Partial foreign-balance coverage

- GIVEN one foreign bank balance has eligible evidence and another does not
- WHEN the report is calculated
- THEN the evidenced balance MUST be included in translated assets
- AND the other balance MUST contribute to unresolved counts and native-amount coverage without being assigned a functional-currency value
- AND the report MUST be marked partial or unresolved rather than complete

#### Scenario: Catalog changes during report generation

- GIVEN catalog governance changes while a report or snapshot is being produced
- WHEN evidence selection and publication race
- THEN each included conversion MUST correspond to one immutable selected evidence set
- AND the report MUST NOT mix an applied rate from one version with provenance from another
