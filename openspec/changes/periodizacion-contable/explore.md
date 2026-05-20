# Exploración — Periodización Contable

## 1. Mapa de Flujos de Escritura

### Server Actions (patrón moderno `withAction`)

| # | Acción | Archivo | Modelo afectado | Fecha usada | Validación período |
|---|--------|---------|-----------------|-------------|-------------------|
| 1 | `createCierreAction` | `actions-cierres.ts` | `CierreContable` | `fechaInicio`, `fechaFin` (input) | NO — permite solapamiento |
| 2 | `updateCierreAction` | `actions-cierres.ts` | `CierreContable` | N/A (solo estado/obs) | N/A |
| 3 | `deleteCierreAction` | `actions-cierres.ts` | `CierreContable` | N/A | N/A |
| 4 | `reconciliarVentaAction` | `actions-reconciliacion.ts` | `ReconciliacionVenta` (+ `CuentaPorCobrar`) | `fechaReconciliacion` (default `new Date()`) | NO |
| 5 | `reconciliarServicioAction` | `actions-reconciliacion.ts` | `ReconciliacionServicio` | `fechaReconciliacion` (default `new Date()`) | NO |
| 6 | `reconciliarGastoAction` | `actions-reconciliacion.ts` | `ReconciliacionGasto` (+ `CuentaPorPagar`, `PagoCuentaPorPagar`, `CuentaBancaria`) | `fechaReconciliacion` (default `new Date()`) | NO |
| 7 | `createAjusteBancarioAction` | `actions-ajustes-bancarios.ts` | `AjusteBancario` (+ `CuentaBancaria`) | `createdAt` (auto) | NO |
| 8 | `createTransferenciaBancariaAction` | `actions.ts` | `TransferenciaBancaria` (+ `CuentaBancaria` x2) | `fechaTransferencia` (auto `now()`) | NO |
| 9 | `createAnticipoAction` | `actions-anticipos.ts` | `Anticipo` | `fechaAnticipo` (default `new Date()`) | NO |
| 10 | `executeAnticipoAction` | `actions-anticipos.ts` | `Anticipo` (estado) | N/A | NO |
| 11 | `reverseAnticipoAction` | `actions-anticipos.ts` | `Anticipo` (estado) | N/A | NO |
| 12 | `createDeudaCashAction` | `actions-deudas-cash.ts` | `DeudaCash`, `CuentaPorPagar`, `ReconciliacionVenta`, `CuentaBancaria` | `fechaReconciliacion` (auto `new Date()`) | NO |
| 13 | `registrarPagoDeudaAction` | `actions-deudas-cash.ts` | `ReconciliacionVenta`, `CuentaBancaria`, `CuentaPorPagar`, `DeudaCash` | `fechaReconciliacion` (auto `new Date()`) | NO |
| 14 | `createPrestamoCashAction` | `actions-prestamos-cash.ts` | `PrestamoCash`, `CuentaPorCobrar`, `ReconciliacionVenta`, `CuentaBancaria` | `fechaReconciliacion` (auto `new Date()`) | NO |
| 15 | `registrarPagoPrestamoAction` | `actions-prestamos-cash.ts` | `ReconciliacionVenta`, `CuentaBancaria`, `CuentaPorCobrar`, `PrestamoCash` | `fechaReconciliacion` (auto `new Date()`) | NO |

### Route Handlers (API legacy — aún activos)

| # | Handler | Archivo | Modelo afectado | Fecha usada | Validación período |
|---|---------|---------|-----------------|-------------|-------------------|
| 16 | `createTransferencia` | `handlers.ts` | `TransferenciaBancaria` (+ `CuentaBancaria`) | `fechaTransferencia` (auto) | NO |
| 17 | `createInyeccionCapital` | `handlers.ts` | `InyeccionCapital`, `CuentaBancaria` | `createdAt` (auto) | NO |
| 18 | `pagarDeudaCapital` | `handlers.ts` | `PagoDeuda`, `CuentaBancaria` | `fechaPago` (auto) | NO |
| 19 | `createAjusteBancario` | `handlers.ts` | `AjusteBancario`, `CuentaBancaria` | `createdAt` (auto) | NO |
| 20 | `createCierre` | `handlers.ts` | `CierreContable` | `fechaInicio`, `fechaFin` (input) | NO |
| 21 | `updateCierre` | `handlers.ts` | `CierreContable` | N/A | N/A |
| 22 | `deleteCierre` | `handlers.ts` | `CierreContable` | N/A | N/A |
| 23 | `handlePostReconciliacionGastos` | `handlers-reconciliacion-gastos.ts` | `ReconciliacionGasto` (+ workflow multi-cuenta) | `fechaReconciliacion` (auto) | NO |
| 24 | `POST /api/contabilidad/reconciliacion/ventas` | `route.ts` | `ReconciliacionVenta` | `fechaReconciliacion` (input o auto) | NO |
| 25 | `POST /api/contabilidad/reconciliacion/servicios` | `route.ts` | `ReconciliacionServicio` | `fechaReconciliacion` (auto) | NO |
| 26 | `POST /api/contabilidad/deudas-cash` | `route.ts` | `DeudaCash`, `CuentaPorPagar`, `ReconciliacionVenta`, `CuentaBancaria` | `fechaReconciliacion` (auto) | NO |
| 27 | `POST /api/contabilidad/deudas-cash/[id]/pagar` | `route.ts` | `ReconciliacionVenta`, `CuentaBancaria`, `CuentaPorPagar`, `DeudaCash` | `fechaReconciliacion` (auto) | NO |
| 28 | `POST /api/contabilidad/prestamos-cash` | `route.ts` | `PrestamoCash`, `CuentaPorCobrar`, `ReconciliacionVenta`, `CuentaBancaria` | `fechaReconciliacion` (auto) | NO |
| 29 | `POST /api/contabilidad/prestamos-cash/[id]/pagar` | `route.ts` | `ReconciliacionVenta`, `CuentaBancaria`, `CuentaPorCobrar`, `PrestamoCash` | `fechaReconciliacion` (auto) | NO |

### Workflows de Servicio (llamados desde actions/handlers)

| # | Función | Archivo | Modelo afectado | Fecha usada | Validación período |
|---|---------|---------|-----------------|-------------|-------------------|
| 30 | `applyReconciliacionDirecta` | `facturacion-workflow.ts` | `ReconciliacionVenta`, `CuentaBancaria` | N/A (sin fecha explícita, usa `now()`) | NO |
| 31 | `applyFacturacionCobroWorkflow` | `facturacion-workflow.ts` | `ReconciliacionVenta`, `CuentaBancaria` | N/A (sin fecha explícita) | NO |
| 32 | `applyPagoGastoWorkflow` | `pago-gastos-workflow.ts` | `ReconciliacionGasto`, `CuentaBancaria`, `CuentaPorPagar` | N/A (sin fecha explícita) | NO |
| 33 | `autoReconciliacionCompra` | `productos/actions.ts` | `ReconciliacionGasto`, `CuentaBancaria`, `CuentaPorPagar` | N/A (sin fecha explícita) | NO |
| 34 | `autoReconciliacionVentaServicio` | `venta-servicios/actions.ts` | `ReconciliacionServicio`, `CuentaBancaria` | `fechaReconciliacion` (auto `new Date()`) | NO |
| 35 | `autoReconciliacionCompraServicio` | `compras-servicios/actions.ts` | `ReconciliacionGasto`, `CuentaBancaria` | `fechaReconciliacion` (auto `new Date()`) | NO |
| 36 | `POST /api/produccion/ordenes/[id]/completar` | `route.ts` | `ReconciliacionGasto`, `CuentaBancaria` | `fechaReconciliacion` (auto `new Date()`) | NO |

### Servicio de Cierre

| # | Función | Archivo | Modelo afectado | Fecha usada | Validación período |
|---|---------|---------|-----------------|-------------|-------------------|
| 37 | `crearCierreContable` | `cierreContableService.ts` | `CierreContable` | `fechaInicio`, `fechaFin` (input) | NO — no valida solapamiento |
| 38 | `calcularEstadisticasCierre` | `cierreContableService.ts` | Múltiples (lectura) | `createdAt`, `fechaCompra`, `fechaReconciliacion` | N/A |

---

## 2. Mapa de Flujos de Lectura / Reportes

### Server Actions de lectura

| Acción | Archivo | Filtro de fecha | Modelos leídos |
|--------|---------|-----------------|----------------|
| `getCierresAction` | `actions-cierres.ts` | Ninguno (todos) | `CierreContable` |
| `getReconciliacionStatsAction` | `actions-reconciliacion.ts` | `fechaReconciliacion >= hoy` | `Venta`, `VentaServicios`, `GastosDE`, `PagoSalario`, `CompraServicio`, `ReconciliacionVenta/Servicio/Gasto` |
| `getVentasPendientesAction` | `actions-reconciliacion.ts` | `fechaVenta` (raw SQL) | `Venta` + `ReconciliacionVenta` |
| `getHistorialReconciliacionVentasAction` | `actions-reconciliacion.ts` | `fechaReconciliacion` | `ReconciliacionVenta` |
| `getServiciosPendientesAction` | `actions-reconciliacion.ts` | `createdAt` | `VentaServicios` |
| `getHistorialReconciliacionServiciosAction` | `actions-reconciliacion.ts` | `fechaReconciliacion` | `ReconciliacionServicio` |
| `getGastosPendientesAction` | `actions-reconciliacion.ts` | `createdAt` (DE), `fechaCompra` (GC), `createdAt` (PS), `fechaServicio` (CS), `createdAt` (VS) | `GastosDE`, `GastoCompra`, `PagoSalario`, `CompraServicio`, `VentaServicios` |
| `getHistorialReconciliacionGastosAction` | `actions-reconciliacion.ts` | `fechaReconciliacion` | `ReconciliacionGasto` |
| `getResumenFinancieroAction` | `actions.ts` | `fechaReconciliacion` (reconciliaciones), `fechaTransferencia` (transferencias), `createdAt` (ajustes/inyecciones), `fechaPago` (pagos deuda) | `CuentaBancaria`, `ReconciliacionVenta/Servicio/Gasto`, `TransferenciaBancaria`, `AjusteBancario`, `InyeccionCapital`, `PagoDeuda` |
| `getMovimientosReportAction` | `actions.ts` | `fechaReconciliacion` | `ReconciliacionVenta/Servicio/Gasto` |
| `getTransferenciasBancariasAction` | `actions.ts` | `createdAt` | `TransferenciaBancaria` |
| `getAjustesByCuentaAction` | `actions-ajustes-bancarios.ts` | `createdAt` | `AjusteBancario` |
| `getAnticiposAction` | `actions-anticipos.ts` | Ninguno | `Anticipo` |
| `getResumenAnticiposAction` | `actions-anticipos.ts` | `fechaReserva` | `Anticipo` |
| `getDeudasCashAction` | `actions-deudas-cash.ts` | Ninguno | `DeudaCash` |
| `getPrestamosCashAction` | `actions-prestamos-cash.ts` | Ninguno | `PrestamoCash` |
| `getPrestamoCashHistorialAction` | `actions-prestamos-cash.ts` | `fechaReconciliacion` | `ReconciliacionVenta` |
| `getCuadreDiarioAction` | `cuadre-diario/actions.ts` | `createdAt` (rango de un día) | `Venta`, `VentaServicios`, `GastosDE`, `GastoCompra`, `PagoSalario` |

### Route Handlers de lectura

| Handler | Archivo | Filtro de fecha |
|---------|---------|-----------------|
| `getMovimientosReport` | `handlers.ts` | `fechaReconciliacion`, `fechaTransferencia`, `createdAt`, `fechaPago` |
| `getExchangeImpactAnalysis` | `handlers.ts` | `fechaReconciliacion`, `createdAt`, `fechaTransferencia` |
| `getResumenFinanciero` | `handlers.ts` | `fechaReconciliacion` |
| `getExchangeReport` | `handlers.ts` | `fechaVigencia`, `fechaReconciliacion` |
| `getTransferencias` | `handlers.ts` | `fechaTransferencia` |
| `handleGetReconciliacionGastos` | `handlers-reconciliacion-gastos.ts` | `createdAt`, `periodo` |
| `handleGetReconciliacionGastosHistorial` | `handlers-reconciliacion-gastos.ts` | `fechaReconciliacion`, `periodo` |

---

## 3. Inventario de Entidades Afectadas

### Modelos Prisma con datos contables

| Modelo | Rol | Campo fecha principal | Campo período | Relación con cierre |
|--------|-----|----------------------|---------------|---------------------|
| `CierreContable` | Snapshot de período | `fechaInicio`, `fechaFin` | N/A | Entidad central |
| `ReconciliacionVenta` | Ingreso reconciliado (cash basis) | `fechaReconciliacion` | N/A | Se lee por rango en cierre |
| `ReconciliacionServicio` | Ingreso servicios (cash basis) | `fechaReconciliacion` | N/A | Se lee por rango en cierre |
| `ReconciliacionGasto` | Egreso reconciliado (cash basis) | `fechaReconciliacion` | `periodo` (string nullable) | Se lee por rango en cierre |
| `Venta` | Venta registrada (accrual basis) | `createdAt` | N/A | Se lee por `createdAt` en cierre |
| `VentaServicios` | Servicio vendido (accrual) | `createdAt` | N/A | Se lee por `createdAt` en cierre |
| `GastosDE` | Gasto operativo | `createdAt` | `periodo` (string required) | Se lee por `createdAt` en cierre |
| `GastoCompra` | Compra de producto | `fechaCompra` | `periodo` (string nullable) | Se lee por `fechaCompra` en cierre |
| `PagoSalario` | Salario empleado | `createdAt` | `periodo` (string required) | Se lee por `createdAt` en cierre |
| `CompraServicio` | Servicio recibido | `fechaServicio` | N/A | No se lee en cierre actual |
| `AjusteBancario` | Ajuste de cuenta | `createdAt` | N/A | Se lee por `createdAt` en resumen |
| `TransferenciaBancaria` | Transferencia entre cuentas | `fechaTransferencia` | N/A | Se lee por `fechaTransferencia` |
| `InyeccionCapital` | Capital/deuda externa | `createdAt` | N/A | Se lee por `createdAt` |
| `PagoDeuda` | Pago de deuda externa | `fechaPago` | N/A | Se lee por `fechaPago` |
| `Anticipo` | Anticipo cliente/proveedor | `fechaReserva`, `fechaEjecucion` | N/A | Se lee por `fechaReserva` |
| `AnticipoMovimiento` | Movimiento de anticipo | `createdAt` | N/A | No se lee en cierre |
| `DeudaCash` | Deuda con proveedor | `createdAt` | N/A | No se lee en cierre |
| `PrestamoCash` | Préstamo a cliente | `createdAt` | N/A | No se lee en cierre |
| `CuentaPorCobrar` | Cuenta por cobrar | `createdAt` | N/A | No se lee en cierre |
| `CuentaPorPagar` | Cuenta por pagar | `createdAt` | N/A | No se lee en cierre |
| `PagoCuentaPorPagar` | Pago a cuenta por pagar | `fechaPago` | N/A | No se lee en cierre |
| `Merma` | Pérdida de inventario | `createdAt` | N/A | Se lee por `createdAt` en cierre |
| `CuentaBancaria` | Saldo de cuenta | `updatedAt` | N/A | Saldo actual (no histórico por período) |
| `Factura` | Factura emitida | `fechaEmision` | N/A | No se lee en cierre |

---

## 4. Huecos de Validación

### 4.1 Sin validación de período en cierres
- **`crearCierreContable`** y **`createCierreAction`**: NO validan que el período se solape con un cierre existente. Se pueden crear dos cierres para el mismo rango.
- **No hay concepto de "cierre cerrado/bloqueado"**: el estado es `"abierto"` por default, pero no hay validación que impida escribir reconciliaciones en un período ya cerrado.

### 4.2 Sin validación de período en reconciliaciones
- **`reconciliarVentaAction`**, **`reconciliarServicioAction`**, **`reconciliarGastoAction`**: NO verifican si la `fechaReconciliacion` cae dentro de un período ya cerrado.
- Las reconciliaciones pueden crearse con cualquier fecha, incluso en meses ya cerrados contablemente.

### 4.3 Sin validación en flujos automáticos
- **`facturacion-workflow.ts`** (reconciliación directa y cobro): NO valida período.
- **`pago-gastos-workflow.ts`**: NO valida período.
- **`productos/actions.ts`** (auto-reconciliación de compras): NO valida período.
- **`venta-servicios/actions.ts`**, **`compras-servicios/actions.ts`**: NO valida período.
- **`POST /api/produccion/ordenes/[id]/completar`**: NO valida período.

### 4.4 Sin validación en handlers legacy
- Todos los route handlers de `handlers.ts`, `handlers-reconciliacion-gastos.ts`, y las routes bajo `/api/contabilidad/` y `/api/produccion/` carecen de validación de período.

### 4.5 Inconsistencia de campos de fecha
- **`GastosDE`**: tiene `periodo` como string required (formato `"YYYY-MM"`) pero el cierre usa `createdAt`.
- **`ReconciliacionGasto`**: tiene `periodo` string nullable pero se consulta por `fechaReconciliacion`.
- **`GastoCompra`**: tiene `periodo` string nullable pero se consulta por `fechaCompra`.
- **`PagoSalario`**: tiene `periodo` string required pero se consulta por `createdAt`.
- **`Venta`/`VentaServicios`**: NO tienen campo `periodo`, solo `createdAt`.

### 4.6 Campo `periodo` no se usa coherentemente
- El campo `periodo` existe en algunos modelos pero no en otros.
- Cuando existe, a veces se setea automáticamente, a veces es nullable, a veces es required.
- El servicio de cierre NO usa el campo `periodo` — usa rangos de fechas (`createdAt`, `fechaReconciliacion`, etc.).

---

## 5. Riesgos

### 5.1 Mezcla de `createdAt`, `periodo` y fechas de negocio
**CRÍTICO**: El sistema usa al menos 5 campos de fecha diferentes para filtrar datos contables:
- `createdAt` — cuando se registró en el sistema (Venta, VentaServicios, GastosDE, PagoSalario, AjusteBancario, InyeccionCapital, Anticipo, Merma)
- `fechaReconciliacion` — cuando se reconcilió el dinero (ReconciliacionVenta/Servicio/Gasto)
- `fechaCompra` — fecha de la compra (GastoCompra, CompraDocumento)
- `fechaServicio` — fecha del servicio (CompraServicio)
- `fechaTransferencia` — fecha de transferencia bancaria
- `fechaPago` — fecha de pago de deuda

**Problema**: `calcularEstadisticasCierre` mezcla cash basis (`fechaReconciliacion`) con accrual basis (`createdAt`). Esto genera inconsistencias entre lo que dice el cierre y lo que dicen los reportes de movimientos.

### 5.2 Handlers legacy duplicados
Hay **duplicación funcional** entre Server Actions y API Routes para:
- Cierres: `actions-cierres.ts` + `handlers.ts` (getCierres, createCierre, updateCierre, deleteCierre)
- Transferencias: `actions.ts` + `handlers.ts` (createTransferencia, validarTransferencia, getTransferencias)
- Ajustes bancarios: `actions-ajustes-bancarios.ts` + `handlers.ts` (createAjusteBancario, getAjustesByCuenta)
- Deudas cash: `actions-deudas-cash.ts` + `handlers-deudas-cash.ts` + routes `/api/contabilidad/deudas-cash/`
- Préstamos cash: `actions-prestamos-cash.ts` + `handlers-prestamos-cash.ts` + routes `/api/contabilidad/prestamos-cash/`
- Reconciliación de gastos: `actions-reconciliacion.ts` + `handlers-reconciliacion-gastos.ts` + routes `/api/contabilidad/reconciliacion/gastos/`
- Reconciliación de ventas: `actions-reconciliacion.ts` + `handlers-reconciliacion-ventas.ts` + routes `/api/contabilidad/reconciliacion/ventas/`
- Reconciliación de servicios: `actions-reconciliacion.ts` + `handlers-reconciliacion-servicios.ts` + routes `/api/contabilidad/reconciliacion/servicios/`

**Riesgo**: Si se agrega validación de período en las Server Actions pero no en los handlers legacy, queda un bypass.

### 5.3 No hay bloqueo de períodos cerrados
No existe ningún mecanismo que impida:
- Crear reconciliaciones con fecha en un período ya cerrado
- Modificar reconciliaciones existentes de un período cerrado
- Eliminar reconciliaciones de un período cerrado
- Crear nuevos cierres que se solapen con existentes

### 5.4 `CuentaBancaria.saldo` es un valor actual, no histórico
El saldo de la cuenta bancaria es un campo `Float` que se actualiza con cada transacción. No hay un ledger histórico que permita reconstruir el saldo a una fecha dada. Esto imposibilita la reconstrucción de estados financieros de períodos pasados si se modifican transacciones posteriores.

### 5.5 `creadoPor` hardcodeado en UI
En `CierreForm.tsx` línea 107: `creadoPor: "admin"` — el usuario se hardcodea en el frontend. Debería venir del contexto de autenticación.

### 5.6 `calcularEstadisticasCierre` no tiene scope de tenant
La función `calcularEstadisticasCierre` en `cierreContableService.ts` NO filtra por `tenantId`. Si bien `crearCierreContable` recibe `tenantId`, lo pasa al `create` pero las queries de agregación dentro de `calcularEstadisticasCierre` no tienen `tenantId` en el `where`. **Esto es un bug de multi-tenant**: las estadísticas mezclan datos de todos los tenants.

### 5.7 `CompraServicio` no se incluye en el cierre
El modelo `CompraServicio` (servicios recibidos de proveedores) NO se incluye en `calcularEstadisticasCierre`. Sin embargo, sí aparece en `getGastosPendientesAction` como tipo de gasto pendiente. Esto significa que los servicios comprados pero no pagados no se reflejan en el cierre contable.

### 5.8 Reconciliaciones con `tipoReconciliacion` especial
Las reconciliaciones de desembolsos (`DEUDA_CASH_DESEMBOLSO`, `PRESTAMO_CASH_DESEMBOLSO`) se crean automáticamente al crear la deuda/préstamo. Estas representan dinero que SALE pero se registran en `ReconciliacionVenta` (que normalmente es para ingresos). El cierre contable las excluye en `getResumenFinancieroAction` pero NO en `calcularEstadisticasCierre`.

---

## Resumen Ejecutivo

El sistema contable actual tiene **36+ puntos de escritura** de datos contables distribuidos en Server Actions, API Routes y workflows de servicio. **Ninguno** tiene validación de período. El cierre contable (`calcularEstadisticasCierre`) mezcla cash basis y accrual basis sin separación clara, tiene un **bug de multi-tenant** (no filtra por tenantId), y no incluye `CompraServicio`. Hay **duplicación de handlers** legacy que requiere que cualquier validación de período se implemente en ambos patrones para evitar bypasses. El campo `periodo` existe de forma inconsistente y no se usa en el cierre.
