# Spec: Catalog CRUD Hardening for Almacenes, Unidades, Puntos de Venta, and Proveedores

> **Status**: Proposed
> **Execution mode**: Automatic planning
> **Artifact mode**: Hybrid
> **Delivery strategy**: ask-on-risk
> **TDD mode**: strict_tdd=true

## 1. Objectives

### 1.1 Primary

1. The reviewed CRUD modules MUST have a single validation source of truth between client and server.
2. The reviewed CRUD modules MUST compile without `@ts-expect-error` or unnecessary `any` escapes in the touched slices.
3. Vendors UI MUST display contract information using the actual payload shape produced by the Server Actions.
4. `puntos-venta` MUST have regression tests strong enough to protect validation, tenant isolation, and relation behavior.

### 1.2 Secondary

5. The implementation SHOULD preserve the current user flows, route paths, and success/error toast intent.
6. The implementation SHOULD prefer minimal contract changes over broad redesign.

### 1.3 Non-goals

- Introducing new CRUD fields or new domain behaviors.
- Reworking unrelated features outside these four modules.
- Changing auth strategy, tenant model, or database ownership rules.

## 2. Requirements

### R1. Shared Validation Source
All reviewed forms MUST import and use shared schemas from their feature module instead of redefining weaker local schemas.

#### Scenario: empty values rejected consistently
- **Given** a reviewed form and its paired Server Action
- **When** the user submits values that the shared feature schema rejects
- **Then** the form validation behavior MUST match the action validation contract
- **And** the client MUST NOT accept a value that the action rejects only because of a weaker local schema

### R2. No Type Suppression in Reviewed Contracts
The reviewed slices MUST not rely on `@ts-expect-error` or `as any` to bridge mismatched contracts.

#### Scenario: puntos de venta create contract compiles cleanly
- **Given** `src/features/puntos-venta/actions.ts`
- **When** the module is typechecked
- **Then** `createPuntoDeVentaAction` and `updatePuntoDeVentaAction` MUST compile without suppression comments

#### Scenario: unidad page compiles cleanly
- **Given** `src/app/busy/unidad/page.tsx`
- **When** the page consumes `getUnidadesAction`
- **Then** the result MUST be typed without `@ts-expect-error`

### R3. Vendor Contract Rendering Consistency
The vendors page MUST render the contract field that the actions actually provide.

#### Scenario: vendor with contract displays correctly
- **Given** a vendor item returned by `getVendorsAction` with `contrato = 'CTR-001'`
- **When** the vendors table renders the contract column
- **Then** the UI MUST show `CTR-001`
- **And** it MUST NOT require a `contratos[]` array to render a non-empty value

#### Scenario: vendor without contract shows fallback
- **Given** a vendor item with `contrato = null`
- **When** the vendors table renders the contract column
- **Then** the UI MUST show a stable fallback such as `Sin contrato`

### R4. Puntos de Venta Regression Coverage
`puntos-venta` actions MUST be covered by focused tests that prove expected behavior.

#### Scenario: tenant isolation on get/delete/update
- **Given** a point of sale ID that does not belong to the authenticated tenant
- **When** a get/update/delete action runs
- **Then** the action MUST return `NOT_FOUND`

#### Scenario: optional price list relation
- **Given** a valid create or update payload with `listaPrecioId`
- **When** the action runs
- **Then** the relation MUST connect when an ID is present
- **And** it MUST disconnect or persist `null` when no list is selected

#### Scenario: validation failure
- **Given** an invalid puntos de venta payload
- **When** the action runs
- **Then** it MUST return `VALIDATION_ERROR`

### R5. Verification Discipline
The implementation MUST be executed with strict TDD:

1. Write a failing test.
2. Run only the smallest relevant test command and observe the failure.
3. Implement the minimal change.
4. Re-run the focused test until it passes.
5. Refactor without broadening scope.
6. Run the suite for the touched slice.

## 3. Acceptance Criteria

- [ ] Shared schemas are used by touched forms.
- [ ] No touched file uses `@ts-expect-error` to hide contract issues.
- [ ] Vendors table contract rendering matches returned data.
- [ ] `puntos-venta` test suite is materially stronger than before.
- [ ] Focused Vitest commands and typecheck pass.
