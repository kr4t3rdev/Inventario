# Mobile API contract (v1)

Este documento define el primer contrato **mobile-first** del backend para clientes iOS, Android, Flutter o React Native. La idea NO es reescribir el backend todavía: es exponer un contrato HTTP estable sobre la lógica ya compartida en servicios.

## Quick path

1. Autenticá con `POST /api/mobile/v1/auth/login`.
2. Guardá `accessToken` y `refreshToken` en storage seguro del dispositivo.
3. Consumí endpoints mobile con `Authorization: Bearer <accessToken>`.
4. Si el access token expira, llamá `POST /api/mobile/v1/auth/refresh` con el `refreshToken`.
5. Si el usuario cambia de tenant, llamá `POST /api/mobile/v1/auth/tenants` para recibir un nuevo contexto de tokens.

## Current scope

| Area | Status | Notes |
|------|--------|-------|
| Auth login | Ready | JSON tokens, sin cookies obligatorias. |
| Auth refresh | Ready | Refresh token por body JSON. |
| Auth me | Ready | Bearer token. |
| Auth logout | Ready | Invalida sesión actual. |
| Tenant list/switch | Ready | Devuelve contexto actualizado. |
| Dashboard stats | Ready | Primer dominio no-auth validado para mobile. |
| Products read | Ready | Lista y detalle por tenant bajo mobile v1. |
| Products stock by location | Ready | Refleja la capacidad ya existente de stock por ubicación. |
| Sales read | Ready | Lista y detalle por tenant bajo mobile v1. |
| Sales mutations | Ready | Create/update/cancel con servicio compartido y validación explícita. |
| Accounting config read | Ready | Tipos de pago y cuentas disponibles para mobile. |
| Bank accounts read | Ready | Lista, detalle e historial reutilizando servicios compartidos. |
| Accounting operations read | Ready | Transferencias, ajustes bancarios e inyecciones de capital en modo lectura. |
| Accounting operations mutations | Ready | Crear transferencias, validarlas, registrar ajustes e inyecciones/pagos de capital. |
| Reconciliation sales/services | Ready | Pendientes, historial y registro de reconciliaciones para ventas y servicios. |
| Reconciliation expenses | Ready | Pendientes, historial y registro de reconciliaciones de gastos usando el adapter canónico. |
| Accounts receivable read | Ready | Lista y métricas CxC con servicio compartido reutilizable. |
| Accounts payable read | Ready | Lista y métricas CxP alineadas con la lógica web existente. |
| Cash loans read | Ready | Lista, detalle, historial y stats de préstamos cash bajo contrato mobile-first. |
| Cash debts read | Ready | Lista, detalle y stats de deudas cash bajo contrato mobile-first. |
| Cash loans mutations | Ready | Crear, editar y registrar pagos de préstamos cash con la lógica contable real. |
| Cash debts mutations | Ready | Crear, editar y registrar pagos de deudas cash con la lógica contable real. |
| Audit logs read | Ready | Logs de auditoría contable para admin, usando la misma fuente de verdad web/mobile. |
| Otros módulos | Pending | Migrar por slices usando servicios compartidos. |

## Base conventions

| Topic | Decision |
|-------|----------|
| Base path | `/api/mobile/v1` |
| Auth mechanism | Bearer token en `Authorization` |
| Response shape | `successResponse` / `errorResponse` desde `src/lib/api-response.ts` |
| Tenant context | `x-tenant-id` cuando el cliente necesita forzar tenant |
| Web compatibility | Web sigue usando cookies + Server Actions donde aplique |
| Business logic | Debe vivir en servicios reutilizables, no en adapters web/mobile |

## Endpoints

### `POST /api/mobile/v1/auth/login`

**Body**

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

**Success 200**

```json
{
  "user": {
    "userId": "...",
    "email": "user@example.com",
    "tenantId": "tenant-1"
  },
  "accessToken": {
    "token": "jwt",
    "expiresInSeconds": 86400
  },
  "refreshToken": {
    "token": "jwt",
    "expiresInSeconds": 2592000
  }
}
```

### `POST /api/mobile/v1/auth/refresh`

**Body**

```json
{
  "refreshToken": "jwt"
}
```

Devuelve un nuevo par `accessToken` + `refreshToken`.

### `GET /api/mobile/v1/auth/me`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el usuario autenticado y su contexto vigente.

### `POST /api/mobile/v1/auth/logout`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Invalida la sesión actual y responde éxito lógico para el cliente mobile.

### `GET /api/mobile/v1/auth/tenants`

Lista tenants disponibles para el usuario autenticado.

### `POST /api/mobile/v1/auth/tenants`

**Body**

```json
{
  "tenantId": "tenant-2"
}
```

Devuelve el tenant activo, rol tenant y un nuevo par de tokens ya asociado al tenant elegido.

### `GET /api/mobile/v1/dashboard/stats`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `ubicacionId`
- `tipoUbicacion` (`almacen` | `puntoDeVenta`)

Este endpoint valida el patrón objetivo: **servicio compartido + adapter mobile + adapter web**.

### `GET /api/mobile/v1/products`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve la lista base de productos del tenant autenticado en orden descendente de creación, alineada con la lectura general ya implementada en web.

### `GET /api/mobile/v1/products/stock`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params requeridos/opcionales**

- `ubicacionId`
- `tipoUbicacion` (`almacen` | `punto_venta`)
- `includeZero` (`true` | `false`, opcional)

Devuelve productos con contexto de stock para una ubicación específica, siguiendo la misma capacidad existente de stock por ubicación del proyecto.

### `GET /api/mobile/v1/products/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el detalle de un producto del tenant autenticado. Si el producto no existe dentro de ese tenant, responde `404 NOT_FOUND`.

### `GET /api/mobile/v1/sales`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve ventas del tenant autenticado, ordenadas por fecha descendente, alineadas con la lectura general ya implementada en web.

### `GET /api/mobile/v1/sales/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el detalle de una venta del tenant autenticado. Si la venta no existe dentro de ese tenant, responde `404 NOT_FOUND`.

### `POST /api/mobile/v1/sales/create`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

Usa el mismo payload lógico que hoy consume la creación web de ventas. La validación y la lógica de stock/facturación viven en `VentaMutationService`.

Errores esperables de negocio:

- `VALIDATION_ERROR` → `400`
- `INSUFFICIENT_STOCK` → `400`
- `TENANT_REQUIRED` → `403`

### `PUT /api/mobile/v1/sales/:id/update`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

Usa el mismo payload lógico que hoy consume la edición web de ventas, con `ventaId` resuelto desde la URL.

Errores esperables de negocio:

- `VALIDATION_ERROR` → `400`
- `NOT_FOUND` → `404`
- `TENANT_REQUIRED` → `403`

### `POST /api/mobile/v1/sales/:id/cancel`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

```json
{
  "motivo": "Cliente devolvió la mercadería"
}
```

Errores esperables de negocio:

- `VALIDATION_ERROR` → `400`
- `NOT_FOUND` → `404`
- `TENANT_REQUIRED` → `403`

### `GET /api/mobile/v1/accounting/payment-types`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve los tipos de pago configurados para el tenant autenticado.

### `GET /api/mobile/v1/accounting/payment-types/available-accounts`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve las cuentas bancarias utilizables por mobile para operaciones asociadas a tipos de pago.

### `GET /api/mobile/v1/accounting/payment-types/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el detalle tenant-scoped del tipo de pago y la información de su cuenta por defecto.

### `PUT /api/mobile/v1/accounting/payment-types/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Actualiza un tipo de pago reutilizando las validaciones, autorización de manager y auditoría existentes.

### `DELETE /api/mobile/v1/accounting/payment-types/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Elimina un tipo de pago respetando las restricciones contables existentes.

### `GET /api/mobile/v1/accounting/bank-accounts`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Lista las cuentas bancarias del tenant autenticado.

### `GET /api/mobile/v1/accounting/bank-accounts/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el detalle de una cuenta bancaria del tenant autenticado.

### `GET /api/mobile/v1/accounting/bank-accounts/:id/history`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el historial de movimientos de la cuenta bancaria, alineado con la lectura ya existente en web.

### `GET /api/mobile/v1/accounting/bank-transfers`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `fechaInicio`
- `fechaFin`
- `cuentaId`

Devuelve transferencias bancarias según la misma lógica de lectura hoy usada por web.

### `POST /api/mobile/v1/accounting/bank-transfers`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

```json
{
  "cuentaOrigenId": "cb-1",
  "cuentaDestinoId": "cb-2",
  "montoOrigen": 100,
  "motivo": "Reposición",
  "descripcion": "Opcional",
  "tasaCambio": 24
}
```

Ejecuta la transferencia reutilizando la misma lógica de negocio que hoy usa web.

### `POST /api/mobile/v1/accounting/bank-transfers/validate`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Permite validar saldo y advertencias antes de ejecutar la transferencia, alineado con el flujo actual del formulario web.

### `GET /api/mobile/v1/accounting/bank-transfers/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el detalle de una transferencia bancaria. Si no existe, responde `404 NOT_FOUND`.

### `GET /api/mobile/v1/accounting/bank-transfers/:id/comprobante`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Descarga el comprobante PDF de la transferencia bancaria con el mismo nombre de archivo usado por web.

### `GET /api/mobile/v1/accounting/exchange/monedas`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el catálogo de monedas ordenado por nombre, con la misma forma base que usa web.

### `GET /api/mobile/v1/accounting/exchange/tasas`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve la moneda principal y las últimas tasas de cambio, alineadas con el contrato web.

### `GET /api/mobile/v1/accounting/bank-adjustments`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params**

- `cuentaId` requerido
- `page`, `limit`, `fechaInicio`, `fechaFin`, `tipo` opcionales

Devuelve ajustes bancarios paginados para una cuenta, con la misma semántica de lectura de web.

### `POST /api/mobile/v1/accounting/bank-adjustments`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Registra un ajuste bancario manual con el mismo efecto de saldo y auditoría ya implementado en web.

### `GET /api/mobile/v1/accounting/capital-injections`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `tipo`

Devuelve inyecciones de capital del tenant autenticado usando la lógica compartida de contabilidad.

### `POST /api/mobile/v1/accounting/capital-injections`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Registra una inyección de capital usando la misma lógica hoy expuesta por las actions web.

### `POST /api/mobile/v1/accounting/capital-injections/:id/payments`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Registra un pago asociado a una inyección de capital existente, reutilizando la lógica actual del proyecto.

### `GET /api/mobile/v1/accounting/reconciliation/sales`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve ventas con saldo pendiente de reconciliar según la lógica actual de web.

### `POST /api/mobile/v1/accounting/reconciliation/sales`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Registra una reconciliación de venta individual, reutilizando la lógica actual que hoy consume el formulario web.

### `GET /api/mobile/v1/accounting/reconciliation/sales/history`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve historial y estadísticas básicas de reconciliaciones de ventas.

### `GET /api/mobile/v1/accounting/reconciliation/services`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve servicios pendientes de reconciliar.

### `POST /api/mobile/v1/accounting/reconciliation/services`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Registra la reconciliación de un servicio con distribuciones, alineada con la lógica actual del proyecto.

### `GET /api/mobile/v1/accounting/reconciliation/services/history`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve historial de reconciliaciones de servicios.

### `GET /api/mobile/v1/accounting/reconciliation/expenses`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve gastos pendientes de reconciliar, incluyendo compras, salarios, servicios y costos de venta de servicios según la lógica actual del proyecto.

### `POST /api/mobile/v1/accounting/reconciliation/expenses`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Registra una reconciliación de gasto reutilizando el adapter canónico ya existente para web.

### `GET /api/mobile/v1/accounting/reconciliation/expenses/history`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve historial y estadísticas básicas de reconciliaciones de gastos.

### `GET /api/mobile/v1/accounting/reconciliation/stats`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el resumen global de reconciliación con pendientes, completados hoy, actividad reciente y monto reconciliado total, alineado con el panel web actual.

### `GET /api/mobile/v1/accounting/accounts-receivable`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `search`
- `estado` (`PENDIENTE` | `PAGADA` | `PARCIAL`)
- `clienteId`
- `page`
- `limit`

Devuelve `{ items, pagination }` para cuentas por cobrar del tenant autenticado.

### `GET /api/mobile/v1/accounting/accounts-receivable/metrics`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve:

- `totalPendiente`
- `porVencer`
- `vencidas`
- `totalCuentas`

### `GET /api/mobile/v1/accounting/accounts-payable`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `search`
- `estado` (`PENDIENTE` | `PAGADA` | `PARCIAL`)
- `tipo` (`compra` | `servicio`)
- `page`
- `limit`

Devuelve `{ items, pagination, metricas }` para cuentas por pagar del tenant autenticado.

### `GET /api/mobile/v1/accounting/cash-loans`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `estado` (`ACTIVO` | `PAGADO` | `VENCIDO` | `CANCELADO`)
- `clienteId`
- `moneda`
- `page`
- `limit`

Devuelve `{ items, pagination }` para préstamos cash del tenant autenticado.

### `POST /api/mobile/v1/accounting/cash-loans`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

Usa el mismo payload lógico del backend actual:

- `clienteId`
- `montoCapital`
- `moneda`
- `tasaInteres` (opcional)
- `tasaCambioAlCrear` (opcional)
- `fechaVencimiento` (opcional)
- `observaciones` (opcional)
- `cuentaBancariaId`

### `GET /api/mobile/v1/accounting/cash-loans/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve `{ item }` con el préstamo cash solicitado.

### `PUT /api/mobile/v1/accounting/cash-loans/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Permite editar los mismos campos permitidos hoy por el backend real:

- `fechaVencimiento`
- `tasaInteres`
- `observaciones`

### `GET /api/mobile/v1/accounting/cash-loans/:id/history`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve `prestamo`, `resumen` e `historial` de pagos reconciliados del préstamo.

### `POST /api/mobile/v1/accounting/cash-loans/:id/payments`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

- `monto`
- `cuentaId`
- `tipoPagoId`
- `moneda` (opcional)
- `tasaCambio` (opcional)
- `observaciones` (opcional)

### `GET /api/mobile/v1/accounting/cash-loans/:id/comprobante`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Descarga el comprobante PDF del préstamo cash con el mismo identificador de comprobante usado por web.

### `GET /api/mobile/v1/accounting/cash-loans/stats`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve métricas agregadas del módulo:

- `totalActivos`
- `totalPagados`
- `totalVencidos`
- `montoTotalPrestado`
- `montoPendienteCobro`
- `resumenMovimientos`

### `GET /api/mobile/v1/accounting/cash-debts`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `estado` (`ACTIVO` | `PAGADO` | `VENCIDO` | `CANCELADO`)
- `proveedorId`
- `moneda`
- `page`
- `limit`

Devuelve `{ items, pagination }` para deudas cash del tenant autenticado.

### `POST /api/mobile/v1/accounting/cash-debts`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

Usa el mismo payload lógico del backend actual:

- `proveedorId`
- `montoCapital`
- `moneda`
- `tasaInteres` (opcional)
- `fechaVencimiento` (opcional)
- `observaciones` (opcional)
- `comprobanteUrl` (opcional)
- `cuentaBancariaId`

### `GET /api/mobile/v1/accounting/cash-debts/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve `{ item }` con la deuda cash solicitada.

### `PUT /api/mobile/v1/accounting/cash-debts/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Permite editar los mismos campos permitidos hoy por el backend real:

- `fechaVencimiento`
- `tasaInteres`
- `observaciones`

### `POST /api/mobile/v1/accounting/cash-debts/:id/payments`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

- `monto`
- `cuentaId`
- `tipoPagoId`
- `moneda` (opcional)
- `tasaCambio` (opcional)
- `observaciones` (opcional)

### `GET /api/mobile/v1/accounting/cash-debts/stats`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve métricas agregadas del módulo:

- `totalActivas`
- `totalPagadas`
- `totalVencidas`
- `montoTotalDeuda`
- `montoPendientePago`

### `GET /api/mobile/v1/accounting/logs`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `entidad`
- `limit`
- `offset`

Devuelve `{ items, pagination }` con logs de auditoría contable.

Importante:

- respeta la misma restricción real del sistema: **solo admin**
- usa la misma fuente de verdad que web para auditoría

### `GET /api/mobile/v1/accounting/reports/summary`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `fechaInicio`
- `fechaFin`
- `cuentaId`
- `moneda`

Devuelve el resumen financiero base del módulo, incluyendo:

- `resumenPorMoneda`
- `cuentasBancarias`
- `estadisticas`
- `filtros`

### `GET /api/mobile/v1/accounting/reports/movements`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `busqueda`
- `fechaInicio`
- `fechaFin`
- `cuentaId`
- `tipoMovimiento`
- `moneda`
- `page`
- `limit`

Devuelve:

- `items`
- `totales`
- `pagination`
- `filtros`

Este reporte ya contempla los movimientos reales del proyecto, incluyendo ventas, servicios, gastos, transferencias, ajustes, inyecciones, pagos de deuda y los flujos de préstamos/deudas cash.

### `GET /api/mobile/v1/accounting/reports/exchange`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `fechaInicio`
- `fechaFin`
- `monedaOrigen`
- `monedaDestino`

Devuelve:

- `historialTasas`
- `transaccionesConversion`
- `conversiones`
- `estadisticasConversion`
- `filtros`

Este endpoint reutiliza la lógica real ya existente para el reporte de conversiones, incluyendo reconciliaciones, ajustes y transferencias con tasa de cambio.

### `GET /api/mobile/v1/accounting/reports/exchange-impact`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `fechaInicio`
- `fechaFin`
- `monedaBase`
- `tipoAnalisis`

Devuelve:

- `resumen`
- `porMoneda`
- `porCuenta`
- `recomendaciones`
- `filtros`

Este endpoint expone para mobile el mismo análisis real de impacto cambiario ya implementado en web sobre ventas, servicios, gastos, ajustes y transferencias.

### `GET /api/mobile/v1/accounting/reports/transfers`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `fechaInicio`
- `fechaFin`
- `cuentaOrigenId`
- `cuentaDestinoId`
- `moneda`
- `page`
- `limit`

Devuelve:

- `items`
- `estadisticas`
- `pagination`
- `filtros`

Este endpoint reutiliza el reporte real de transferencias bancarias ya implementado en web, incluyendo estadísticas por moneda, cuentas más activas y transferencias con conversión.

### `GET /api/mobile/v1/accounting/reports/overdue-invoices`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Autorización**

- disponible para `admin`
- o para usuarios con feature flag `facturas-vencidas`

Devuelve:

- `reporte` — agregado por cliente y bucket de antigüedad
- `facturas` — detalle de facturas pendientes ordenadas por mayor antigüedad

Este endpoint reutiliza la misma fuente real del sistema que hoy consume la pantalla web de Facturas Vencidas (`/api/sugerencias/ingresos-por-edades`), sin inventar lógica paralela.

### `GET /api/mobile/v1/accounting/reports/client-account-analysis`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params**

- `clienteId` requerido

**Autorización**

- requiere acceso a `facturacion` para incluir el historial real de facturas del cliente

Devuelve:

- `clienteId`
- `estadisticas`
- `cuentasPendientes`
- `historialFacturas`
- `ultimaActividad`

Este endpoint replica la construcción real de la pantalla web de Análisis de Estado de Cuenta: combina cuentas por cobrar enriquecidas con el historial de facturas del cliente.

### `GET /api/mobile/v1/accounting/advances/reports/customers`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `clienteId`
- `fechaInicio`
- `fechaFin`

Devuelve:

- `clientes` — grupos por cliente con `anticipos` y `totales`

Este endpoint reutiliza el reporte real de anticipos de cobro por cliente que ya existe en web, incluyendo total original, ejecutado y pendiente por cada agrupación.

### `GET /api/mobile/v1/accounting/advances/reports/providers`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `proveedorId`
- `fechaInicio`
- `fechaFin`

Devuelve:

- `proveedores` — grupos por proveedor con `anticipos` y `totales`

Este endpoint reutiliza el reporte real de anticipos de pago por proveedor que ya existe en web, incluyendo total original, ejecutado y pendiente por cada agrupación.

### `GET /api/mobile/v1/accounting/advances/reports/summary`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `tipo` (`PAGO` | `COBRO`)
- `fechaInicio`
- `fechaFin`

Devuelve:

- `resumen`
  - `porTipo`
  - `porEstado`
  - `porMoneda`
  - `totalesGenerales`

Este endpoint reutiliza el resumen real de anticipos ya implementado en web para mostrar distribución por tipo, estado, moneda y totales globales.

### `GET /api/mobile/v1/accounting/advances`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Lista los anticipos del tenant autenticado con sus relaciones principales.

### `POST /api/mobile/v1/accounting/advances`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

```json
{
  "tipo": "COBRO",
  "contratoId": "ctr-1",
  "clienteId": "cli-1",
  "monto": 100,
  "moneda": "CUP"
}
```

Crea un anticipo usando el workflow real y validación de período contable.

### `GET /api/mobile/v1/accounting/advances/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Devuelve el detalle de un anticipo del tenant autenticado, incluyendo contrato, proveedor, cliente y movimientos.

### `PUT /api/mobile/v1/accounting/advances/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Actualiza campos operativos del anticipo: estado, saldo disponible, vigencia y referencia externa.

### `DELETE /api/mobile/v1/accounting/advances/:id`

**Headers**

```http
Authorization: Bearer <accessToken>
```

Elimina un anticipo del tenant autenticado.

### `POST /api/mobile/v1/accounting/advances/:id/ejecutar`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

```json
{
  "contexto": "COMPRA_PRODUCTO",
  "documentoDestinoId": "doc-1",
  "montoObjetivo": 100,
  "monedaObjetivo": "CUP",
  "idempotencyKey": "abc-123"
}
```

Ejecuta el anticipo usando el flujo real de negocio y validación de período contable.

### `POST /api/mobile/v1/accounting/advances/:id/revertir`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Body**

```json
{
  "documentoDestinoId": "doc-1",
  "montoReverso": 100
}
```

Revierte un anticipo usando el flujo real ya existente en web.

### `GET /api/mobile/v1/accounting/advances/available`

**Headers**

```http
Authorization: Bearer <accessToken>
```

**Query params opcionales**

- `contexto`
- `proveedorId`
- `clienteId`
- `moneda`
- `estado`

Devuelve anticipos vigentes con saldo disponible > 0, listos para ser aplicados en compras o facturas.

## Error model

| Case | Status | Code |
|------|--------|------|
| Credenciales inválidas | 401 | `INVALID_CREDENTIALS` |
| Token ausente/inválido | 401 | depende del middleware |
| Usuario inactivo | 403 | `USER_INACTIVE` |
| Licencia expirada | 403 | `LICENSE_EXPIRED` |
| Tenant no autorizado | 403 | `FORBIDDEN` |
| Body inválido | 400 | `VALIDATION_ERROR` |
| Error interno | 500 | `INTERNAL_ERROR` |

## Secure token storage

El cliente nativo NO debería guardar tokens en AsyncStorage/plain preferences si puede evitarlo.

| Platform | Recommended storage |
|----------|---------------------|
| iOS (Swift) | Keychain |
| Android (Kotlin) | EncryptedSharedPreferences |
| React Native | Expo SecureStore o equivalente nativo seguro |
| Flutter | flutter_secure_storage o equivalente seguro |

Reglas mínimas:

- Guardar `refreshToken` sólo en storage seguro.
- Mantener `accessToken` en memoria cuando sea posible y regenerarlo con refresh.
- Borrar ambos tokens en logout local y remoto.
- Si cambia el tenant activo, reemplazar ambos tokens por los nuevos.

## Rollout order for next mobile modules

1. **Products remaining reads**: stock enriquecido, búsqueda y filtros avanzados.
2. **Sales remaining reads**: resúmenes, analíticas y filtros más especializados.
3. **Mutations críticas**: create/update/anular con validación explícita.
4. **Exports / integraciones**: mantenerlas fuera del primer contrato mobile si siguen siendo web-centric.

Criterio de migración por módulo:

- extraer lógica a servicio compartido,
- dejar adapter web fino,
- agregar endpoint mobile,
- cubrir con tests de regresión web + tests mobile.

## NestJS extraction note

Migrar a NestJS puede tener sentido MÁS ADELANTE, pero hoy no es el cuello de botella principal.

Antes de pensar en extraer framework:

- la lógica debe vivir en servicios compartidos,
- auth no debe depender de Server Actions,
- contratos HTTP deben estar estabilizados,
- tests deben cubrir compatibilidad web + mobile.

Si eso ya existe, mover luego a NestJS es una migración de adapters e infraestructura. Si NO existe, migrar de framework ahora sólo movería el acoplamiento de lugar.

## Verification checklist

- [x] Auth mobile usa JSON tokens y no depende de cookies web.
- [x] Dashboard mobile usa el mismo servicio que la ruta web.
- [x] Tenant switching devuelve nuevo contexto de tokens.
- [x] Products list/detail ya exponen contrato mobile-first.
- [x] Products stock por ubicación ya expone contrato mobile-first alineado con la capacidad existente.
- [x] Sales list/detail ya exponen contrato mobile-first.
- [x] Sales create/update/cancel reutilizan la misma lógica de negocio desde un servicio compartido.
- [ ] Documentar más ejemplos por módulo a medida que entren nuevos slices.

## Relevant implementation files

- `src/lib/api-response.ts`
- `src/features/auth/services/auth-service.ts`
- `src/app/api/mobile/v1/auth/login/route.ts`
- `src/app/api/mobile/v1/auth/refresh/route.ts`
- `src/app/api/mobile/v1/auth/me/route.ts`
- `src/app/api/mobile/v1/auth/logout/route.ts`
- `src/app/api/mobile/v1/auth/tenants/route.ts`
- `src/features/dashboard/services/dashboard-stats-service.ts`
- `src/app/api/mobile/v1/dashboard/stats/route.ts`
- `src/features/productos/services/producto-service.ts`
- `src/app/api/mobile/v1/products/route.ts`
- `src/app/api/mobile/v1/products/[id]/route.ts`
- `src/features/ventas/services/venta-read-service.ts`
- `src/features/ventas/services/venta-mutation-service.ts`
- `src/app/api/mobile/v1/sales/route.ts`
- `src/app/api/mobile/v1/sales/[id]/route.ts`
- `src/app/api/mobile/v1/sales/create/route.ts`
- `src/app/api/mobile/v1/sales/[id]/update/route.ts`
- `src/app/api/mobile/v1/sales/[id]/cancel/route.ts`

## Next step

El próximo slice recomendado es **sales summaries / analytics** o, si se expone contabilidad para mobile, hacerlo respetando los dominios YA implementados del proyecto:

- **reconciliación de ventas** para cobros completos,
- **cuentas por cobrar** para cobros parciales,
- **cuentas por pagar** para pagos parciales,
- **anticipos** para pagos/cobros anticipados,
- **préstamos / deudas** para sus flujos contables específicos.

No conviene inventar un dominio genérico `payments` si la lógica real del sistema está distribuida en esos módulos contables.
