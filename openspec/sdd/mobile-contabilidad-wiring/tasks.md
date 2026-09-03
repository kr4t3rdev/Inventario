# Tasks: Cableado de contabilidad en la app móvil

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 80-140 |
| 400-line budget risk | Low |
| Chained PRs recommended | No — single PR |
| Files touched | 4 (`App.tsx`, `BusinessShell.tsx`, `BusinessShell.test.tsx`, +1 test aserción) |

## Priority & Dependency Order

Lineal y único commit de fase. Orden: App.tsx (prop) → BusinessShell (conexión) → tests → verificación.

---

## Task 1: Pasar `accountingClients` y retirar clients intermedios en App.tsx

### Files
- `mobile/App.tsx`

### Changes
- [ ] Añadir `accountingClients={accountingClients}` al JSX de `<BusinessShell>`.
- [ ] Eliminar `useMemo` de `bankAccountsApi`, `accountsReceivableApi`, `accountsPayableApi`, `exchangeApi`, `advancesApi`.
- [ ] Eliminar imports de sus factories (`createCuentasBancariasApiClient`, `createCuentasXCobrarApiClient`, `createCuentasXPagarApiClient`, `createExchangeConverterApiClient`, `createAnticiposApiClient`).
- [ ] Actualizar el guard de sesión para no exigir esos 5 clients.

### Verification
- [ ] `pnpm run typecheck` sin errores.

---

## Task 2: Conectar `AccountingShell` en BusinessShell

### Files
- `mobile/src/BusinessShell.tsx`

### Changes
- [ ] Prop `accountingClients` requerida (`AccountingClients`).
- [ ] Eliminar props/imports/desestructuración de los 5 clients contables intermedios.
- [ ] Eliminar `contabilidadScreen` y su rama en `BackHandler`.
- [ ] Sustituir `renderContabilidadScreen` por renderizado directo de `AccountingShell` con los 9 adapters.
- [ ] Ajustar imports: quitar `ContabilidadSurface`, `BankAccountsSurface`, `ExchangeSurface`, `AdvancesSurface`; añadir `AccountingShell`.

### Verification
- [ ] `pnpm run typecheck` sin errores.

---

## Task 3: Actualizar y ampliar tests del shell

### Files
- `mobile/src/BusinessShell.test.tsx`

### Changes
- [ ] Eliminar los 5 props contables del `renderShell`.
- [ ] Añadir `accountingClients` tipado como `AccountingClients` (stubs por dominio).
- [ ] Añadir test: al pulsar "Contabilidad" aparecen los 6 módulos (Bancos, Reconciliaciones, Cuentas por cobrar y pagar, Préstamos y deudas, Anticipos, Configuración).

### Verification
- [ ] `pnpm test` verde (≥ 498).

---

## Task 4: Verificación integral

### Files
- ninguno (CI)

### Changes
- [ ] `cd mobile && pnpm run typecheck`.
- [ ] `cd mobile && pnpm test`.
- [ ] Confirmar 0 botones contables muertos (grep de `accountsReceivable`/`accountsPayable` sin `case` no aplica ya; `AccountingShell` cubre ambos vía CxC/CxP).

### Verification
- [ ] Suite completa verde y typecheck limpio.