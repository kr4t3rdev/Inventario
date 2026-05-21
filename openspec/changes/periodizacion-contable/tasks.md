# Tasks: Periodización Contable

## Overview

Implementación de un sistema de períodos contables jerárquicos (diario → mensual → anual) con guard central de escritura, snapshots inmutables y auditoría completa.

**Total de tasks**: 8
**Orden**: secuencial por dependencias (T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8)
**Estimación total**: ~2100 líneas (código + tests)

---

## T1: Schema + Tipos + Dominio Puro

**Dependencias**: Ninguna

**Archivos**:
| Archivo | Acción | Líneas aprox |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modify | +80 |
| `src/lib/services/periodo-contable-types.ts` | Create | ~120 |
| `src/lib/services/periodo-contable-service.ts` | Create | ~350 |
| `src/lib/services/__tests__/periodo-contable-service.test.ts` | Create | ~400 |

**Criterios de aceptación**:
- [ ] Enums `TipoPeriodo`, `EstadoPeriodo`, `EventoAuditoria` definidos en Prisma y TypeScript
- [ ] Modelos `PeriodoContable`, `SaldoSnapshot`, `AuditoriaPeriodo` en schema con índices y relaciones
- [ ] Campo `contabilidadTimezone` agregado a `Tenant` con default `America/Argentina/Buenos_Aires`
- [ ] `PeriodoContableService.verificarSolapamiento()` detecta solapamientos correctamente (mismo día, adyacente, parcial, distinto tenant/tipo)
- [ ] `PeriodoContableService.validarTransicion()` acepta solo transiciones válidas según la matriz definida
- [ ] `PeriodoContableService.abrirPeriodo()` crea período con validación de solapamiento
- [ ] `PeriodoContableService.resolverPeriodoActivo()` resuelve por jerarquía (DIARIO → MENSUAL → ANUAL)
- [ ] Migración Prisma ejecutada exitosamente (`pnpm prisma migrate dev`)
- [ ] Tests: todas las transiciones válidas e inválidas cubiertas, solapamiento con edge cases, resolución jerárquica

**Riesgos**:
- Conflicto con schema existente si hay modelos con nombres similares → verificar que los nombres son únicos
- La migración puede fallar si `Tenant` tiene datos sin valores default → el campo tiene default, debería ser seguro

**Estimación**: ~950 líneas, 4 archivos

---

## T2: Guard Central de Escrituras

**Dependencias**: T1 (schema + tipos + servicio de dominio)

**Archivos**:
| Archivo | Acción | Líneas aprox |
|---------|--------|-------------|
| `src/lib/services/periodo-contable-guard.ts` | Create | ~250 |
| `src/lib/services/__tests__/periodo-contable-guard.test.ts` | Create | ~300 |

**Criterios de aceptación**:
- [ ] `PeriodoGuard.assertWritable()` lanza `ActionError` con código correcto según estado del período
- [ ] `PeriodoGuard.checkWritable()` retorna resultado sin lanzar (para modo audit-only)
- [ ] `PeriodoGuard.getConfig()` lee `PERIODO_GUARD_ENABLED` y `PERIODO_GUARD_MODE` correctamente
- [ ] Modo `enforce`: bloquea escrituras en períodos CERRADO/APROBADO/EN_CIERRE
- [ ] Modo `audit-only`: permite escrituras pero loguea violaciones y registra `INTENTO_BYPASS`
- [ ] Modo disabled (`PERIODO_GUARD_ENABLED=false`): bypassa completamente con warning
- [ ] Caché en memoria con Map: hit, miss, expired, invalidateCache
- [ ] Conversión de fecha a timezone del tenant (fallback `America/Argentina/Buenos_Aires`)
- [ ] `extraerFechaNegocio()` extrae fecha de campos conocidos: `fecha`, `fechaCompra`, `fechaServicio`, `fechaReconciliacion`, `fechaTransferencia`, `fechaPago`
- [ ] Tests: feature flag en los 3 modos, caché hit/miss/expired, timezone conversion, extracción de fecha

**Riesgos**:
- El caché Map en memoria no se comparte entre instancias serverless → aceptable por TTL de 5 min (documentado en design)
- La extracción de fecha por convención puede fallar si el input tiene estructura inesperada → `extraerFechaNegocio` retorna null en ese caso, el guard no se aplica

**Estimación**: ~550 líneas, 2 archivos

---

## T3: Snapshot + Auditoría

**Dependencias**: T1 (schema + tipos + servicio de dominio)

**Archivos**:
| Archivo | Acción | Líneas aprox |
|---------|--------|-------------|
| `src/lib/services/periodo-snapshot-service.ts` | Create | ~180 |
| `src/lib/services/periodo-audit-service.ts` | Create | ~120 |
| `src/lib/services/__tests__/periodo-snapshot-service.test.ts` | Create | ~200 |
| `src/lib/services/__tests__/periodo-audit-service.test.ts` | Create | ~150 |

**Criterios de aceptación**:
- [ ] `SnapshotService.generarSnapshot()` itera todas las `CuentaBancaria` del tenant y crea `SaldoSnapshot` por cada una
- [ ] Snapshots capturan saldo, moneda y metadata en el momento exacto
- [ ] Cuentas con saldo 0 también generan snapshot (no se omiten)
- [ ] Múltiples monedas (ARS, USD) capturadas correctamente
- [ ] `SnapshotService.verificarIntegridad()` detecta inconsistencias
- [ ] `PeriodoAuditService.registrar()` crea entrada de auditoría con evento, actor, motivo, payload
- [ ] `PeriodoAuditService.obtenerHistorial()` retorna timeline ordenado cronológicamente
- [ ] Toda transición de estado genera registro de auditoría (integrado en T1/T4)
- [ ] Tests: múltiples cuentas, múltiples monedas, saldo 0, integridad, registro de auditoría, timeline

**Riesgos**:
- Si no hay cuentas bancarias, el snapshot se genera vacío → comportamiento correcto, pero debe testearse
- La generación de snapshot es costosa → separada del cierre para permitir reintentos (design decision)

**Estimación**: ~650 líneas, 4 archivos

---

## T4: Server Actions de Períodos

**Dependencias**: T1 (servicio de dominio), T3 (snapshot + auditoría)

**Archivos**:
| Archivo | Acción | Líneas aprox |
|---------|--------|-------------|
| `src/features/contabilidad/actions-periodos.ts` | Create | ~200 |
| `src/features/contabilidad/__tests__/actions-periodos.test.ts` | Create | ~250 |

**Criterios de aceptación**:
- [ ] `getPeriodosAction`: lista períodos con filtros por tipo/estado, paginación
- [ ] `getPeriodoDetailAction`: detalle con snapshots y auditoría incluida
- [ ] `abrirPeriodoAction`: abre período (BORRADOR → ABIERTO), revalida path
- [ ] `cerrarPeriodoAction`: cierra período (ABIERTO → EN_CIERRE → CERRADO), genera snapshot, revalida path
- [ ] `aprobarPeriodoAction`: aprueba período (CERRADO → APROBADO), revalida path
- [ ] `reabrirPeriodoAction`: reapertura con motivo obligatorio (APROBADO → REABIERTO), revalida path
- [ ] Verificación de ownership por tenantId en todas las mutations
- [ ] Validación Zod en todos los inputs
- [ ] Tests: CRUD completo, apertura, cierre con snapshot, reapertura con motivo, ownership tenant

**Riesgos**:
- El cierre puede fallar si el SnapshotService tiene error → debe propagar error correctamente al caller
- La reapertura sin motivo debe ser rechazada por Zod antes de llegar al servicio

**Estimación**: ~450 líneas, 2 archivos

---

## T5: Integración en withAction Wrapper

**Dependencias**: T2 (guard central)

**Archivos**:
| Archivo | Acción | Líneas aprox |
|---------|--------|-------------|
| `src/lib/server-actions/with-action.ts` | Modify | +40 |
| `src/lib/server-actions/__tests__/with-action-periodo.test.ts` | Create | ~150 |

**Criterios de aceptación**:
- [ ] `withAction` inyecta `PeriodoGuard.assertWritable()` antes de ejecutar la lógica de negocio
- [ ] La fecha se extrae automáticamente del input via `extraerFechaNegocio()`
- [ ] Si no hay fecha en el input, el guard no se aplica (solo actions con fecha)
- [ ] Si el guard rechaza, retorna `{ success: false, error: { code, message } }` sin ejecutar la action
- [ ] El guard se aplica solo si hay `tenantId` del usuario autenticado
- [ ] Tests: action con fecha en período abierto (pasa), período cerrado (rechaza), sin fecha (no aplica guard)

**Riesgos**:
- Si `extraerFechaNegocio` no encuentra la fecha correcta, el guard no se aplica → mitigar con auditoría de los 36+ puntos
- El orden de ejecución es crítico: auth → guard → business logic → response

**Estimación**: ~190 líneas, 2 archivos

---

## T6: Integración en Flujos Contables Existentes

**Dependencias**: T5 (guard en withAction)

**Archivos**:
| Archivo | Acción | Líneas aprox |
|---------|--------|-------------|
| `src/lib/services/cierreContableService.ts` | Modify | ~30 |
| `src/features/contabilidad/actions-cierres.ts` | Modify | ~20 |
| `src/features/contabilidad/actions-reconciliacion.ts` | Modify | ~30 |
| `src/features/contabilidad/actions.ts` | Modify | ~20 |
| `src/features/contabilidad/actions-ajustes-bancarios.ts` | Modify | ~15 |
| `src/features/contabilidad/actions-anticipos.ts` | Modify | ~15 |
| `src/features/contabilidad/actions-deudas-cash.ts` | Modify | ~15 |
| `src/features/contabilidad/actions-prestamos-cash.ts` | Modify | ~15 |
| `src/features/productos/actions.ts` | Modify | ~15 |
| `src/features/venta-servicios/actions.ts` | Modify | ~15 |
| `src/features/compras-servicios/actions.ts` | Modify | ~15 |
| `src/features/contabilidad/__tests__/integracion-guard.test.ts` | Create | ~200 |

**Criterios de aceptación**:
- [ ] `calcularEstadisticasCierre` recibe parámetro `tenantId` y filtra TODAS las queries por tenant
- [ ] Test de multi-tenant: datos de tenant B NO aparecen en estadísticas de tenant A
- [ ] Cada action contable pasa por el guard (ya sea via withAction modificado o llamada explícita)
- [ ] Workflows de servicio (`applyReconciliacionDirecta`, `applyFacturacionCobroWorkflow`) validan período
- [ ] Auto-reconciliaciones en productos/venta-servicios/compras-servicios validan período
- [ ] Tests de integración: invocar cada action con fecha en período cerrado → rechaza con `PERIODO_CERRADO`
- [ ] Tests de integración: invocar cada action con fecha en período abierto → pasa normalmente

**Riesgos**:
- **ALTO**: algún handler legacy podría no estar cubierto → el modo `audit-only` ayuda a detectar bypasses
- Las auto-reconciliaciones pueden fallar si el período está cerrado → la compra se completa pero el movimiento contable se rechaza (comportamiento esperado)
- Modificar muchos archivos aumenta riesgo de regresión → tests de integración son críticos

**Estimación**: ~400 líneas, 12 archivos

---

## T7: UI de Gestión de Períodos

**Dependencias**: T4 (server actions de períodos)

**Archivos**:
| Archivo | Acción | Líneas aprox |
|---------|--------|-------------|
| `src/app/busy/contabilidad/periodos/page.tsx` | Create | ~120 |
| `src/features/contabilidad/components/periodos/periodo-list.tsx` | Create | ~180 |
| `src/features/contabilidad/components/periodos/periodo-detail.tsx` | Create | ~150 |
| `src/features/contabilidad/components/periodos/periodo-badge.tsx` | Create | ~80 |
| `src/features/contabilidad/components/periodos/reapertura-modal.tsx` | Create | ~100 |
| `src/features/contabilidad/components/periodo-activo-indicator.tsx` | Create | ~60 |
| `src/features/contabilidad/__tests__/periodos-ui.test.tsx` | Create | ~200 |

**Criterios de aceptación**:
- [ ] Ruta `/busy/contabilidad/periodos` muestra lista de períodos con tipo, rango, estado y acciones
- [ ] Badges de estado con colores: BORRADOR (gris), ABIERTO (verde), EN_CIERRE (naranja), CERRADO (rojo), APROBADO (rojo oscuro + candado), REABIERTO (azul + advertencia)
- [ ] Filtros por tipo (DIARIO/MENSUAL/ANUAL) y estado
- [ ] Acciones por estado: Abrir (BORRADOR), Cerrar (ABIERTO), Aprobar (CERRADO), Reabrir (APROBADO)
- [ ] Modal de reapertura con campo de motivo obligatorio, botón confirmar deshabilitado si vacío
- [ ] Timeline de auditoría en detalle del período (evento, usuario, timestamp, motivo)
- [ ] Toast de éxito/error en cada acción
- [ ] Indicador de período activo en header
- [ ] Tests: render de lista, filtros, acciones por estado, modal de reapertura, validación de motivo

**Riesgos**:
- Los componentes pueden crecer más de 200 líneas → separar sub-componentes si es necesario
- El timeline puede ser lento con muchos registros → paginar o lazy-load si hay más de 50 entries

**Estimación**: ~890 líneas, 7 archivos

---

## T8: Integración API Routes Legacy + Middleware

**Dependencias**: T2 (guard central), T6 (integración en flujos)

**Archivos**:
| Archivo | Acción | Líneas aprox |
|---------|--------|-------------|
| `src/features/contabilidad/api/handlers.ts` | Modify | ~25 |
| `src/features/contabilidad/api/handlers-reconciliacion-gastos.ts` | Modify | ~20 |
| `src/features/contabilidad/api/middleware/with-periodo-guard.ts` | Create | ~80 |
| `src/features/contabilidad/__tests__/api-guard.test.ts` | Create | ~150 |

**Criterios de aceptación**:
- [ ] Middleware `withPeriodoGuard` extrae fecha del body/query y valida contra el guard
- [ ] Retorna HTTP 409 con `{ error: { code, message } }` si período no es writable
- [ ] Modo `audit-only`: loguea violaciones pero permite la operación
- [ ] Handlers legacy envueltos con el middleware
- [ ] Endpoint `POST /api/produccion/ordenes/[id]/completar` protegido
- [ ] Tests: API route con fecha en período cerrado → 409, período abierto → 200, audit-only → 200 + log

**Riesgos**:
- Los API routes legacy pueden tener estructuras de request variadas → el middleware debe ser flexible en extracción de fecha
- El middleware debe ejecutarse ANTES del handler, no después

**Estimación**: ~275 líneas, 4 archivos

---

## Review Workload Forecast

### Estimación de líneas totales

| Task | Líneas código | Líneas tests | Total |
|------|--------------|-------------|-------|
| T1: Schema + Dominio | ~550 | ~400 | ~950 |
| T2: Guard Central | ~250 | ~300 | ~550 |
| T3: Snapshot + Auditoría | ~300 | ~350 | ~650 |
| T4: Server Actions | ~200 | ~250 | ~450 |
| T5: Integración withAction | ~40 | ~150 | ~190 |
| T6: Integración Flujos | ~200 | ~200 | ~400 |
| T7: UI de Períodos | ~690 | ~200 | ~890 |
| T8: API Routes Legacy | ~125 | ~150 | ~275 |
| **TOTAL** | **~2355** | **~2000** | **~4355** |

### PRs Encadenados (400-line budget check)

**SÍ se recomienda PRs encadenados.** El total de ~4355 líneas excede ampliamente el budget de 400 líneas por PR. Se sugiere la siguiente división:

| PR | Tasks incluidas | Líneas aprox | Focus |
|----|----------------|-------------|-------|
| PR-1 | T1 | ~950 | Schema + dominio puro (base de todo) |
| PR-2 | T2 + T3 | ~1200 | Guard + Snapshot + Auditoría (protección) |
| PR-3 | T4 + T5 | ~640 | Server Actions + withAction integration |
| PR-4 | T6 + T8 | ~675 | Integración en flujos existentes + API legacy |
| PR-5 | T7 | ~890 | UI de gestión de períodos |

**Nota**: PR-1 y PR-2 son los más grandes. Si se necesita reducir aún más:
- PR-1 se puede split en: schema migration (~80 lines) + service + tests (~870 lines)
- PR-2 se puede split en: guard (~550 lines) + snapshot/audit (~650 lines)

### size:exception

**SÍ necesita `size:exception`** para PR-1 (T1: ~950 líneas) y PR-2 (T2+T3: ~1200 líneas). Estos son inevitables porque:
- T1 incluye schema Prisma + tipos + servicio de dominio completo + tests — no se puede splitar sin romper dependencias
- T2+T3 son servicios estrechamente acoplados (el guard usa el servicio de dominio, el snapshot se invoca en el cierre)

### Decisión necesaria antes de apply

1. **Auto-creación de períodos**: ¿Se crea automáticamente un período mensual `ABIERTO` para el mes actual de todos los tenants existentes al activar el guard? Esto evita bloquear operaciones legítimas el día del deploy. **Recomendación**: SÍ, crear período automático en el deploy script.

2. **Período activo por defecto**: Al activar `PERIODO_GUARD_MODE=enforce` en producción, ¿qué pasa con tenants que no tienen ningún período? **Recomendación**: Rechazar con `PERIODO_NO_EXISTE` y mensaje claro para crear período primero.

3. **Notificaciones de reapertura**: ¿Se usa el sistema de `Notification` existente o email? **Recomendación**: `Notification` existente para consistencia, iteración futura para email.

4. **Feature flag inicial**: ¿Deployar primero con `PERIODO_GUARD_MODE=audit-only` en producción? **Recomendación**: SÍ, al menos 48 horas en audit-only antes de pasar a enforce.
