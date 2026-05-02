# Inventario de Tablas que Requieren tenantId

## Criterio
Una tabla requiere `tenantId` si contiene datos operativos que pertenecen a una empresa específica y deben estar aislados entre empresas.

## Tablas que REQUIEREN tenantId (obligatorio)

### Dominio Catálogo
- **Producto** — productos del inventario
- **Categoria** — árbol de categorías
- **Unidad** — unidades de medida (¿o es global? probablemente sí es por tenant si cada empresa define sus unidades)
- **Vendor** — proveedores
- **Cliente** — clientes
- **ListaPrecio** — listas de precio
- **PrecioProducto** — precios por producto/lista

### Dominio Almacén / Punto de Venta
- **Almacen** — almacenes
- **PuntoDeVenta** — puntos de venta
- **StockUbicacion** — stock por ubicación
- **Transferencia** — transferencias entre almacenes/PdV

### Dominio Ventas
- **Venta** — cabecera de venta
- **VentaItem** — items de venta (no visible en el schema? se refiere a ventaItems en Producto)

### Dominio Compras
- **CompraProducto** — compra unitaria
- **CompraDocumento** — cabecera de compra múltiple
- **CompraDocumentoItem** — detalle de compra múltiple
- **GastoCompra** — gasto de compra
- **CompraServicio** — compra de servicio

### Dominio Servicios
- **Servicios** — catálogo de servicios
- **VentaServicios** — venta de servicios

### Dominio Gastos
- **GastosDE** — gastos de explotación
- **GastoConcepto** — conceptos de gasto
- **GastoElemento** — elementos de gasto

### Dominio Financiero
- **CuentaBancaria** — cuentas bancarias de la empresa
- **AjusteBancario** — ajustes a cuentas
- **TransferenciaBancaria** — transferencias entre cuentas
- **ReconciliacionVenta** — conciliación de ventas
- **ReconciliacionServicio** — conciliación de servicios
- **ReconciliacionGasto** — conciliación de gastos
- **CuentaPorCobrar** — cuentas por cobrar
- **CuentaPorPagar** — cuentas por pagar
- **PagoCuentaPorPagar** — pagos a cuentas
- **DeudaCash** — deudas en efectivo
- **PrestamoCash** — préstamos en efectivo
- **InyeccionCapital** — inyecciones de capital
- **PagoDeuda** — pagos de deuda

### Dominio Producción
- **Receta** — recetas de producción
- **RecetaIngrediente** — ingredientes de receta
- **OrdenProduccion** — órdenes de producción
- **OrdenProduccionHistorial** — historial de órdenes
- **ValeSalida** — vales de salida
- **ValeSalidaItem** — items de vale
- **ProductoCostHistory** — histórico de costos

### Dominio Contratos
- **Contrato** — contratos
- **ContratoVersion** — versiones de contrato
- **ContratoFirma** — firmas
- **ContratoAprobacion** — aprobaciones
- **ContratoArchivo** — archivos
- **ContratoAlerta** — alertas
- **TipoContratoCustom** — tipos de contrato personalizados
- **Anticipo** — anticipos
- **AnticipoMovimiento** — movimientos de anticipo

### Dominio Facturación
- **Factura** — facturas
- **SerieFacturacion** — series de facturación

### Dominio Ofertas
- **Oferta** — ofertas
- **OfertaItem** — items de oferta

### Dominio Reparaciones
- **OrdenReparacion** — órdenes de reparación
- **OrdenReparacionEquipo** — equipos en orden
- **OrdenReparacionItem** — items de reparación
- **OrdenReparacionMaterial** — materiales
- **EquipoReparacion** — equipos
- **PiezaReparacion** — piezas
- **DefectacionCatalogo** — catálogo de defectos

### Dominio RRHH
- **Empleado** — empleados de la empresa
- **Pagosalario** — pagos de salario
- **Attendance** — asistencia
- **EmployeeWorkSchedule** — horarios
- **VacationRequest** — solicitudes de vacaciones
- **VacationAccrual** — acumulación de vacaciones
- **CierreContable** — cierres contables
- **Moneda** — (¿global o tenant?)

### Dominio Configuración
- **ConfiguracionSistema** — configuración
- **TasaCambio** — tasas de cambio
- **TransaccionMoneda** — transacciones de moneda
- **CatalogoReparacionConfig** — config de moneda reparaciones

## Tablas GLOBALES (sin tenantId)
- **User** — identidad global (pero sus membresías son por tenant)
- **Plan** — catálogo de planes, global
- **Licencia** — se refactoriza a TenantLicense, deja de ser global
- **UserSession** — sesiones, ligadas a User (global)
- **UserActivityLog** — logs de actividad
- **Notification** — notificaciones
- **AlertHistory** — historial de alertas
- **AuditLog** — log de auditoría (¿o debería ser por tenant?)
- **ReportHistory** — historial de reportes
- **ScheduledReport** — reportes programados
- **ScenarioSimulation** — simulaciones
- **VendorCodeSequence** — secuencia global de códigos
- **TipoPago** — tipos de pago (¿globales?)

## Orden propuesto de migración de tablas

1. **Fase 1 (actual)**: Crear modelos tenant y agregar tenantId a MiEmpresa.
2. **Fase 2 (backfill)**: Tablas maestras: Producto, Categoria, Vendor, Cliente, Almacen, PuntoDeVenta, Empleado.
3. **Fase 3 (volumen alto)**: Venta, CompraDocumento, GastosDE, Factura, OrdenReparacion.
4. **Fase 4 (financiero)**: CuentaBancaria, CuentaPorCobrar, CuentaPorPagar, anticipos, préstamos, deudas.
5. **Fase 5 (resto)**: Producción, reportes, configuración, lo que quede.
