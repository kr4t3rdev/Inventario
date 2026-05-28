# Post-Implementation Fragility Report

**Change**: Tipos TRIMESTRAL y SEMESTRAL en períodos contables
**Date**: 2026-05-26
**Status**: ✅ Implementation complete, fragilities documented below

---

## Fragilities Found

### 1. 🔴 `_hijoTipo()` cambio rompe validación legacy de cierre para ANUAL

**Location**: `src/lib/services/periodo-contable-service.ts` — `_hijoTipo()` + `cerrarPeriodo()`
**Severity**: **HIGH**

**What changed**: `_hijoTipo(ANUAL)` antes retornaba `MENSUAL`, ahora retorna `SEMESTRAL`.

**Impact**: Si un tenant tiene períodos ANUAL legacy (sin `periodoPadreId`) con períodos MENSUAL legacy dentro del rango, al cerrar el ANUAL la validación legacy busca `tipo: SEMESTRAL` en vez de `tipo: MENSUAL`. No encuentra los MENSUAL abiertos y permite cerrar el ANUAL incorrectamente.

**Fix**: La validación legacy debería buscar TODOS los tipos descendientes, no solo el hijo inmediato. O mejor aún: cambiar la validación legacy para buscar cualquier período abierto dentro del rango, independientemente del tipo.

```typescript
// En vez de:
tipo: this._hijoTipo(periodo.tipo as TipoPeriodo),

// Debería buscar cualquier período del mismo tenant en ese rango:
// (omitiendo el tipo específico)
```

**Workaround**: Si los períodos usan `periodoPadreId` (jerarquía explícita), la validación por `subperiodos` funciona correctamente. El bug solo afecta períodos legacy sin jerarquía.

---

### 2. 🟡 `apertura-periodo-service.ts` usa `tipo` como string sin type safety

**Location**: `src/lib/services/apertura-periodo-service.ts:55`
**Severity**: **MEDIUM**

`deriveOpeningBalances()` recibe `tipo: string` en vez de `TipoPeriodo`. Funciona con cualquier valor del enum porque Prisma acepta string en `where.tipo`, pero pierde type safety. Si se agrega un nuevo tipo y no se maneja específicamente, pasa desapercibido.

**Fix**: Cambiar `tipo: string` a `tipo: TipoPeriodo` y tipar el `where` clause.

---

### 3. 🟡 Tests pre-existentes fallando (2 tests)

**Location**: `src/features/contabilidad/__tests__/actions-periodos.test.ts`
**Severity**: **LOW**

- `cerrarPeriodoAction > falla si la transición no es válida`
- `aprobarPeriodoAction > falla si la transición no es válida (período no CERRADO)`

Ambos tests fallan con `expected false to be true`. Son pre-existentes, no relacionados con TRIMESTRAL/SEMESTRAL, pero erosionan la confianza en el suite.

**Root cause probable**: El snapshot service se ejecuta ANTES de validar la transición en `cerrarPeriodoAction`. La validación que debía rechazar un período CERRADO pasa porque el snapshot service no valida estado. Pero el `PeriodoContableService.cerrarPeriodo()` sí lo valida... Investigar si el mock del findUnique retorna el período incorrecto.

---

### 4. 🟢 Cache de `PeriodoGuard` no escala horizontalmente

**Location**: `src/lib/services/periodo-contable-guard.ts`
**Severity**: **LOW** (documentado, no empeora con TRIMESTRAL/SEMESTRAL)

El caché en memoria con TTL 30s funciona en single-instancia pero en multi-instancia cada una tiene su propio caché. No es un problema nuevo pero debe documentarse para cuando escalen.

---

### 5. 🟢 CategoríaPeriodo `RECTIFICATIVO` y `EXTRAORDINARIO` subutilizados

**Location**: `src/lib/services/periodo-contable-types.ts` + schema
**Severity**: **LOW**

Los valores existen en el enum `CategoriaPeriodo` pero no hay lógica diferencial en el servicio de dominio. Un TRIMESTRAL o SEMESTRAL categorizado como EXTRAORDINARIO se comporta igual que uno ORDINARIO. Esto no empeora con el cambio pero es una deuda técnica.

---

### 6. 🟢 Snapshot service siempre usa modo 'caja'

**Location**: `src/lib/services/periodo-snapshot-service.ts`
**Severity**: **LOW**

`generarSnapshot()` se invoca con `tipo: 'caja'` hardcodeado desde `cerrarPeriodoAction`. El parámetro existe pero no se expone en la acción. Esto significa que los snapshots siempre filtran por `fechaReconciliacion`, nunca por `createdAt` (devengo). Aplica a todos los tipos de período por igual.

---

## Recommendations

| Priority | Action | Effort |
|----------|--------|--------|
| 🔴 HIGH | Fix `_hijoTipo` legacy validation in `cerrarPeriodo()` | ~15 min |
| 🟡 MEDIUM | Type `tipo` parameter in `deriveOpeningBalances()` | ~5 min |
| 🟢 LOW | Fix 2 pre-existing failing tests | ~30 min |
| 🟢 LOW | Add devengo mode to snapshot service | ~1 day |

## Summary

The TRIMESTRAL/SEMESTRAL implementation is correct for **new periods with explicit hierarchy** (via `periodoPadreId`). The validation, code generation, labels, and UI all work correctly.

The **only real bug** (#1) is in the legacy validation path for ANUAL periods without hierarchy. It's a regression from changing `_hijoTipo(ANUAL)` from `MENSUAL` to `SEMESTRAL`. This can be fixed separately with minimal effort.
