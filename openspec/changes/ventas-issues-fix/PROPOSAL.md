# Change Proposal: Ventas - Issues Críticos & Multitenancy

## Intent

Resolver 5 issues críticos en el sistema de Ventas que impactan:
1. **Multitenancy**: TenantId hardcodeado a string vacío en handlers
2. **Idempotencia**: Crear keys no validadas contra duplicados
3. **Stock**: Migración incompleta de 2 estrategias simultáneas
4. **Validación**: Ubicaciones de stock sin verificación
5. **Recuperación**: Errores sin rollback explícito en transacciones

## Scope

### In Scope ✅
- `src/features/ventas/api/handlers.ts` - Fixes para todos los issues
- `src/features/ventas/schemas.ts` - Añadir validaciones
- `src/app/api/ventas/route.ts` - Refactor handlers
- Tests unitarios para cada fix
- Documentación de migración de stock

### Out of Scope ❌
- Componentes React (son upstream consumers)
- RTK Query removal (no es parte de esta tarea)
- Nuevas features de ventas

## Approach

### Phase 1: Analysis & Safety
- Audit de dónde se usa `tenantId: ''`
- Mapear impacto de stock dual strategy
- Identificar idempotency keys actuales

### Phase 2: Core Fixes (Secuencial)
1. **MultiTenant Fix**: Reemplazar `''` por `requireTenant(user)`
2. **Idempotency**: Validar key + guardar en DB para evitar duplicados
3. **Stock Unification**: Deprecar vieja estrategia, consolidar en `VentaItem`
4. **Location Validation**: Verificar StockUbicacion antes de operar
5. **Error Handling**: Añadir rollback explícito + logging

### Phase 3: Validation
- Tests pasan (>80% coverage)
- Sin breaking changes para clients existentes
- Rollback plan: Revert cambios en handlers si tests fallan

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| TenantId fix rompe queries | Usar parámetro en runtime, no migración DB |
| Stock dual strategy confunde | Deprecar vieja en logs, migrar datos en background |
| Idempotency key no adoptado | Backward compatible: si no viene key, generar UUID único |
| Usuarios activos durante fix | Deploy en ventana de mantenimiento o feature flag |

## Success Criteria

- ✅ Todos los tests pasan
- ✅ Cobertura >80%
- ✅ Sin hardcoded `''` en code
- ✅ Idempotency validateable
- ✅ Stock unificado en `VentaItem`
- ✅ Ubicaciones validadas en transacción

## Estimated Effort

- **Analysis**: 1h (spec writing)
- **Design**: 1h (architecture decisions)
- **Implementation**: 4h (code + tests)
- **Verification**: 1h (test running + QA)
- **Total**: ~7h
