# Contabilidad Exchange Rates Specification

## Purpose

This specification defines the behavior for accounting exchange-rate management, currency conversion, and exchange-rate traceability in the contabilidad module. The feature MUST use real exchange-rate data, apply a single deterministic conversion rule set, and preserve traceability for accounting operations.

## User Stories / Scenarios

- As an accountant, I want conversions to use the latest valid exchange rate so that accounting values reflect real data.
- As an accountant, I want to convert amounts between currencies and get the same result regardless of whether the flow is triggered from the page, server action, or legacy handler.
- As an accountant, I want exchange-rate changes to remain historized so that past conversions can be audited.
- As an accountant, I want invalid currency or rate setups to fail clearly so that incorrect accounting data is not persisted.

## Requirements

### Requirement: Deterministic Currency Conversion

The system MUST convert monetary values using a single deterministic conversion contract shared by the exchange feature.

#### Scenario: Convert the same currency

- GIVEN the source and destination currency are the same
- WHEN the user requests a conversion
- THEN the system MUST return the original amount unchanged
- AND the system MUST use a conversion rate of 1

#### Scenario: Convert with a valid exchange rate

- GIVEN both currencies are active and a valid exchange-rate path exists
- WHEN the user requests a conversion for a positive amount
- THEN the system MUST return the converted amount based on the applicable latest rate
- AND the system MUST return the rate used for the calculation

#### Scenario: Reject zero or negative amounts

- GIVEN the user enters zero or a negative amount
- WHEN the conversion is submitted
- THEN the system MUST reject the request
- AND the system MUST not persist any conversion transaction

### Requirement: Real-Data Rate Usage

The system MUST use persisted exchange-rate data as the authoritative source for accounting conversions.

#### Scenario: Use the latest rate for a currency pair

- GIVEN multiple rates exist for the same ordered currency pair
- WHEN a conversion is requested
- THEN the system MUST use the most recent effective rate
- AND the selected rate MUST be deterministic for the same input set

#### Scenario: Preserve historical conversion results

- GIVEN a conversion was completed using an older rate
- WHEN a newer rate is later created for the same pair
- THEN the previously completed conversion MUST keep the original applied rate
- AND the historical conversion MUST remain auditable

### Requirement: Exchange-Rate Path Resolution

The system MUST resolve conversions through the documented accounting rate path and fail when no valid path exists.

#### Scenario: Direct pair rate exists

- GIVEN a direct rate exists for the source and destination currency pair
- WHEN the user requests a conversion
- THEN the system MUST use that direct rate

#### Scenario: Cross-currency conversion through the principal currency

- GIVEN no direct pair rate exists but both currencies have valid rates against the principal currency
- WHEN the user requests a conversion
- THEN the system MUST compute the result through the principal currency
- AND the system MUST return the effective rate used by the calculation

#### Scenario: Missing rate path

- GIVEN no valid direct rate or principal-currency path exists
- WHEN the user requests a conversion
- THEN the system MUST fail with a clear exchange-rate-not-found error
- AND the system MUST not create a conversion record

### Requirement: Currency and Rate Validation

The system MUST validate currency and rate records before performing exchange operations.

#### Scenario: Inactive currency cannot be converted

- GIVEN the source or destination currency is inactive
- WHEN the user requests a conversion
- THEN the system MUST reject the request
- AND the system MUST not persist a conversion transaction

#### Scenario: Missing principal currency blocks cross-currency conversion

- GIVEN the system has no configured principal currency
- WHEN the user requests a conversion that requires a principal-currency path
- THEN the system MUST reject the request
- AND the system MUST report the configuration problem clearly

#### Scenario: Invalid currency reference

- GIVEN the requested currency code does not exist
- WHEN the user requests a conversion or rate lookup
- THEN the system MUST return a not-found error

### Requirement: Conversion Traceability

The system MUST record successful accounting conversions in a traceable transaction record.

#### Scenario: Persist a successful conversion

- GIVEN a conversion completes successfully
- WHEN the operation is saved
- THEN the system MUST create a TransaccionMoneda record
- AND the record MUST include the original amount, applied rate, converted amount, currency reference, and transaction reference

#### Scenario: Failed conversion is not recorded

- GIVEN a conversion fails validation or rate resolution
- WHEN the user retries or exits the flow
- THEN the system MUST not create a TransaccionMoneda record for the failed attempt

### Requirement: Rate History Integrity

The system MUST preserve exchange-rate history instead of overwriting prior effective values.

#### Scenario: Register a new exchange rate

- GIVEN a user submits a new valid exchange rate
- WHEN the rate is saved
- THEN the system MUST create a new rate entry
- AND the previous historical rate MUST remain available for audit and lookup ordering

#### Scenario: Duplicate unchanged rate submission

- GIVEN the latest stored rate for a pair matches the submitted value
- WHEN the user submits the same rate again
- THEN the system SHOULD avoid creating a redundant history entry

### Requirement: Consistent Behavior Across Entry Points

The system MUST produce equivalent conversion results when the same input is sent through the page flow, server action flow, or legacy API flow.

#### Scenario: Same input, same output across entry points

- GIVEN the same amount, source currency, destination currency, and rate data
- WHEN the conversion is executed through each supported entry point
- THEN the system MUST return the same converted amount and applied rate

## Non-Functional Requirements

- The conversion contract MUST be deterministic for identical inputs.
- The system SHOULD keep calculations numerically stable and avoid inconsistent rounding between entry points.
- The system MUST surface validation and lookup failures with actionable errors.
- The system SHOULD be testable at the service boundary without requiring UI coverage.

## Acceptance Criteria

1. Same-currency conversions return the original amount and a rate of 1.
2. Conversions use the latest valid rate for the relevant pair or principal-based path.
3. Missing rates, inactive currencies, and missing principal configuration fail cleanly.
4. Successful conversions create a traceable TransaccionMoneda record.
5. Historical rates remain intact and are not overwritten by newer submissions.
6. The page, Server Action, and legacy handler paths produce equivalent results for the same inputs.

## Invariants and Edge Cases

- Only active currencies are eligible for conversion.
- A conversion amount MUST be positive.
- The principal currency, when required for path resolution, MUST exist.
- The latest rate selection MUST be deterministic when multiple rows exist for the same pair.
- Historical rate rows MUST remain queryable after updates.
- A failed conversion MUST not persist transaction data.
- Rates and conversions MUST not silently fall back to arbitrary defaults.

## Out of Scope

- Redesigning the exchange UI.
- Tenant-scoping the exchange tables.
- Reworking unrelated accounting reports or workflows.
- Choosing or integrating a specific external rate provider in this spec.
- Backfilling or rewriting historical transactions.

## Notes for Implementation Handoff

- Keep a single source of truth for rate selection and conversion rules.
- Align the page, exchange manager, server actions, and legacy handlers to the same contract during migration.
- Add focused tests for same-currency conversion, latest-rate selection, principal-path conversion, missing-rate failure, inactive-currency failure, and transaction persistence.
- Preserve historical rate rows so audit queries can reproduce past accounting results.
