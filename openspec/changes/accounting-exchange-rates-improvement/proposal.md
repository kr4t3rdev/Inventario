# Proposal: Accounting Exchange Rates Improvement

## Problem Statement

The accounting exchange-rate flow exists, but it is still split across Server Actions, legacy API handlers, and a shared currency service with no provider abstraction. That makes conversion behavior hard to trust, hard to test, and hard to evolve. In practice, the feature needs real exchange-rate data, consistent conversion rules, and a cleaner boundary between UI, orchestration, and domain logic.

## Goals

- Use real exchange-rate data as the source for accounting conversions.
- Make conversion logic deterministic, centralized, and testable.
- Reduce coupling between the exchange UI, Server Actions, and legacy handlers.
- Stabilize the feature architecture so future accounting changes do not duplicate logic.

## Non-goals / Out of Scope

- Tenant-scoping exchange tables or changing the global data model.
- Redesigning the exchange UI.
- Reworking unrelated accounting reports or broader accounting workflows.
- Backfilling or rewriting historical transactions unless required by a later spec.

## Proposed Approach

Move toward a layered accounting exchange architecture:

1. Keep the exchange page and manager focused on presentation and user interaction.
2. Treat Server Actions as the orchestration boundary for exchange operations.
3. Consolidate conversion rules into a single shared domain service with explicit inputs/outputs.
4. Introduce an exchange-rate provider abstraction so real market data can be sourced without binding the domain to one vendor.
5. Preserve Prisma models as the persistence source of truth, while making the domain layer the source of truth for conversion behavior.
6. Retire or narrow the legacy handler path so the feature has one primary execution path.

## Risks and Tradeoffs

| Risk | Tradeoff |
|------|----------|
| Provider abstraction adds another layer | More structure now, but less vendor lock-in and easier testing later |
| Consolidating conversion logic may expose hidden edge cases | Better correctness, but requires careful validation of existing behavior |
| Keeping exchange tables global limits isolation | Lower schema churn now, but tenant isolation remains a future concern |
| Deprecating legacy paths can break callers if done too early | Cleaner architecture, but rollout must be incremental |

## Recommended Rollout Phases

1. **Stabilize the domain boundary** — isolate conversion rules into one shared service contract.
2. **Add provider abstraction** — define the exchange-rate source interface and route new reads through it.
3. **Align Server Actions with the domain** — make the UI flow use the new contract end to end.
4. **De-risk legacy paths** — keep compatibility briefly, then remove or freeze old handlers once parity is proven.
5. **Validate behavior** — add focused tests around shared logic and conversion edge cases.

## Affected Areas / Files

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/busy/contabilidad/exchange/page.tsx` | Modified | Exchange UI entry point stays aligned with the new flow |
| `src/features/contabilidad/components/exchange-manager.tsx` | Modified | UI orchestration for exchange actions and feedback |
| `src/features/contabilidad/actions-exchange.ts` | Modified | Primary Server Action boundary for exchange workflows |
| `src/features/contabilidad/api/exchange-handlers.ts` | Modified/Deprecated | Legacy path to reduce or eliminate over time |
| `src/lib/services/currency-conversion-service.ts` | Modified | Shared conversion logic and domain rules |
| `prisma/schema.prisma` | Possibly modified | Only if the schema needs support for provider metadata or rate normalization |

## Open Questions

- Which external exchange-rate source should be considered authoritative?
- Do we need cached rates, and if so, what is the freshness policy?
- Should conversions always use persisted rates, live rates, or a hybrid model?
- What exact parity must the legacy handler maintain before removal?
- Do we need auditability for which provider rate was used in each conversion?

## Rollback Plan

If the new flow causes issues, route exchange operations back to the legacy handler path while keeping the shared conversion service intact. This limits blast radius and lets us revert orchestration without losing domain work.

## Success Criteria

- Exchange operations use a single documented conversion contract.
- Real rate data can flow through the accounting module without duplicating logic.
- Legacy and new paths produce equivalent results for the same inputs.
- Shared logic has direct tests covering conversion edge cases.
