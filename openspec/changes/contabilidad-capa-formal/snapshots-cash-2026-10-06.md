# Diseño: Snapshots funcionales cash

**Fecha:** 2026-10-06 | **Rama:** `feat/contabilidad-capa-formal`

## Motivación
Los montos funcionales de CxC (préstamos cash, commit `2d9d9b0c`) y CxP (deudas cash, commit `6c23fd6c`) cambian con cada pago. Para auditoría y conciliación histórica se necesita congelar el estado funcional (saldo pendiente en moneda funcional + evidencia FX) en un punto del tiempo, de forma periódica o al cierre de período.

## Decisiones de diseño
1. **Nueva tabla `cash_snapshots` (modelo `CashSnapshot`).** No se reutiliza `SaldoSnapshot`: ese modelo es por cuenta bancaria y exige `periodoId`; los snapshots cash son por cuenta CxC/CxP y pueden tomarse sin período contable cerrado.
2. **El snapshot NO reconvierte.** Congela `saldoFuncional = montoDeudaFuncional − montoPagadoFuncional` tal como está persistido en la cuenta, junto con la evidencia FX de la cuenta (`tasaCambio`, `rateEffectiveAt`, `fxEvidenceFingerprint`). Es reproducible y auditable.
3. **Cuentas sin `montoDeudaFuncional`** (históricos no verificables) se omiten del snapshot; el servicio reporta el conteo como `omitidos`.
4. **Idempotencia:** `idempotencyKey` único = `tenantId:tipo:cuentaId:yyyy-mm-dd(fechaCorte)`. Inserción con `createMany({ skipDuplicates: true })` — mismo patrón idem/retry de venta-servicios y restock.
5. **Corte temporal:** `fechaCorte` (Date, día) para agrupar + `capturedAt` (timestamp exacto de la fila). `periodoId` opcional (FK a PeriodoContable) cuando el snapshot acompaña un cierre; `motivo` libre (`CIERRE_DIARIO`, `AUDITORIA`, `RECONCILIACION`).
6. **Alcance:** `CuentaPorCobrar` con `tipoCuenta = 'PRESTAMO_CASH'` y `CuentaPorPagar` con `tipoDeuda = 'DEUDA_CASH'`, ambas con `tenantId` y sin `deletedAt`.
7. **Servicio:** `CashSnapshotService.capturar({ tenantId, fechaCorte?, periodoId?, motivo? })` en `src/features/contabilidad/services/cash-snapshot-service.ts`. Devuelve `{ creados, existentes, omitidos, fechaCorte }`.

## Verificación
- Migración SQL + `prisma generate`.
- Test de integración `cash-snapshots-real.test.ts` (DB desechable): préstamo USD→CUP con pago parcial + deuda cash → snapshot → verifica `saldoFuncional`; segundo snapshot misma fechaCorte es idempotente; tras otro pago, snapshot de nuevo corte refleja el nuevo saldo y el viejo queda intacto.
- `typecheck` limpio; commit local (sin push).
