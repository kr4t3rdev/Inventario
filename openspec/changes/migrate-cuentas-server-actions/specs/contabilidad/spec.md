# Delta Specs: Contabilidad — Cuentas por Cobrar y Pagar

## ADDED Requirements

### Requirement: Server Actions para Cuentas por Cobrar

El sistema DEBE exponer Server Actions para Cuentas por Cobrar que reemplacen los handlers HTTP actuales, con autenticación automática y tenant isolation.

#### Acciones requeridas:

1. `getCuentasPorCobrarAction(filtros)` — Lista CxC con filtros server-side
2. `createCuentaPorCobrarAction(input)` — Crea una nueva CxC
3. `updateCuentaPorCobrarAction(id, input)` — Actualiza una CxC existente

#### Scenario: Listar CxC con filtros server-side

- GIVEN un usuario autenticado con tenantId "tenant-1"
- WHEN se llama `getCuentasPorCobrarAction({ estado: "PENDIENTE" })`
- THEN el sistema DEBE retornar solo las cuentas del tenant del usuario con estado PENDIENTE
- AND DEBE incluir los cálculos de `totalPagadoFactura` y `saldoFactura` normalizando multi-moneda (USD × tasaCambio)

#### Scenario: Listar CxC sin autenticación

- GIVEN un usuario no autenticado
- WHEN se llama `getCuentasPorCobrarAction()`
- THEN el sistema DEBE retornar `{ success: false, error: { message: 'Unauthorized', code: 'AUTH_REQUIRED' } }`

#### Scenario: Crear CxC con datos válidos

- GIVEN un usuario autenticado con tenantId "tenant-1"
- WHEN se llama `createCuentaPorCobrarAction({ ventaId: "v1", monto: 100, moneda: "CUP" })`
- THEN el sistema DEBE crear la CxC con el `tenantId` del usuario (NO hardcodeado)
- AND DEBE retornar la CxC creada con `estado: "PENDIENTE"`

#### Scenario: Crear CxC sin ventaId

- GIVEN un usuario autenticado
- WHEN se llama `createCuentaPorCobrarAction({ monto: 100, moneda: "CUP" })` sin `ventaId`
- THEN el sistema DEBE rechazar la request con error de validación Zod

---

### Requirement: Server Actions para Cuentas por Pagar

El sistema DEBE exponer Server Actions para Cuentas por Pagar con paginación server-side y tenant isolation.

#### Acciones requeridas:

1. `getCuentasPorPagarAction(filtros)` — Lista CxP con paginación y filtros server-side
2. `createCuentaPorPagarAction(input)` — Crea una nueva CxP
3. `pagarCuentaPorPagarAction(input)` — Registra un pago de CxP via `pago-gastos-workflow`

#### Scenario: Listar CxP con paginación server-side

- GIVEN un usuario autenticado con tenantId "tenant-1"
- WHEN se llama `getCuentasPorPagarAction({ estado: "PENDIENTE", tipo: "compra", page: 1, limit: 10 })`
- THEN el sistema DEBE retornar solo las cuentas del tenant del usuario
- AND DEBE incluir `pagination: { page, limit, total, totalPages }`
- AND DEBE incluir `rangoAntiguedad` y `diasTranscurridos` calculados server-side
- AND DEBE incluir las relaciones `proveedor` y `pagos`

#### Scenario: Listar CxP con búsqueda por factura/proveedor

- GIVEN un usuario autenticado
- WHEN se llama `getCuentasPorPagarAction({ search: "FAC-100" })`
- THEN el sistema DEBE filtrar por `numeroFactura` (contiene) y `proveedorNombre` (contiene) usando OR de Prisma

#### Scenario: Pagar CxP de tipo compra

- GIVEN un usuario autenticado y una CxP con `tipo: "compra"` y `saldoPendiente > 0`
- WHEN se llama `pagarCuentaPorPagarAction({ numeroFactura: "FAC-1", tipo: "compra", monto: 100, numeroTransaccion: "TRX-1", cuentaProveedor: "1234" })`
- THEN el sistema DEBE usar `applyPagoGastoWorkflow` con `tipoGasto: "compra"`
- AND DEBE actualizar `saldoPendiente` y `estado` en la CxP
- AND DEBE crear un `PagoCuentaPorPagar`

#### Scenario: Pagar CxP con monto que excede saldo

- GIVEN un usuario autenticado y una CxP con `saldoPendiente: 50`
- WHEN se llama `pagarCuentaPorPagarAction({ ..., monto: 100 })`
- THEN el sistema DEBE retornar `{ success: false, error: { code: 'MONTO_EXCEDE_SALDO' } }`

---

### Requirement: Paginación Server-Side en Cuentas por Pagar

El sistema DEBE implementar paginación server-side para CxP, eliminando el fetch de todos los registros.

#### Scenario: Paginación básica

- GIVEN un usuario autenticado con 25 cuentas por pagar
- WHEN se llama `getCuentasPorPagarAction({ page: 1, limit: 10 })`
- THEN el sistema DEBE retornar exactamente 10 cuentas
- AND DEBE incluir `pagination: { page: 1, limit: 10, total: 25, totalPages: 3 }`

#### Scenario: Filtros combinados

- GIVEN un usuario autenticado con cuentas de tipo "compra" y "servicio"
- WHEN se llama `getCuentasPorPagarAction({ tipo: "compra", estado: "PENDIENTE", page: 1, limit: 10 })`
- THEN el sistema DEBE retornar solo cuentas de tipo "compra" con estado "PENDIENTE"
- AND DEBE incluir la paginación correcta filtrada

---

### Requirement: Schemas Zod para Validación

El sistema DEBE tener schemas Zod para validar inputs de todas las Server Actions.

#### Schemas requeridos:

1. `getCuentasPorCobrarSchema` — `{ estado?: string, clienteId?: string, page?: number, limit?: number }`
2. `getCuentasPorPagarSchema` — `{ estado?: string, tipo?: string, search?: string, page?: number, limit?: number }`
3. `createCuentaPorCobrarSchema` — `{ ventaId?: string, monto: z.number().positive(), moneda: z.string() }`
4. `createCuentaPorPagarSchema` — `{ numeroFactura: string, tipo: enum, proveedorId: string, montoDeuda: number, moneda?: string }`
5. `pagarCuentaPorPagarSchema` — `{ numeroFactura: string, tipo: enum, monto: number().positive(), numeroTransaccion: string, cuentaProveedor: string, observaciones?: string }`
6. `updateCuentaPorCobrarSchema` — `{ id: string, estado?: enum, montoDeuda?: number }`

#### Scenario: Input inválido rechazado

- GIVEN cualquier Server Action con schema Zod
- WHEN se pasa un input que no cumple el schema
- THEN el sistema DEBE retornar `{ success: false, error: { code: 'VALIDATION_ERROR', details: { fieldErrors } } }`

---

### Requirement: Migración de Pages a Server Components

Las pages de CxC y CxP DEBEN usar Server Actions en lugar de RTK Query hooks.

#### Scenario: Page de CxC carga datos vía Server Action

- GIVEN la page `/busy/contabilidad/cuentas-por-cobrar`
- WHEN se renderiza
- THEN DEBE llamar `getCuentasPorCobrarAction()` en el servidor
- AND pasar los datos como props al componente `CuentasPorCobrarTable`
- AND el componente `CuentasPorCobrarTable` NO DEBE importar de `cuentasPorCobrarApi`

#### Scenario: Page de CxP carga datos vía Server Action

- GIVEN la page `/busy/contabilidad/cuentas-por-pagar`
- WHEN se renderiza
- THEN DEBE llamar `getCuentasPorPagarAction()` en el servidor
- AND pasar los datos como props al Client Component
- AND el componente NO DEBE importar de `cuentasPorPagarApi`

---

### Requirement: Eliminación de Componente Muerto

El componente `PagarCuentaPorPagarDialog` DEBE ser eliminado ya que la page de CxP usa `ReconciliacionGastosForm` directamente.

#### Scenario: Eliminar imports y archivo

- GIVEN el archivo `src/features/contabilidad/components/pagar-cuenta-por-pagar-dialog.tsx`
- WHEN se elimina
- THEN no DEBE existir ninguna importación a este archivo desde otros componentes
- AND el flux de pago de CxP DEBE funcionar únicamente via `ReconciliacionGastosForm`

---

### Requirement: Tenant Isolation en Server Actions

Todas las Server Actions de CxC y CxP DEBEN usar `requireTenant(user)` para filtrar datos por tenant.

#### Scenario: Query sin tenant isolation (bug actual)

- GIVEN el handler actual `getCuentasPorPagarHandler` que NO filtra por `tenantId`
- WHEN se migra a Server Action con `requireTenant(user)`
- THEN la query DEBE incluir `where: { tenantId }` en todas las operaciones Prisma

#### Scenario: Create sin tenantId hardcodeado (bug actual)

- GIVEN el handler actual `createCuentaPorCobrarHandler` que usa `tenantId: ''`
- WHEN se migra a Server Action con `requireTenant(user)`
- THEN el `tenantId` DEBE venir del `user.tenantId`, NO hardcodeado

---

## MODIFIED Requirements

### Requirement: CxC Table Component Data Source

**Antes**: `CuentasPorCobrarTable` obtiene datos vía `useGetCuentasPorCobrarQuery` (RTK Query)

**Después**: `CuentasPorCobrarTable` recibe datos como props del Server Component padre, con opciones de re-fetch vía Server Actions

#### Scenario: CxC Table recibe data por props

- GIVEN la page de CxC como Server Component
- WHEN renderiza `CuentasPorCobrarTable`
- THEN la table DEBE recibir `{ cuentas, isLoading, error }` como props
- AND NO DEBE usar `useGetCuentasPorCobrarQuery` internamente

### Requirement: CxP Page Data Fetching

**Antes**: `CuentasPorPagarPage` usa `useGetCuentasPorPagarQuery` (RTK Query) con filtros client-side

**Después**: La page DEBE usar `getCuentasPorPagarAction` y los filtros/paginación se manejan server-side

#### Scenario: Filtros y paginación server-side en CxP

- GIVEN un usuario que cambia el filtro de estado a "PENDIENTE"
- WHEN el Client Component solicita datos con nuevo filtro
- THEN DEBE usar `useActionState` o `startTransition` para llamar la Server Action
- AND la Server Action DEBE retornar solo las cuentas filtradas y paginadas