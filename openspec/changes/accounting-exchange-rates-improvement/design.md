# Design: Accounting Exchange Rates Improvement

## Technical Approach

Keep `/busy/contabilidad/exchange` as a single exchange workspace, but move all rate selection and conversion decisions into one shared domain contract. The page and manager stay presentational/orchestration-only; Server Actions become the primary execution path; the legacy handler becomes a compatibility wrapper that calls the same shared service.

The design goal is not a visual reboot. It is a sharper accounting workspace that explains *why* a rate was used, *where* it came from, and *what failed* when conversion is not possible.

## Architecture Decisions

### Decision: One domain service for all conversion math

**Choice**: Introduce a single exchange domain service behind a small provider/repository boundary, and call it from `actions-exchange.ts` and `api/exchange-handlers.ts`.

**Alternatives considered**: Keep conversion rules split between actions, handlers, and the current `CurrencyConversionService`; move all logic into the client.

**Rationale**: The current split already duplicates path resolution, same-currency handling, and rate lookup behavior. Centralizing the contract makes deterministic conversion testable and prevents drift between page, action, and handler paths.

### Decision: Page shell stays, inner flow becomes a ledger-style workspace

**Choice**: Preserve the existing route, back button, and tabbed shell, but reorganize the content into three clear zones: catalog, conversion workspace, and history/provenance.

**Alternatives considered**: Replace the UI with a new wizard or a single dense form.

**Rationale**: The current route already works as a stable entry point. The problem is information architecture, not navigation. A workspace model keeps the feature learnable without expanding scope.

### Decision: Server remains the source of truth for quotes and persistence

**Choice**: The client only collects intent and renders results returned by the server; it does not calculate the final rate or fallback path.

**Alternatives considered**: Derive rates locally after fetching tables, or let the legacy handler remain the primary execution path.

**Rationale**: Determinism and traceability require one authoritative calculation path. Client-side math would reintroduce drift and make provenance harder to trust.

### Decision: Keep local component state, not global app state

**Choice**: Use local `useState`/`useEffect` in the manager and dialogs, with a narrow refresh token or invalidation callback after mutations.

**Alternatives considered**: Introduce Redux or a shared app store.

**Rationale**: This feature is scoped to one route and already follows the project’s server-action pattern. A global store would add ceremony without solving the actual boundary problem.

## Data Flow

```text
/busy/contabilidad/exchange/page.tsx
  └─ ExchangeManager
      ├─ load catalog + current rates via Server Actions
      ├─ open ConversionDialog / TasaCambioForm / HistorialTasasTable
      └─ refresh token after mutations

ConversionDialog / TasaCambioForm
  └─ submit intent to Server Action
      └─ exchange domain service
          ├─ validate currencies + principal currency
          ├─ resolve direct pair or principal-currency path
          ├─ persist conversion / rate history
          └─ return DTO with provenance + failure code

HistorialTasasTable
  └─ paginated read action
      └─ shared read service / repository
          └─ Prisma
```

State split:
- **Page**: route shell and motion wrapper only.
- **ExchangeManager**: catalog loading, selected tab state, refresh invalidation, dialog visibility.
- **Dialogs/forms**: local form state, submitting state, inline preview/result state.
- **History table**: filters, pagination, loading/error states.

## UX / Information Architecture

Keep the current top-level tabs, but tighten their meaning:

1. **Monedas** — system catalog and activation status.
2. **Tasas vigentes** — the current operational rates, with origin and effective time.
3. **Historial** — immutable audit trail and rate evolution.

Within the conversion dialog, the flow should read left-to-right as:
**Seleccionar origen/destino → validar disponibilidad → mostrar ruta y tasa aplicada → confirmar**.

Recommended panel order in the workspace:
- Header summary: principal currency, rate freshness, last update source.
- Conversion workspace: quote, path explanation, and result.
- Current rates: compact cards with provenance chips.
- History: filterable table with audit-friendly columns.

## Shared Domain / Service Boundaries

### Recommended boundaries

- `src/lib/services/currency-conversion-service.ts`
  - Owns deterministic math, same-currency pass-through, principal-currency path resolution, and rounding rules.
- `src/features/contabilidad/services/exchange-rate-provider.ts` (new)
  - Abstracts “where rates come from” so provider data can be swapped without changing conversion logic.
- `src/features/contabilidad/services/exchange-rate-read-service.ts` (new)
  - Shapes current rates/history into UI-ready DTOs.
- `src/features/contabilidad/actions-exchange.ts`
  - Orchestrates auth/feature gates, calls domain services, maps domain errors to client-safe results.
- `src/features/contabilidad/api/exchange-handlers.ts`
  - Temporary compatibility wrapper only; no unique business rules.

### Contract recommendation

The conversion result should return both value and explanation, not just a number:

```ts
type ExchangeQuote = {
  montoOriginal: number;
  montoConvertido: number;
  tasaAplicada: number;
  monedaOrigen: string;
  monedaDestino: string;
  ruta: 'same_currency' | 'direct' | 'via_principal';
  tasaId?: string;
  proveedor?: string;
  effectiveAt?: string;
};
```

## Provenance, History, and Failure States in UI

### Provenance

Show provenance as a small chip + detail line on every rate and conversion result:
- **Source**: provider/manual/legacy.
- **Route**: direct or via principal.
- **Effective at**: timestamp that explains recency.
- **By**: user/system if known.

### History

The history table should surface audit, not just values:
- effective date/time
- pair
- applied rate
- previous rate / delta
- creator
- route/source
- status badge (`Vigente`, `Reemplazada`, `Sin ruta`, `Inválida`)

### Failure states

Render failures in-context, not only as toast:
- missing principal currency
- inactive currency
- no direct/principal path
- provider unavailable
- invalid amount

Each failure should show: short reason, recovery action, and whether the failed attempt was persisted (`never` for validation/path failures).

## Accessibility and Loading / Error States

- Preserve reduced-motion behavior; do not animate critical state changes when `prefers-reduced-motion` is on.
- Keep dialogs keyboard-trappable, ESC-dismissable, and labeled with explicit descriptions.
- Use `aria-busy` and skeleton rows/cards for async fetches.
- Announce conversion success/failure in an `aria-live="polite"` region.
- Do not rely on color alone for rate status; pair color with text and icon.
- Disabled actions must explain why (e.g. missing currency, invalid amount).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/busy/contabilidad/exchange/page.tsx` | Modify | Keep route shell; simplify to a stable, polished page frame. |
| `src/features/contabilidad/components/exchange-manager.tsx` | Modify | Own workspace orchestration, data invalidation, and tab-level state. |
| `src/features/contabilidad/components/conversion-dialog.tsx` | Modify | Show quote provenance, route explanation, and failure recovery. |
| `src/features/contabilidad/components/tasa-cambio-form.tsx` | Modify | Show principal-currency context and historical overwrite warning. |
| `src/features/contabilidad/components/historial-tasas-table.tsx` | Modify | Add audit columns, provenance badges, and clearer error states. |
| `src/features/contabilidad/actions-exchange.ts` | Modify | Route reads/writes through the shared domain contract. |
| `src/features/contabilidad/api/exchange-handlers.ts` | Modify/Deprecate | Reduce to compatibility wrapper; remove divergent rules. |
| `src/lib/services/currency-conversion-service.ts` | Modify | Become the deterministic conversion kernel. |
| `src/features/contabilidad/services/exchange-rate-provider.ts` | Create | Provider abstraction for rate lookup. |
| `src/features/contabilidad/services/exchange-rate-read-service.ts` | Create | Read model shaping for current rates/history. |

## Implementation Sequencing

1. Extract and test the domain conversion contract first.
2. Move Server Actions onto that contract.
3. Make the legacy handler call the same contract.
4. Update the UI to render provenance/routing/failure metadata from the new DTOs.
5. Tighten loading, accessibility, and empty-state treatment.
6. Remove duplicate logic only after parity is proven.

## What Should Not Change in This Phase

- Do not change the `/busy/contabilidad/exchange` route or surrounding navigation.
- Do not redesign unrelated accounting pages.
- Do not tenant-scope the exchange tables.
- Do not backfill historical transactions.
- Do not replace the current server-action pattern with Redux or React Query.
- Do not delete the legacy handler until parity is verified.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | same-currency, direct path, principal path, missing-path, inactive-currency rules | Vitest on the shared domain service |
| Integration | action/handler parity and DTO shape | Vitest against actions + mocked Prisma |
| E2E | quote, history, and failure-state rendering | Playwright on `/busy/contabilidad/exchange` |

## Open Questions

- [ ] Which rate source should be treated as authoritative when provider and stored history disagree?
- [ ] Should provenance be persisted on conversion rows now, or returned in DTOs first and normalized later?
- [ ] What is the exact deprecation window for the legacy handler?
