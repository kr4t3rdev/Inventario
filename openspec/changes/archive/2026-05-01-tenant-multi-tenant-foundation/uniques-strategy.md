# Estrategia de Reemplazo de Uniques Globales

## Principio general
Los uniques globales existentes deben convertirse en **uniques compuestos con tenantId** cuando el dato pertenezca al dominio del tenant. Los identificadores tipo `cuid` no necesitan cambio porque ya son únicos globalmente. Los IDs autoincrementales (`@default(autoincrement())`) deben manejarse con cuidado porque su secuencia es global.

## Uniques que DEBEN cambiar a compuestos con tenantId

| Tabla | Campo Unique Actual | Nuevo Unique | Prioridad |
|-------|---------------------|--------------|-----------|
| `User` | `email @unique` | **DEBATE**: ¿email único global o por tenant? Recomiendo mantener global para identidad única en el sistema | Alta |
| `Vendor` | `vendorCode @unique` | `@@unique([tenantId, vendorCode])` | Alta |
| `Producto` | `codigoInterno @unique` | `@@unique([tenantId, codigoInterno])` | Alta |
| `Producto` | `codigoNegocio @unique` | `@@unique([tenantId, codigoNegocio])` | Alta |
| `GastoConcepto` | `nombre @unique` | `@@unique([tenantId, nombre])` | Media |
| `Contrato` | `numeroContrato @unique` | `@@unique([tenantId, numeroContrato])` | Media |
| `Contrato` | `@@unique([tipo, numeroConsecutivo])` | Agregar tenantId al compuesto | Media |
| `CuentaBancaria` | `numeroCuenta @unique` | `@@unique([tenantId, numeroCuenta])` | Alta |
| `TransferenciaBancaria` | `numeroComprobante @unique` | `@@unique([tenantId, numeroComprobante])` | Media |
| `TipoContratoCustom` | `nombre @unique` | `@@unique([tenantId, nombre])` | Media |
| `Factura` | `numeroFactura @unique` | `@@unique([tenantId, numeroFactura])` | Alta |
| `Oferta` | `numeroOferta @unique` | `@@unique([tenantId, numeroOferta])` | Media |
| `SerieFacturacion` | `prefijo @unique` | `@@unique([tenantId, prefijo])` | Media |
| `PrecioProducto` | `@@unique([listaPrecioId, productoId])` | Ambos campos ya llevan tenantId transitivo, evaluar si agregar tenantId directo | Baja |
| `MiEmpresa` | `cuentaBancariaId @unique` | Se mantiene (cuid), es por tenant | Baja |

## Uniques tipo FK/cuid que NO necesitan cambio

Estos usan `cuid` como ID (globalmente únicos por construcción) y no compiten entre tenants:

- `Licencia.clave` @unique (se refactoriza a TenantLicense)
- `CompraProducto.gastoCompraId` @unique
- `CompraProducto.cuentaPorPagarId` @unique
- `CompraDocumento.gastoCompraId` @unique
- `CompraDocumento.cuentaPorPagarId` @unique
- `Anticipo.facturaId` @unique
- `Anticipo.compraProductoId` @unique
- `Factura.ventaId` @unique
- `CuentaPorCobrar.facturaId` @unique
- `CuentaPorPagar.gastoCompraId` @unique
- `CuentaPorPagar.gastosDEId` @unique
- `DeudaCash.cuentaPorPagarId` @unique
- `PrestamoCash.cuentaPorCobrarId` @unique
- `OrdenReparacion.ventaId` @unique
- `EmployeeWorkSchedule.@@unique([employeeId, dayOfWeek])` (hereda tenantId de empleado)
- `VendorCodeSequence` (singleton global)
- `MiEmpresa.id @default(1)` (singleton, se refactoriza con tenantId)
- `CatalogoReparacionConfig.monedaId @unique`

## Uniques autoincrementales que requieren análisis

| Tabla | Campo | Estrategia |
|-------|-------|------------|
| `Factura.numeroConsecutivo` | `@default(autoincrement())` | La secuencia es global. Migrar a secuencia por tenant o mantener global. Recomiendo: secuencia por tenant (ej. `@@unique([tenantId, numeroConsecutivo])` ) |
| `CuentaPorCobrar.idCC` | `@default(autoincrement())` | Baja prioridad, es ID interno |
| `CuentaPorPagar.cuentaPorPagarId` | cuid | Sin cambios |
| `OrdenReparacion.numeroOrden` | `@default(autoincrement())` | Migrar a secuencia por tenant |
| `Contrato.numeroConsecutivo` | `Int` (no autoincrement) | `@@unique([tenantId, tipo, numeroConsecutivo])` |

## Resumen de orden de ejecución

1. **YA (Fase 1)**: Los nuevos modelos tenant no tienen uniques globales conflictivos.
2. **Fase 2 (backfill)**: Primero migrar datos al tenant default, después cambiar los uniques.
3. **Fase de endurecimiento**: Reemplazar uniques compuestos UNA VEZ que el backfill esté completo y validado.

**Regla de oro**: No eliminar un unique global hasta que todos los datos existentes tengan `tenantId` poblado y el unique compuesto pueda crearse sin conflictos.
