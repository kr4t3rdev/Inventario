# Integración con Acciones y Handlers Existentes

## Purpose

Define cómo se engancha el `PeriodoGuard` en los 36+ puntos de escritura existentes (Server Actions, API Routes legacy, y workflows de servicio), asegurando cobertura total sin bypasses.

## Requirements

### Requirement: Integración en Wrapper `withAction`

El sistema DEBE inyectar `PeriodoGuard.assertWritable()` dentro del wrapper `withAction` de Server Actions, antes de ejecutar la lógica de negocio.

#### Scenario: withAction valida período antes de ejecutar

- GIVEN una Server Action envuelta con `withAction`
- WHEN la action es invocada con una fecha de negocio
- THEN `PeriodoGuard.assertWritable()` se ejecuta PRIMERO
- AND si el período es writable, la lógica de negocio se ejecuta normalmente
- AND si el período NO es writable, se retorna `{ success: false, error }` sin ejecutar la lógica

#### Scenario: withAction pasa fecha de negocio al guard

- GIVEN una Server Action de creación de gasto con campo `fechaCompra`
- WHEN la action es invocada
- THEN el guard recibe `fechaCompra` como fecha de validación (NO `createdAt`)
- AND la validación se hace contra el período que contiene `fechaCompra`

### Requirement: Integración en API Routes Legacy

El sistema DEBE agregar middleware `withPeriodoGuard` que envuelve los handlers legacy con la misma validación que el guard de Server Actions.

#### Scenario: Middleware protege handler legacy

- GIVEN un API Route legacy POST `/api/contabilidad/gastos`
- WHEN el handler recibe una request con fecha en período cerrado
- THEN el middleware `withPeriodoGuard` intercepta la request
- AND retorna HTTP 409 antes de que el handler se ejecute

#### Scenario: Middleware extrae fecha del body

- GIVEN un API Route legacy que acepta `{ fecha, monto, ... }`
- WHEN el middleware valida el período
- THEN extrae la fecha del body de la request
- AND valida contra el período correspondiente

### Requirement: Protección de Workflows de Servicio

El sistema DEBE validar el período en los workflows de servicio que ejecutan escrituras directas:

- `applyReconciliacionDirecta`
- `applyFacturacionCobroWorkflow`
- `facturacion-workflow.ts`
- `pago-gastos-workflow.ts`

#### Scenario: Workflow de reconciliación valida período

- GIVEN el workflow `applyReconciliacionDirecta`
- WHEN intenta registrar una reconciliación con fecha específica
- THEN valida contra `PeriodoGuard.assertWritable()` antes de persistir
- AND si el período está cerrado, lanza error que el caller debe manejar

#### Scenario: Workflow de facturación valida período

- GIVEN el workflow `applyFacturacionCobroWorkflow`
- WHEN intenta registrar un cobro con fecha de pago
- THEN valida contra `PeriodoGuard.assertWritable()` antes de persistir

### Requirement: Server Actions de Contabilidad

Las siguientes Server Actions DEBEN integrar el guard:

- `actions-cierres.ts` (cierres contables)
- `actions-reconciliacion.ts` (3 acciones de reconciliación)
- `actions.ts` (transferencias, resumen financiero)
- `actions-ajustes-bancarios.ts`
- `actions-anticipos.ts`
- `actions-deudas-cash.ts`
- `actions-prestamos-cash.ts`

#### Scenario: Acción de reconciliación protegida

- GIVEN `actions-reconciliacion.ts` tiene 3 acciones de reconciliación
- WHEN cada acción es invocada
- THEN el guard valida la fecha de reconciliación
- AND si el período está cerrado, la acción falla con error claro

#### Scenario: Acción de transferencia protegida

- GIVEN una Server Action de transferencia bancaria
- WHEN se ejecuta con fecha de transferencia
- THEN el guard valida contra el período de la fecha
- AND si el período está cerrado, la transferencia se rechaza

### Requirement: Server Actions de Productos y Servicios

Las siguientes Server Actions DEBEN integrar el guard para auto-reconciliación:

- `src/features/productos/actions.ts` (auto-reconciliación de compras)
- `src/features/venta-servicios/actions.ts` (auto-reconciliación de venta-servicio)
- `src/features/compras-servicios/actions.ts` (auto-reconciliación de compra-servicio)

#### Scenario: Auto-reconciliación de compra protegida

- GIVEN una compra de producto se auto-reconcilia al completarse
- WHEN la auto-reconciliación intenta registrar el movimiento contable
- THEN el guard valida la fecha de la compra
- AND si el período está cerrado, la auto-reconciliación falla
- AND la compra puede completarse pero el movimiento contable se rechaza

### Requirement: API Routes de Contabilidad Legacy

Los siguientes endpoints DEBEN integrar el guard:

- `src/features/contabilidad/api/handlers.ts`
- `src/features/contabilidad/api/handlers-reconciliacion-gastos.ts`
- `src/features/contabilidad/api/contabilidad/**/route.ts`
- `src/features/contabilidad/api/produccion/ordenes/[id]/completar/route.ts`

#### Scenario: Completar orden con período cerrado

- GIVEN el endpoint `POST /api/produccion/ordenes/[id]/completar`
- WHEN se completa una orden que genera registros contables
- THEN el middleware valida el período de la fecha de completado
- AND si el período está cerrado, la orden NO se puede completar
- AND se retorna HTTP 409 con mensaje explicativo

### Requirement: Corrección del Bug Multi-Tenant

El sistema DEBE corregir `calcularEstadisticasCierre` para que filtre por `tenantId` en todas las queries de agregación.

#### Scenario: Estadísticas de cierre filtran por tenant

- GIVEN `calcularEstadisticasCierre` se ejecuta para el tenant A
- WHEN calcula estadísticas del período
- THEN TODAS las queries incluyen `where: { tenantId: 'tenant-a' }`
- AND los resultados SOLO incluyen datos del tenant A

#### Scenario: Estadísticas de cierre NO filtran datos de otro tenant

- GIVEN existen datos contables para el tenant A y el tenant B
- WHEN `calcularEstadisticasCierre` se ejecuta para el tenant A
- THEN los resultados NO incluyen datos del tenant B
- AND el cierre es consistente con los reportes del tenant A

### Requirement: Feature Flag de Auditoría

El sistema DEBE soportar un modo `audit-only` para handlers legacy durante la fase de transición:

- Cuando `PERIODO_GUARD_MODE = 'audit-only'`: el guard loguea las violaciones pero NO bloquea
- Cuando `PERIODO_GUARD_MODE = 'enforce'` (default): el guard bloquea las violaciones

#### Scenario: Modo audit-only loguea pero permite

- GIVEN `PERIODO_GUARD_MODE = 'audit-only'`
- AND un período cerrado
- WHEN un handler legacy intenta escribir en el período cerrado
- THEN la operación SE PERMITE
- AND se loguea un ERROR indicando la violación
- AND se registra en `AuditoriaPeriodo` como `INTENTO_BYPASS`

#### Scenario: Modo enforce bloquea

- GIVEN `PERIODO_GUARD_MODE = 'enforce'`
- AND un período cerrado
- WHEN un handler legacy intenta escribir en el período cerrado
- THEN la operación SE BLOQUEA
- AND se retorna error al caller
