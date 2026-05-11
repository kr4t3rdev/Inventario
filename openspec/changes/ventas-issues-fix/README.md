# Ventas - Issues Críticos & Multitenancy
## SDD Change Package

**Status**: 📋 Ready for Implementation  
**Effort**: ~7.5 hours  
**Risk Level**: Medium (Backend refactor, DB schema change)  

---

## Quick Summary

Este cambio resuelve **5 issues críticos** en el sistema de Ventas que impactan arquitectura, seguridad y confiabilidad:

| # | Issue | Impact | Severity |
|---|-------|--------|----------|
| 1️⃣ | **MultiTenant**: `tenantId: ''` hardcodeado | Mezcla de datos entre tenants 🚨 | CRITICAL |
| 2️⃣ | **Idempotencia**: Sin validación de duplicados | Ventas duplicadas en reintentos | HIGH |
| 3️⃣ | **Stock**: Dual strategy (legacy + nuevo) | Cálculos confusos, mala migración | HIGH |
| 4️⃣ | **Validación**: Sin verificar ubicaciones | Errores en transacción = rollback | MEDIUM |
| 5️⃣ | **Errores**: Sin rollback explícito | Datos inconsistentes si falla TX | HIGH |

---

## What's Included

### 📄 Documentation (Listos)

- **PROPOSAL.md** - Intent, scope, risks, success criteria
- **SPEC.md** - Especificación detallada con RFC 2119 + escenarios Given/When/Then
- **DESIGN.md** - Arquitectura técnica, código de ejemplo, diagrama de flujo
- **TASKS.md** - Breakdown granular (6 fases) + checklist de implementación

### 🏗️ Ready to Implement

✅ **No código escrito aún** - Todos los detalles en docs  
✅ **DB Schema** - Listos los cambios Prisma  
✅ **Tests** - Plan de cobertura >80%  
✅ **Rollback** - Plan documentado  

---

## Implementation Path

### Phase 1: Setup (0.5h)
- Crear rama git
- Migration Prisma (idempotencyKey, AuditVenta)
- Test fixtures

### Phase 2: Core Fixes (4h) - Sequential
1. **MultiTenant Fix** (0.5h) - Extract tenantId from user
2. **Location Validation** (0.5h) - Verify PuntoDeVenta + Almacén
3. **Stock Unification** (1h) - Use only VentaItem
4. **Idempotency** (1h) - Validate + prevent duplicates
5. **Error Handling** (1h) - Rollback + logging

### Phase 3: Testing (1.5h)
- 12+ unit tests
- Integration tests
- Coverage >80%

### Phase 4-6: Database, Docs, Review (1.5h)

---

## Key Decisions

### 🔴 Why These Issues Matter

**Issue #1 (MultiTenant)** - CRITICAL
- Actualmente cualquier venta se crea con `tenantId: ''`
- Usuarios de diferentes tenants VEN LAS MISMAS VENTAS
- Fallo de seguridad grave

**Issue #2 (Idempotency)** - HIGH
- Reintentos de red causan ventas duplicadas
- Facturación doble, stock mal calculado
- No hay forma de detectar/prevenir

**Issue #3 (Stock)** - HIGH
- Código soporta 2 estrategias simultáneamente (confuso)
- Migración incompleta, imposible deprecar vieja
- Cálculos lentos (2 aggregates en lugar de 1)

**Issue #4 (Validación)** - MEDIUM
- Si ubicación es inválida, error ocurre EN transacción
- Rollback pierde la venta creada
- Debería validar ANTES

**Issue #5 (Rollback)** - HIGH
- Errores en transacción no tienen logging + contexto
- Imposible debuggear qué falló
- Prisma rollback implícito, nunca sabemos si pasó

### ✅ Solution Approach

**Orden crítico**:
1. MultiTenant (foundation)
2. Location Validation (before TX)
3. Stock Unification (refactor logic)
4. Idempotency (prevent duplicates)
5. Error Handling (wrap everything)

**Backward Compatibility**:
- Clientes sin `idempotencyKey` → generan UUID (no breaking)
- Queries legacy con `venta.productoId` → siguen funcionando
- Deprecation warnings logged, no errores

**Data Safety**:
- Migration de stock legado en background (no bloquea)
- Schema changes en Prisma (reversible)
- Todos los tests pasan antes de merge

---

## File Structure

```
openspec/changes/ventas-issues-fix/
├── PROPOSAL.md      ← Intent + scope + risks
├── SPEC.md          ← Requirements + scenarios (RFC 2119)
├── DESIGN.md        ← Architecture + code examples + diagrams
├── TASKS.md         ← Implementation breakdown + checklist
└── README.md        ← This file (quick reference)
```

---

## How to Use This Package

### 👨‍💻 Para Implementador

1. **Leer en orden**:
   - PROPOSAL.md (2 min) → entender qué se hace
   - SPEC.md (10 min) → entender requisitos exactos
   - DESIGN.md (20 min) → entender arquitectura de solución
   - TASKS.md (30 min) → plan paso a paso

2. **Ejecutar**:
   ```bash
   git checkout -b fix/ventas-multitenancy-idempotency-stock
   # Seguir fases en TASKS.md Phase 1-6
   ```

3. **Verificar**:
   - Todos los tests pasan ✓
   - Coverage >80% ✓
   - No warnings en linter ✓

4. **Desplegar**:
   - Merge a main cuando tests green
   - Monitor [VENTA_TX_ROLLBACK] errors en prod

### 👀 Para Code Reviewer

- SPEC.md → Verificar que implementación cumple todos scenarios
- DESIGN.md → Verificar arquitectura matches code
- Tests → >80% coverage + todos escenarios cubiertos
- DB → Migration limpia, reversible

### 📊 Para Product Manager

- PROPOSAL.md → Esfuerzo ~7.5h, risk level MEDIUM
- Success Criteria → Visible en PROPOSAL.md
- Risks & Mitigations → Documentados + plan de rollback

---

## Pre-Implementation Checklist

Before starting implementation:

- [ ] Lee PROPOSAL + SPEC (30 min)
- [ ] Entiende los 5 issues (ask questions si no claro)
- [ ] Verifica que branch principal está clean
- [ ] Verifica que `pnpm test` pasa actualmente
- [ ] Verifica que Prisma está actualizado
- [ ] Coordina con team si hay conflictos con otros cambios

---

## Critical Paths & Dependencies

### ⚠️ Must Do First
1. Issue #1 (MultiTenant) → foundation para otros
2. Issue #4 (Location Validation) → ANTES de Issue #3

### ✅ Can Be Parallel
- Issue #2 (Idempotency) y Issue #3 (Stock) son independientes
- Issue #5 (Error Handling) puede hacerse al final (wraps everything)

### 🚫 No Blocks
- No hay blocking issues externas
- No hay breaking changes para clientes (backward compat)

---

## Testing Strategy

### Unit Tests (12 tests, ~30 min)
```
✅ MultiTenant (2 tests)
✅ Location Validation (2 tests)
✅ Stock Unification (2 tests)
✅ Idempotency (3 tests)
✅ Error Handling (3 tests)
```

### Integration Tests (5 tests, ~15 min)
```
✅ Happy path: full venta creation
✅ MultiTenant isolation
✅ Idempotency with anticipos
✅ Stock + Pack products
✅ Error cascade with rollback
```

### Coverage Target: >80%

---

## Rollback Plan

### If Tests Fail
```bash
git reset --hard HEAD
pnpm prisma migrate resolve --rolled-back
```

### If Production Issue
- Migration is reversible
- No data loss (schema only)
- Fallback to old handlers.ts

### If MultiTenant Regression
- Revert handlers.ts tenantId changes
- Verify queries filter by tenantId
- Monitor logs for issues

---

## Success Criteria (Verification Checklist)

✅ = Completo, implementador verifica antes de PR

- [ ] `grep -r "tenantId: ''" src/features/ventas/` → 0 matches
- [ ] `pnpm test:run -- src/features/ventas/` → All pass
- [ ] Coverage report → >80%
- [ ] Manual test: Create venta as User A, verify tenantId set ✓
- [ ] Manual test: Retry with idempotencyKey, verify same ventaId ✓
- [ ] Manual test: Invalid PuntoDeVenta → 404 ✓
- [ ] Manual test: Stock calculation uses VentaItem ✓
- [ ] Code review: All 5 issues addressed ✓
- [ ] Prisma migrations: Applied successfully ✓

---

## Questions? 🤔

If something is unclear:

1. **SPEC.md** → Revisa el scenario específico que no entiendes
2. **DESIGN.md** → Revisa el código de ejemplo
3. **TASKS.md** → Revisa el paso específico
4. Ask team/reviewer - este pack está para ser usado, no para confundir

---

## Next Steps

1. ✅ Este pack está **100% listo para implementación**
2. 👉 Asignar a implementador
3. 🚀 Seguir TASKS.md Phase 1-6
4. ✔️ Code review cuando listo
5. 🎉 Merge + deploy

---

**Creado**: 2026-05-10  
**Versión**: 1.0  
**Estado**: Ready for Implementation  
