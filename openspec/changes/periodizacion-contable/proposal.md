# Proposal: Periodización Contable

## Intent

El sistema contable actual tiene **36+ puntos de escritura** de datos contables (Server Actions, API Routes legacy, workflows de servicio) y **ninguno** valida a qué período contable pertenece. El cierre contable (`calcularEstadisticasCierre`) mezcla cash basis y accrual basis sin separación, tiene un bug de multi-tenant (no filtra por `tenantId`), no bloquea períodos ya cerrados, y no incluye `CompraServicio`.

Esto significa que un usuario puede modificar reconciliaciones en un mes ya cerrado contablemente, crear cierres solapados, y que los resultados del cierre sean inconsistentes con los reportes de movimientos. **No hay inmutabilidad contable**.

## Scope

### In Scope

- **Modelo de período jerárquico**: `PeriodoContable` con niveles diario → mensual → anual, cada uno con estados: `BORRADOR | ABIERTO | EN_CIERRE | CERRADO | APROBADO | REABIERTO`. Solo `ABIERTO` y `REABIERTO` reciben escrituras.
- **Guard central de escrituras**: servicio `PeriodoGuard` que valida que cualquier escritura contable caiga en un período `ABIERTO` o `REABIERTO`. Se integra en `withAction` wrapper (Server Actions) y en middleware de API Routes legacy.
- **Apertura/cierre/reapertura**: flujo completo con validación de solapamiento, motivo obligatorio para reapertura, y registro de auditoría (`AuditoriaPeriodo`).
- **Snapshots de cierre**: inmutabilidad una vez `APROBADO`. El snapshot incluye saldos de cuenta bancaria al momento del cierre (campo nuevo `SaldoSnapshot`).
- **Integración con flujos existentes**: todos los 36+ puntos de escritura pasan por el guard. Los handlers legacy se envuelven con la misma validación para evitar bypasses.
- **UI de gestión de períodos**: panel de períodos con estados visuales, botón de apertura/cierre/reapertura, modal de motivo para reapertura, y timeline de auditoría.
- **Zona contable explícita**: configuración `tenant.contabilidadTimezone` (default `America/Argentina/Buenos_Aires`) para resolver fechas de negocio consistentemente.
- **Corrección de bug multi-tenant**: `calcularEstadisticasCierre` recibe y filtra por `tenantId` en todas las queries.

### Out of Scope

- **Saldo histórico completo de `CuentaBancaria`**: el campo `CuentaBancaria.saldo` sigue siendo valor actual. Se agrega `SaldoSnapshot` vinculado al período cerrado, pero no se implementa un ledger completo de movimientos de cuenta. Queda para otra iteración.
- **Migración de datos históricos**: los períodos existentes (`GastosDE.periodo`, `ReconciliacionGasto.periodo`, etc.) no se migran automáticamente. El schema nuevo coexiste con los campos string existentes hasta deprecación.
- **Deprecación de handlers legacy**: los API Routes legacy siguen funcionando con el guard aplicado. Su eliminación es un cambio separado.
- **Inclusión de `CompraServicio` en el cierre**: se identifica como gap pero se deja para iteración posterior (requiere análisis de impacto contable).
- **Doble entrada contable (partidas débito/crédito)**: fuera del alcance de esta fase.

## Approach

### Modelo de datos

```prisma
// Nuevo modelo central
model PeriodoContable {
  periodoId      String    @id @default(cuid())
  tenantId       String
  tipo           TipoPeriodo   // DIARIO | MENSUAL | ANUAL
  fechaInicio    DateTime
  fechaFin       DateTime
  estado         EstadoPeriodo // BORRADOR | ABIERTO | EN_CIERRE | CERRADO | APROBADO | REABIERTO
  motivoReapertura String?
  cerradoPor     String?
  cerradoAt      DateTime?
  aprobadoPor    String?
  aprobadoAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Relaciones
  tenant         Tenant    @relation(fields: [tenantId], references: [id])
  snapshots      SaldoSnapshot[]
  auditoria      AuditoriaPeriodo[]

  @@unique([tenantId, tipo, fechaInicio, fechaFin])
  @@index([tenantId, estado])
  @@index([tenantId, fechaInicio, fechaFin])
}

model SaldoSnapshot {
  snapshotId     String    @id @default(cuid())
  periodoId      String
  cuentaBancariaId String
  saldo          Float
  moneda         String
  createdAt      DateTime  @default(now())

  periodo        PeriodoContable @relation(fields: [periodoId], references: [periodoId])
}

model AuditoriaPeriodo {
  auditoriaId    String    @id @default(cuid())
  periodoId      String
  accion         String    // APERTURA | CIERRE | REAPERTURA | APROBACION
  usuario        String
  motivo         String?
  metadata       Json?
  createdAt      DateTime  @default(now())

  periodo        PeriodoContable @relation(fields: [periodoId], references: [periodoId])
}
```

### Servicio central: `PeriodoGuard`

```typescript
// src/lib/services/periodo-guard.ts
class PeriodoGuard {
  // Verifica que una fecha caiga en un período ABIERTO o REABIERTO
  static async assertWritable(tenantId: string, fecha: Date, timezone: string): Promise<void>

  // Retorna el período activo para una fecha dada
  static async getActivePeriod(tenantId: string, fecha: Date, tipo: TipoPeriodo): Promise<PeriodoContable | null>

  // Crea período (con validación de solapamiento)
  static async createPeriod(tenantId: string, tipo: TipoPeriodo, fechaInicio: Date, fechaFin: Date): Promise<PeriodoContable>

  // Cierra período (transición EN_CIERRE → CERRADO)
  static async closePeriod(periodoId: string, userId: string): Promise<void>

  // Aprueba período (transición CERRADO → APROBADO, inmutable)
  static async approvePeriod(periodoId: string, userId: string): Promise<void>

  // Reabre período (APROBADO → REABIERTO, exige motivo + auditoría)
  static async reopenPeriod(periodoId: string, motivo: string, userId: string): Promise<void>
}
```

### Integración gradual

1. **Fase 1 — Guard en Server Actions**: se inyecta `PeriodoGuard.assertWritable()` dentro del wrapper `withAction` antes de ejecutar la lógica de negocio. Cada action pasa la fecha de negocio relevante.
2. **Fase 2 — Guard en API Routes legacy**: se agrega middleware `withPeriodoGuard` que envuelve los handlers legacy con la misma validación.
3. **Fase 3 — Workflows de servicio**: las funciones `applyReconciliacionDirecta`, `applyFacturacionCobroWorkflow`, etc. reciben la fecha explícita y validan contra el guard.
4. **Fase 4 — UI**: panel de gestión de períodos con estados visuales y acciones de cierre/apertura/reapertura.

### Política contable dual

- **Caja (cash basis)**: se usa `fechaReconciliacion` para cuadre diario, tesorería, y conciliaciones reales. Refleja cuándo entró/salió el dinero.
- **Devengo (accrual basis)**: se usa `createdAt` (o fecha de negocio como `fechaCompra`, `fechaServicio`) para resultado mensual/anual y consistencia fiscal. Refleja cuándo se generó la obligación.

El cierre contable calcula **ambas vistas** y las presenta separadas. El guard valida contra ambas según el tipo de operación.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | New | Modelos `PeriodoContable`, `SaldoSnapshot`, `AuditoriaPeriodo`, enums `TipoPeriodo`, `EstadoPeriodo` |
| `src/lib/services/periodo-guard.ts` | New | Servicio central de validación de período |
| `src/lib/server-actions/wrapper.ts` | Modified | Inyección de `PeriodoGuard.assertWritable()` en `withAction` |
| `src/features/contabilidad/actions-cierres.ts` | Modified | Migración de `CierreContable` a `PeriodoContable`, corrección bug tenantId |
| `src/features/contabilidad/actions-reconciliacion.ts` | Modified | Guard en 3 acciones de reconciliación |
| `src/features/contabilidad/actions.ts` | Modified | Guard en transferencias, resumen financiero |
| `src/features/contabilidad/actions-ajustes-bancarios.ts` | Modified | Guard en ajustes bancarios |
| `src/features/contabilidad/actions-anticipos.ts` | Modified | Guard en anticipos |
| `src/features/contabilidad/actions-deudas-cash.ts` | Modified | Guard en deudas cash |
| `src/features/contabilidad/actions-prestamos-cash.ts` | Modified | Guard en préstamos cash |
| `src/features/contabilidad/api/handlers.ts` | Modified | Middleware `withPeriodoGuard` en handlers legacy |
| `src/features/contabilidad/api/handlers-reconciliacion-gastos.ts` | Modified | Guard en reconciliación de gastos legacy |
| `src/features/contabilidad/api/contabilidad/**/route.ts` | Modified | Guard en routes de contabilidad legacy |
| `src/features/contabilidad/api/produccion/ordenes/[id]/completar/route.ts` | Modified | Guard en completar orden |
| `src/features/contabilidad/services/facturacion-workflow.ts` | Modified | Guard en workflows de facturación |
| `src/features/contabilidad/services/pago-gastos-workflow.ts` | Modified | Guard en workflow de pago de gastos |
| `src/features/productos/actions.ts` | Modified | Guard en auto-reconciliación de compras |
| `src/features/venta-servicios/actions.ts` | Modified | Guard en auto-reconciliación de venta-servicio |
| `src/features/compras-servicios/actions.ts` | Modified | Guard en auto-reconciliación de compra-servicio |
| `src/features/contabilidad/components/` | New | UI de gestión de períodos (lista, detalle, acciones) |
| `src/features/contabilidad/components/CierreForm.tsx` | Modified | Corrección `creadoPor` hardcodeado |
| `src/features/contabilidad/services/cierreContableService.ts` | Modified | Corrección bug tenantId en `calcularEstadisticasCierre` |
| `src/app/models/model.ts` | Modified | Tipos para `PeriodoContable`, `EstadoPeriodo`, `TipoPeriodo` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Bypass por handler legacy no cubierto** | High | Auditoría exhaustiva de los 36+ puntos de escritura. Tests de integración que verifiquen que cada endpoint rechaza escrituras en período cerrado. |
| **Performance: query adicional por cada escritura** | Medium | Cache en memoria de períodos activos por tenant (TTL 5 min). La query es por índice compuesto (`tenantId + estado + fecha`). |
| **Migración de datos: períodos existentes sin mapear** | Medium | Los campos `periodo` string existentes coexisten con el nuevo modelo. No se migran automáticamente. Se documenta la coexistencia y se planifica deprecación. |
| **Zona horaria: fechas mal resueltas** | Medium | `PeriodoGuard` usa `tenant.contabilidadTimezone` con fallback a `America/Argentina/Buenos_Aires`. Todos los `DateTime` en Prisma son UTC; la conversión se hace en el guard. |
| **Reapertura abusiva sin control** | Low | Motivo obligatorio + registro en `AuditoriaPeriodo` + notificación al admin. Se puede agregar límite de reaperturas por período en iteración futura. |
| **Confusión cash vs accrual** | Medium | La UI del cierre muestra ambas vistas claramente etiquetadas. Documentación interna del comportamiento. |

## Rollback Plan

1. **Schema**: los nuevos modelos (`PeriodoContable`, `SaldoSnapshot`, `AuditoriaPeriodo`) son aditivos. No modifican modelos existentes. Un rollback de migration es seguro con `prisma migrate down`.
2. **Guard**: se agrega un feature flag `PERIODO_GUARD_ENABLED` (env var). Si se desactiva, el guard bypassa la validación y loguea warnings. Esto permite desactivar sin redeploy.
3. **UI**: el panel de períodos es una ruta nueva (`/contabilidad/periodos`). No modifica rutas existentes. Se puede ocultar con feature flag.
4. **Handlers legacy**: el middleware `withPeriodoGuard` es aditivo. Si falla, loguea y permite la operación (modo audit-only) hasta que se confirme estabilidad.

## Dependencies

- Corrección previa del bug de `tenantId` en `calcularEstadisticasCierre` (se incluye en esta propuesta como tarea inicial).
- `AuditoriaPeriodo` depende de `AuditLogService` existente para consistencia de auditoría.
- La zona horaria requiere que `Tenant` tenga un campo `contabilidadTimezone` (default `America/Argentina/Buenos_Aires`).

## Success Criteria

- [ ] **Cero escrituras en período cerrado**: todos los 36+ puntos de escritura rechazan operaciones con fecha en período `CERRADO` o `APROBADO`, con error claro al usuario.
- [ ] **Cero solapamientos de períodos**: no se pueden crear dos períodos del mismo tipo con fechas que se solapen para el mismo tenant.
- [ ] **Reapertura auditada**: toda reapertura registra motivo, usuario, y timestamp en `AuditoriaPeriodo`.
- [ ] **Bug tenantId corregido**: `calcularEstadisticasCierre` filtra correctamente por `tenantId` en todas las queries de agregación.
- [ ] **Cash y accrual separados**: el cierre contable presenta ambas vistas con datos consistentes.
- [ ] **Tests de integración**: cada endpoint (Server Action y API Route) tiene test que verifica rechazo en período cerrado.
- [ ] **Feature flag funcional**: `PERIODO_GUARD_ENABLED=false` desactiva el guard sin romper funcionalidad existente.
- [ ] **UI de períodos funcional**: el panel permite crear, abrir, cerrar, aprobar y reaperturar períodos con feedback visual de estados.
