export interface Producto {
	id: string;
	nombre: string;
	descripcion: string | null;
	codigoInterno?: string | null;
	codigoNegocio?: string | null;
	proveedorCodigo?: string | null;
	idSeccionCodigo?: string | null;
	especificoCodigo?: string | null;
	surtidoCodigo?: string | null;
	dcCodigo?: string | null;
	precioCosto: number;
	precioVenta: number;
	stock: number;
	stockMinimo: number;
	fotos: string[];
	categoriaId: string;
	subcategoriaId?: string;
	unidadId: string;
	vendorId?: string;
	createdAt: string;
	updatedAt: string;
	almacenId: string;
	// Campos para productos compuestos
	esCompuesto?: boolean;
	cantidadEnPack?: number | null;
	productoPadreId?: string | null;
	categoria?: {
		catId: string;
		nombre: string;
	};
	subcategoria?: {
		catId: string;
		nombre: string;
		parentId: string;
	};
	unidad?: {
		unidadId: string;
		nombre: string;
		simbolo: string;
	};
	vendor?: {
		vendorId: string;
		nombre: string;
	};
	almacen?: {
		almacenId: string;
		nombre: string;
	};
	precios?: Array<{
		listaPrecioId: string;
		precio: number;
	}>;
	// Relaciones para productos compuestos
	productoPadre?: Producto;
	productosHijos?: Producto[];
}

export interface Unidad {
	unidadId: string;
	nombre: string;
	simbolo: string;
	createdAt: string;
	updatedAt: string;
}

export interface Categoria {
	catId: string;
	nombre: string;
	descripcion?: string;
	parentId?: string;
	parent?: Categoria;
	subcategorias?: Categoria[];
	createdAt: string;
	updatedAt: string;
}

export interface CategoriaHierarchy {
	catId: string;
	nombre: string;
	descripcion?: string;
	level: number; // 0 for root categories, 1+ for subcategories
	path: string[]; // Array of parent category IDs
	subcategorias: CategoriaHierarchy[];
	productCount: number; // Number of products in this category and subcategories
}

// Request/Response types for category operations
export interface CreateCategoriaRequest {
	nombre: string;
	descripcion?: string;
	parentId?: string;
}

export interface MoveCategoriaRequest {
	catId: string;
	newParentId?: string;
}

export interface Vendor {
	vendorId: string;
	nombre: string;
	proveedorCodigo?: string | null;
	direccion?: string | null;
	telefono?: string | null;
	contacto?: string | null;
	cuentaCUP?: string | null;
	cuentaUSD?: string | null;
	logo?: string | null;
	contrato?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface Proveedor {
	proveedorId: string;
	nombre: string;
	proveedorCodigo?: string | null;
	direccion?: string | null;
	telefono?: string | null;
	contacto?: string | null;
	cuentaCUP?: string | null;
	cuentaUSD?: string | null;
	logo?: string | null;
	contrato?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CompraProducto {
	compraProductoId: string;
	productoId: string;
	proveedorId: string;
	numeroFactura: string;
	facturaUrl: string;
	cantidad: number;
	precioUnitario: number;
	total: number;
	formaPago: "PAGO_PARCIAL" | "PAGO_COMPLETO";
	estado: "PENDIENTE" | "PAGADA";
	tipoOperacion: "RESTOCK" | "REGULAR";
	descripcion?: string | null;
	fechaCompra: string;
	gastoCompraId?: string | null;
	cuentaPorPagarId?: string | null;
	createdAt: string;
	updatedAt: string;
	producto?: Producto;
	proveedor?: Vendor;
}

export interface CompraDocumentoItem {
	compraDocumentoItemId: string;
	compraDocumentoId: string;
	productoId: string;
	cantidad: number;
	precioUnitario: number;
	totalLinea: number;
	createdAt: string;
	updatedAt: string;
	producto?: Producto;
	stockAntes?: number;
	stockDespues?: number;
	precioCostoAntes?: number;
	precioCostoDespues?: number;
	metodoCosto?: "PRIMERA_COMPRA" | "PONDERADO";
}

export interface CompraDocumento {
	compraDocumentoId: string;
	proveedorId: string;
	numeroFactura: string;
	facturaUrl: string;
	formaPago: "PAGO_PARCIAL" | "PAGO_COMPLETO" | "ANTICIPO_PAGO";
	estado: "PENDIENTE" | "PAGADA";
	tipoOperacion: "RESTOCK" | "REGULAR";
	descripcion?: string | null;
	fechaCompra: string;
	total: number;
	gastoCompraId?: string | null;
	cuentaPorPagarId?: string | null;
	deletedAt?: string | null;
	updatedById?: string | null;
	createdAt: string;
	updatedAt: string;
	proveedor?: Vendor;
	items?: CompraDocumentoItem[];
}

export interface CompraDocumentoResponse {
	success: boolean;
	compraDocumento: CompraDocumento;
	items: CompraDocumentoItem[];
	gastoCompra?: any;
	cuentaPorPagar?: any;
}

export interface CompraProductoResponse {
	success: boolean;
	producto: Producto;
	productoActualizado?: Producto;
	stockAntes?: number;
	stockDespues?: number;
	precioCostoAntes?: number;
	precioCostoDespues?: number;
	metodoCosto?: "PRIMERA_COMPRA" | "PONDERADO";
	compraProducto: CompraProducto;
	gastoCompra?: any;
	cuentaPorPagar?: any;
	advertencia?: string;
	contrato?: {
		tieneContrato: boolean;
		estado: string;
		fechaVencimiento?: string;
		diasRestantes?: number;
		diasAlerta?: number;
	};
}

export interface PuntoDeVenta {
	pvId: string;
	nombre: string;
	ubicacion: string | null;
	tipoCaja?: string | null;
	almacenId?: string | null;
	cuentaContableId?: string | null;
	stockPuntoVenta: number;
	listaPrecioId?: string | null;
	listaPrecio?: {
		id: string;
		nombre: string;
	} | null;
	createdAt: string;
	updatedAt: string;
}

export type MesaRestauranteEstado = "DISPONIBLE" | "OCUPADA" | "RESERVADA";

export interface MesaRestaurante {
	mesaId: string;
	numero: number;
	capacidad: number;
	estado: MesaRestauranteEstado;
	createdAt: string;
	updatedAt: string;
}

export type TipoPlatoRestaurante = "COMIDA" | "BEBIDA" | "POSTRE" | "APERITIVO";

export interface PlatoRestaurante {
	platoId: string;
	nombre: string;
	descripcion: string | null;
	precio: number;
	imagen: string | null;
	disponible: boolean;
	tipoPlato: TipoPlatoRestaurante;
	esElaborado: boolean;
	categoriaPlatoId: string | null;
	createdAt: string;
	updatedAt: string;
	categoriaPlato?: {
		categoriaPlatoId: string;
		nombre: string;
	} | null;
}

export type EstadoComandaRestaurante = "ABIERTA" | "CERRADA" | "CANCELADA";
export type EstadoComandaItemRestaurante =
	| "PENDIENTE"
	| "EN_PROCESO"
	| "LISTO"
	| "SERVIDO";

export interface ComandaRestauranteItem {
	comandaItemId: string;
	comandaId: string;
	platoId: string;
	cantidad: number;
	precioUnitario: number;
	notas: string | null;
	estado: EstadoComandaItemRestaurante;
	createdAt: string;
	updatedAt: string;
	plato?: {
		platoId: string;
		nombre: string;
		precio: number;
		tipoPlato: TipoPlatoRestaurante;
	};
}

export interface ComandaRestaurante {
	comandaId: string;
	mesaId: string;
	empleadoId: string | null;
	estado: EstadoComandaRestaurante;
	total: number;
	observaciones: string | null;
	fechaApertura: string;
	fechaCierre: string | null;
	createdAt: string;
	updatedAt: string;
	mesa: MesaRestaurante;
	empleado?: {
		empleadoId: string;
		nombre: string;
		apellido: string;
	} | null;
	items: ComandaRestauranteItem[];
}

export interface RecetaRestauranteIngrediente {
	recetaIngredienteId: string;
	recetaId: string;
	productoId: string;
	cantidad: number;
	desperdicio: number;
	createdAt: string;
	updatedAt: string;
	producto: {
		id: string;
		nombre: string;
		precioCosto: number;
		stock: number;
	};
}

export interface RecetaRestaurante {
	recetaId: string;
	nombre: string;
	rendimiento: number;
	costoUnitario: number;
	instrucciones: string | null;
	tiempoPrep: number | null;
	createdAt: string;
	updatedAt: string;
	plato?: {
		platoId: string;
		nombre: string;
		precio: number;
	} | null;
	ingredientes: RecetaRestauranteIngrediente[];
}

export type EstadoProduccionRestaurante =
	| "PENDIENTE"
	| "EN_PROCESO"
	| "COMPLETADA"
	| "CANCELADA";

export interface OrdenProduccionRestaurante {
	ordenProduccionId: string;
	recetaId: string;
	cantidad: number;
	estado: EstadoProduccionRestaurante;
	observaciones: string | null;
	fechaProduccion: string;
	createdAt: string;
	updatedAt: string;
	receta: RecetaRestaurante;
}

export interface CierreCajaPos {
	cierreId: string;
	tipo: string;
	fechaInicio: string;
	fechaFin: string;
	totalVentas: number;
	totalGastos: number;
	ganancias: number;
	perdidas: number;
	ingresosCaja: number;
	egresosCaja: number;
	deudasClientes: number;
	deudasProveedores: number;
	inventarioVendido: number;
	inventarioRebajado: number;
	stockFinal: number;
	margenGanancia: number;
	margenPerdida: number;
	ventasVsExistencias: string | null;
	estado: string;
	creadoPor: string;
	aprobadoPor: string | null;
	observaciones: string | null;
	createdAt: string;
	updatedAt: string;
}

export type KdsPrioridad = "NORMAL" | "MEDIA" | "ALTA";

export interface KdsComanda extends ComandaRestaurante {
	elapsedMinutes: number;
	itemsPendientes: number;
	prioridad: KdsPrioridad;
}

export interface StockUbicacion {
	stockId: string;
	productoId: string;
	tipoUbicacion: "almacen" | "punto_venta";
	ubicacionId: string;
	cantidad: number;
	cantidadReservada: number;
	cantidadDisponible: number;
	ultimaActualizacion: string;
	createdAt: string;
	updatedAt: string;
}

export interface CuentaPorPagar {
	cuentaPorPagarId: string;
	numeroFactura: string;
	tipo: "compra" | "servicio";
	gastoCompraId: string | null;
	gastosDEId: string | null;
	proveedorId: string | null;
	proveedorNombre: string | null;
	montoDeuda: number;
	montoPagado: number;
	saldoPendiente: number;
	moneda: string;
	fechaEmision: string;
	fechaVencimiento: string | null;
	estado: "PENDIENTE" | "PAGADA" | "PARCIAL";
	tipoDeuda?: "COMPRA" | "DEUDA_CASH";
	createdAt: string;
	updatedAt: string;
	rangoAntiguedad?: string;
	diasTranscurridos?: number;
	proveedor?: Vendor;
	vendor?: Vendor;
	gastosDE?: GastosDE;
	gastoCompra?: GastosCompra;
	cuentaCUP?: string | null;
	cuentaUSD?: string | null;
	pagos?: PagoCuentaPorPagar[];
	deudaCash?: DeudaCash | null;
}

export interface CreateCuentaPorPagarRequest {
	numeroFactura: string;
	tipo: "compra" | "servicio";
	proveedorId: string;
	montoDeuda: number;
	moneda?: string;
	fechaEmision?: string;
	fechaVencimiento?: string;
	estado?: "PENDIENTE" | "PAGADA" | "PARCIAL";
}

export interface PagarCuentaPorPagarRequest {
	monto: number;
	numeroTransaccion: string;
	cuentaProveedor: string;
	observaciones?: string;
}

export interface PagoCuentaPorPagar {
	pagoCuentaPorPagarId: string;
	cuentaPorPagarId: string;
	monto: number;
	numeroTransaccion: string;
	cuentaProveedor: string;
	fechaPago: string;
	observaciones?: string;
	createdAt: string;
	updatedAt: string;
}

export interface VentaItem {
	id: string;
	ventaId: string;
	productoId: string;
	cantidad: number;
	precioUnitario: number;
	total: number;
	producto?: Producto;
}

export interface Venta {
	ventaId: string;
	productoId?: string | null;
	cantidad: number;
	puntoDeVentaId: string;
	cliente?: {
		clienteId?: string;
		nombre?: string;
	};
	total?: number;
	descuento?: number;
	observaciones?: string | null;
	createdAt: string;
	updatedAt: string;
	producto?: Producto;
	puntoDeVenta?: {
		pvId: string;
		nombre: string;
	};
	ordenId?: string;
	turnoId?: string | null;
	metodoPago?: string | null;
	montoEfectivo?: number | null;
	montoTarjeta?: number | null;
	montoTransferencia?: number | null;
	montoCredito?: number | null;
	oferta?: Oferta;
	factura?: Factura;
	reconciliaciones?: ReconciliacionVenta[];
	items?: VentaItem[];
}

export interface VentaStats {
	totalVentas: number;
	ventasPorMes: {
		mes: string;
		total: number;
	}[];
}

export interface VentaWithDetails extends Venta {
	producto: Producto;
	puntoDeVenta: PuntoDeVenta;
}

export interface Merma {
	mermaId: string;
	productoId: string;
	cantidad: number;
	motivo: string | null;
	createdAt: string;
	updatedAt: string;
	producto?: {
		id: string;
		nombre: string;
		codigoInterno?: string | null;
		precioCosto: number;
	};
}

export interface MermaStats {
	totalMermas: number;
	mermasPorMes: {
		mes: string;
		total: number;
	}[];
}

export interface MermaWithDetails extends Merma {
	producto: Producto;
}

export interface Transferencia {
	transferenciaId: string;
	productoId: string;
	cantidad: number;
	descripcion?: string;
	origenId?: string | null;
	destinoId?: string | null;
	puntoDeVentaOrigenId?: string | null;
	puntoDeVentaDestinoId?: string | null;
	estado: EstadoTransferencia;
	numeroTransferencia?: string | null;
	createdAt: string;
	updatedAt: string;
	productoCodigoInterno?: string | null;
	origenNombre?: string;
	destinoNombre?: string;
	producto?: {
		id: string;
		nombre: string;
		codigoInterno?: string | null;
	};
	origen?: {
		almacenId?: string;
		nombre: string;
	};
	destino?: {
		almacenId?: string;
		nombre: string;
	};
	puntoDeVentaOrigen?: {
		pvId: string;
		nombre: string;
	};
	puntoDeVentaDestino?: {
		pvId: string;
		nombre: string;
	};
	tipoTransferencia: string;
}

export interface TransferenciaWithDetails extends Transferencia {
	producto: Producto;
	origen: PuntoDeVenta;
	destino: PuntoDeVenta;
}

// Nuevos tipos para transferencias múltiples
export interface ProductoTransferencia {
	productoId: string;
	cantidad: number;
}

export interface TransferenciaMultiple {
	productos: ProductoTransferencia[];
	tipoOrigen: "almacen" | "punto_venta";
	origenId: string;
	tipoDestino: "almacen" | "punto_venta";
	destinoId: string;
	descripcion?: string;
}

export type EstadoTransferencia =
	| "PENDIENTE"
	| "EN_TRANSITO"
	| "COMPLETADA"
	| "CANCELADA"
	| "PARCIAL";

// Tipos para el modelo normalizado de transferencias
export interface TransferenciaCabecera {
	cabeceraId: string;
	numeroTransferencia: string;
	estado: EstadoTransferencia;
	tipoOrigen: "almacen" | "punto_venta";
	origenId: string;
	tipoDestino: "almacen" | "punto_venta";
	destinoId: string;
	descripcion?: string;
	creadoPorId?: string;
	deletedAt?: string;
	createdAt: string;
	updatedAt: string;
	items: TransferenciaItem[];
}

export interface TransferenciaItem {
	itemId: string;
	cabeceraId: string;
	productoId: string;
	cantidad: number;
	cantidadRecibida: number;
	producto?: Producto;
}

export interface Usuario {
	userId: string;
	name: string;
	email: string;
	password: string;
	role: string;
	tenantRole?: string | null;
	isActive: boolean;
	avatar: string | null;
	activatedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
	onboardingStatus?: string | null;
	onboardingType?: string | null;

	lastModifiedBy: string | null;
	loginAttempts: number;
	lockedUntil: string | null;
	lastFailedLogin: string | null;

	notificaciones?: {
		id: string;
		title: string;
	};
}

export interface UserActivityLog {
	id: string;
	userId: string;
	action: string;
	details: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	performedBy: string | null;
	createdAt: string;
}

export interface UserSession {
	id: string;
	userId: string;
	token: string;
	ipAddress: string | null;
	userAgent: string | null;
	isActive: boolean;
	expiresAt: string | null;
	createdAt: string;
	lastActive: string;
}

type Prioridad = "alta" | "media" | "baja";
type TipoNotificacion =
	| "stock_bajo"
	| "sin_stock"
	| "transferencia"
	| "merma"
	| "venta"
	| "warning"
	| "error"
	| "info"
	| "success";

export interface Notification {
	id: string;
	title: string;
	message: string;
	type: TipoNotificacion; // "info" | "warning" | "error" | "success"
	prioridad: Prioridad;
	isRead: boolean;
	userId: string;
	createdAt: string;
	updatedAt: string;
}

export interface Almacen {
	almacenId: string;
	nombre: string;
	stockAlmacen: number;
	createdAt: string;
	updatedAt: string;
}

// === MODELOS ECONÓMICOS ===

export interface Empleado {
	empleadoId: string;
	nombre: string;
	apellido: string;
	telefono?: string;
	cargo: string;
	salarioBases: number;
	bonificaciones?: number;
	deducciones?: number;
	horasExtras?: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface Attendance {
	attendanceId: string;
	employeeId: string;
	employee?: {
		nombre: string;
		apellido: string;
		cargo: string;
	};
	date: Date;
	checkIn?: Date;
	checkOut?: Date;
	totalHours?: number;
	status: string;
	// Manual editing fields
	manualCheckIn?: Date;
	manualCheckOut?: Date;
	isManualEntry: boolean;
	notes?: string;
	// Working hours tracking
	scheduledHours?: number;
	overtimeHours?: number;
	breakHours?: number;
	// Approval workflow
	approvedBy?: string;
	approvedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface EmployeeWorkSchedule {
	scheduleId: string;
	employeeId: string;
	employee?: Empleado;
	dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
	startTime: string; // Format: "HH:MM"
	endTime: string; // Format: "HH:MM"
	breakStartTime?: string; // Format: "HH:MM"
	breakEndTime?: string; // Format: "HH:MM"
	isWorkingDay: boolean;
	scheduledHours: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface Pagosalario {
	pgId: string;
	empleadoId: string;
	salario: number;
	bonificaciones?: number;
	deducciones?: number;
	horasExtras?: number;
	observaciones?: string;
	periodo: string;
	createdAt: string;
	updatedAt: string;
	empleado?: Empleado;
}
export interface GastosCompra {
	id: string;
	productoNombre: string;
	vendor: {
		vendorId: string;
		nombre: string;
	};
	cantidad: number;
	precioUnitario: number;
	total: number;
	fechaCompra: string;
	descripcion: string;
	isRestock?: boolean;
	tipoOperacion?: "restock" | "regular";
}
export interface GastosDE {
	gastosDEId: string;
	tipo: string | null;
	conceptoId: string | null;
	elementoId: string | null;
	numeroFactura?: string | null;
	proveedor: string;
	monto: number;
	descripcion: string | null;
	periodo: string;
	isPagado: string;
	createdAt: Date;
	updatedAt: Date;
	concepto?: GastoConcepto | null;
	elemento?: GastoElemento | null;
}

export interface GastoConcepto {
	conceptoId: string;
	nombre: string;
	descripcion: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	elementos?: GastoElemento[];
}

export interface GastoElemento {
	elementoId: string;
	conceptoId: string;
	nombre: string;
	descripcion: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	concepto?: GastoConcepto;
}

export interface Servicios {
	servicioId: string;
	nombre: string;
	descripcion: string;
	precio: number;
	precioCosto?: number | null;
	precioVenta?: number | null;
	codigoInterno?: string | null;
	codigoNegocio?: string | null;
	proveedorCodigo?: string | null;
	idSeccionCodigo?: string | null;
	especificoCodigo?: string | null;
	surtidoCodigo?: string | null;
	dcCodigo?: string | null;
	categoriaId?: string | null;
	subcategoriaId?: string | null;
	unidadId?: string | null;
	vendorId?: string | null;
	activo?: boolean;
	deletedAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CompraServicio {
	compraServicioId: string;
	servicioId: string;
	proveedorId?: string | null;
	numeroFactura?: string | null;
	costoUnitario: number;
	cantidad: number;
	total: number;
	formaPago: "PAGO_PARCIAL" | "PAGO_COMPLETO";
	estado: "PENDIENTE" | "PAGADA";
	descripcion?: string | null;
	fechaServicio: string;
	fechaVencimiento?: string | null;
	createdAt: string;
	updatedAt: string;
	servicio?: Servicios;
	proveedor?: Vendor | null;
}
export interface Currency {
	id: string;
	code: string;
	name: string;
	rate: number; // Tasa respecto a USD como base
	symbol: string;
}

export interface ResumenData {
	periodo?: string;
	ingresos: number;
	gastos: number;
	utilidad: number;
	margen: number;
	ventasCount: number;
	empleadosCount: number;
	gastosCompra: number;
	gastosSalarios: number;
	gastosServicios: number;
	gastosMermas: number;
}
export interface DatosGrafico {
	mes?: string;
	ingresos: number;
	gastos: number;
	utilidad: number;
}

// === RESTOCK INTERFACES ===

export interface RestockRequest {
	productoId: string;
	cantidad: number;
	precioCosto?: number;
	precioVenta?: number;
	descripcion?: string;
	numeroFactura?: string;
	facturaUrl?: string;
	formaPago?: "PAGO_PARCIAL" | "PAGO_COMPLETO";
	estado?: "PENDIENTE" | "PAGADA";
	moneda?: string;
	tasaCambio?: number;
	montoConvertido?: number;
	monedaOriginal?: string;
	montoOriginal?: number;
	cuentaId?: string;
	tipoRestock?: "nueva_instancia" | "sumar_stock" | "auto";
}

export interface RestockResponse {
	success: boolean;
	producto: Producto;
	gastoCompra: GastosCompra;
	productInstance?: Producto; // New instance if prices changed
	weightedAverages: {
		precioCosto: number;
		precioVenta: number;
	};
}

export interface RestockHistory {
	fecha: string;
	cantidad: number;
	precioCostoAnterior: number;
	precioCostoNuevo: number;
	precioVentaAnterior: number;
	precioVentaNuevo: number;
	totalCompra: number;
}

export interface RestockHistoryItem {
	id: string;
	fecha: string;
	cantidad: number;
	precioCostoAnterior: number;
	precioCostoNuevo: number;
	precioVentaAnterior: number;
	precioVentaNuevo: number;
	totalCompra: number;
	descripcion: string | null;
	tipoOperacion:
		| "restock_same_prices"
		| "restock_new_instance"
		| "restock_price_change";
	productInstance?: {
		id: string;
		nombre: string;
		precioCosto: number;
		precioVenta: number;
	};
	vendor: {
		nombre: string;
		contacto: string | null;
	};
}

export interface RestockHistoryResponse {
	history: RestockHistoryItem[];
	pagination: {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		itemsPerPage: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
	summary: {
		totalRestocks: number;
		totalQuantityAdded: number;
		totalCostSpent: number;
		averageCostPerRestock: number;
		priceChanges: number;
	};
}

// === RESTOCK ERROR HANDLING ===

export interface RestockError {
	code: string;
	message: string;
	severity: "low" | "medium" | "high" | "critical";
	field?: string;
	details?: Record<string, any>;
	timestamp: string;
}

export interface RestockValidationError extends RestockError {
	field: string;
	value?: any;
	constraints?: string[];
}

export interface RestockBusinessError extends RestockError {
	context?: {
		productoId?: string;
		currentStock?: number;
		requestedQuantity?: number;
		maxAllowed?: number;
		userId?: string;
		currentPrices?: {
			cost: number;
			selling: number;
		};
	};
}

export interface RestockErrorResponse {
	success: false;
	error: RestockError;
	errors?: RestockError[];
	requestId?: string;
}

export interface Cliente {
	clienteId: string;
	nombre: string;
	email?: string | null;
	direccion?: string | null;
	telefono?: string | null;
	numeroCuentaCUP?: string;
	numeroCuentaUSD?: string;
	numeroContrato?: string;
	logoUrl?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

// === CONTABILIDAD MODELS ===

export interface CuentaBancaria {
	cuentaId: string;
	nombreBanco: string;
	numeroCuenta: string;
	tipoCuenta: string;
	saldo: number;
	moneda: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface Moneda {
	codigo: string;
	nombre: string;
	simbolo: string;
	esPrincipal: boolean;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface TasaCambio {
	tasaId: string;
	monedaOrigenId: string;
	monedaDestino: string;
	tasa: number;
	fechaVigencia: string;
	creadoPor: string;
	createdAt: string;
	updatedAt: string;
	monedaOrigen?: Moneda;
}

export interface TransaccionMoneda {
	transaccionId: string;
	tipoTransaccion: string;
	referenciaId: string;
	monedaId: string;
	montoOriginal: number;
	tasaCambio: number;
	montoConvertido: number;
	createdAt: string;
	updatedAt: string;
	moneda?: Moneda;
}

export interface ReconciliacionVenta {
	reconciliacionId: string;
	ventaId: string;
	tipoReconciliacion?: string;
	cuentaId: string;
	tipoPagoId: string;
	monto: number;
	moneda: string;
	tasaCambio?: number;
	montoConvertido?: number;
	fechaReconciliacion: string;
	observaciones?: string;
	reconciliadoPor: string;
	idTransferencia?: string;
	createdAt: string;
	updatedAt: string;
	venta?: Venta;
	cuentaBancaria?: CuentaBancaria;
	tipoPago?: TipoPago;
}

export interface ReconciliacionServicio {
	reconciliacionId: string;
	ventaServicioId: string;
	cuentaId: string;
	tipoPagoId: string;
	monto: number;
	moneda: string;
	tasaCambio?: number;
	montoConvertido?: number;
	fechaReconciliacion: string;
	observaciones?: string;
	reconciliadoPor: string;
	createdAt: string;
	updatedAt: string;
	servicio?: {
		servicioId: string;
	}; // Will be defined when Servicios interface is available
	cuentaBancaria?: CuentaBancaria;
	tipoPago?: TipoPago;
}

export interface ReconciliacionGasto {
	reconciliacionId: string;
	tipoGasto: string;
	referenciaId: string;
	cuentaId: string;
	tipoPagoId: string;
	monto: number;
	moneda: string;
	tasaCambio?: number;
	montoConvertido?: number;
	descripcion: string;
	periodo?: string;
	fechaReconciliacion: string;
	observaciones?: string;
	reconciliadoPor: string;
	estado: "PENDIENTE" | "PAGADA" | "PARCIAL";
	cuentaPorPagarId?: string;
	createdAt: string;
	updatedAt: string;
	cuentaBancaria?: CuentaBancaria;
	tipoPago?: TipoPago;
}

export interface TipoPago {
	tipoId: string;
	nombre: string;
	descripcion?: string;
	requiereCuenta: boolean;
	cuentaDefecto?: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export type TipoAnticipo = "PAGO" | "COBRO";
export type EstadoAnticipo = "RESERVADO" | "EJECUTADO" | "ANULADO";
export type FormaPagoAnticipo = "ANTICIPO_PAGO" | "ANTICIPO_COBRO";
export type ContextoAnticipo =
	| "COMPRA_PRODUCTO"
	| "COMPRA_SERVICIO"
	| "FACTURA_OFERTA"
	| "FACTURA_DIRECTA";
export type TipoMovimientoAnticipo =
	| "CREACION_RESERVA"
	| "EJECUCION"
	| "REVERSO"
	| "ANULACION";

export interface AnticipoMovimiento {
	movimientoId: string;
	anticipoId: string;
	tipoMovimiento: TipoMovimientoAnticipo;
	contexto?: ContextoAnticipo;
	documentoDestinoId?: string;
	reconciliacionVentaId?: string;
	reconciliacionGastoId?: string;
	monto: number;
	moneda: string;
	tasaAplicada?: number;
	montoConvertido?: number;
	saldoAntes: number;
	saldoDespues: number;
	usuarioId: string;
	idempotencyKey?: string;
	observaciones?: string;
	createdAt: string;
}

export interface Anticipo {
	anticipoId: string;
	tipo: TipoAnticipo;
	estado: EstadoAnticipo;
	montoOriginal: number;
	saldoDisponible: number;
	moneda: string;
	contratoId: string;
	proveedorId?: string;
	clienteId?: string;
	cuentaOrigenId?: string;
	tipoPagoOrigenId?: string;
	referenciaExterna?: string;
	vigenciaHasta?: string;
	fechaReserva: string;
	fechaEjecucion?: string;
	createdById: string;
	createdAt: string;
	updatedAt: string;
	movimientos?: AnticipoMovimiento[];
}

export interface CreateAnticipoRequest {
	tipo: TipoAnticipo;
	contratoId: string;
	proveedorId?: string;
	clienteId?: string;
	monto: number;
	moneda: string;
	cuentaOrigenId?: string;
	tipoPagoOrigenId?: string;
	referenciaExterna?: string;
	vigenciaHasta?: string;
}

export interface ExecuteAnticipoRequest {
	contexto: ContextoAnticipo;
	documentoDestinoId: string;
	montoObjetivo: number;
	monedaObjetivo: string;
	tasaAplicada?: number;
	idempotencyKey: string;
	observaciones?: string;
	permitirParcial?: boolean;
}

export interface ExecuteAnticipoResponse {
	anticipoId: string;
	estado: EstadoAnticipo;
	saldoDisponible: number;
	movimientoId: string;
	idempotentReplay: boolean;
}

export interface TransferenciaBancaria {
	transferenciaId: string;
	numeroComprobante: string;
	cuentaOrigenId: string;
	cuentaDestinoId: string;
	montoOrigen: number;
	monedaOrigen: string;
	montoDestino: number;
	monedaDestino: string;
	tasaCambio?: number;
	motivo: string;
	descripcion?: string;
	realizadoPor: string;
	fechaTransferencia: string;
	comprobanteGenerado: boolean;
	rutaComprobante?: string;
	createdAt: string;
	updatedAt: string;
	cuentaOrigen?: CuentaBancaria;
	cuentaDestino?: CuentaBancaria;
}

export interface AjusteBancario {
	ajusteId: string;
	cuentaId: string;
	tipo: string;
	monto: number;
	moneda: string;
	tasaCambio?: number;
	montoConvertido?: number;
	descripcion: string;
	motivo: string;
	realizadoPor: string;
	createdAt: string;
	updatedAt: string;
	cuentaBancaria?: CuentaBancaria;
}

// Request/Response types for contabilidad operations
export interface CreateCuentaBancariaRequest {
	nombreBanco: string;
	numeroCuenta: string;
	tipoCuenta: string;
	saldo: number;
	moneda: string;
}

export interface UpdateCuentaBancariaRequest {
	nombreBanco?: string;
	tipoCuenta?: string;
	saldo?: number;
	moneda?: string;
	isActive?: boolean;
}

export interface ReconciliarVentaRequest {
	ventaId: string;
	cuentaId: string;
	tipoPagoId: string;
	monto: number;
	moneda: string;
	tasaCambio?: number;
	observaciones?: string;
	verificacionTransferenciaId?: string;
	idTransferencia?: string;
}

export interface ReconciliarServicioRequest {
	ventaServicioId: string;
	cuentaId: string;
	tipoPagoId: string;
	monto: number;
	moneda: string;
	tasaCambio?: number;
	observaciones?: string;
}

export interface ReconciliarGastoRequest {
	tipoGasto: string;
	referenciaId?: string;
	pgId?: string;
	gastosDEId?: string;
	gastoCompraId?: string;
	cuentaId?: string;
	tipoPagoId?: string;
	monto: number;
	moneda: string;
	tasaCambio?: number;
	descripcion: string;
	periodo?: string;
	observaciones?: string;
	estado?: "PENDIENTE" | "PAGADA" | "PARCIAL";
	cuentaPorPagarId?: string;
	distribucion?: {
		cuentaId: string;
		monto: number;
		porcentaje?: number;
	}[];
}

export interface CreateTransferenciaBancariaRequest {
	cuentaOrigenId: string;
	cuentaDestinoId: string;
	montoOrigen: number;
	monedaOrigen: string;
	montoDestino: number;
	monedaDestino: string;
	tasaCambio?: number;
	motivo: string;
	descripcion?: string;
}

export interface CreateAjusteBancarioRequest {
	cuentaId: string;
	tipo: string;
	monto: number;
	moneda: string;
	descripcion: string;
	motivo: string;
}

export interface CreateMonedaRequest {
	codigo: string;
	nombre: string;
	simbolo: string;
	esPrincipal?: boolean;
}

export interface UpdateTasaCambioRequest {
	monedaOrigenId: string;
	monedaDestino: string;
	tasa: number;
}

export interface ConvertirMonedaRequest {
	monto: number;
	monedaOrigen: string;
	monedaDestino: string;
	tasa?: number;
}

export interface ConvertirMonedaResponse {
	montoOriginal: number;
	monedaOrigen: string;
	montoConvertido: number;
	monedaDestino: string;
	tasaUtilizada: number;
	fechaConversion: string;
}

// Pending items for reconciliation
export interface VentaPendiente extends Venta {
	reconciliada: boolean;
	montoTotal: number;
	saldoPendiente?: number;
	totalReconciliado?: number;
	esCuentaPorCobrar?: boolean;
	cuentaPorCobrarId?: string;
	moneda?: string;
}

export interface ServicioPendiente extends VentaServicio {
	reconciliada: boolean;
	montoTotal: number;
}

export interface VentaServicio {
	ventaServicioId?: string;
	servicio: {
		servicioId: string;
		descripcion: string;
		precio: number;
		fechaServicio: Date;
		moneda: string;
	};
	reconciliaciones?: ReconciliacionServicio[];
	cantidad: number;
	costo: number;
	total: number;
	observaciones: string | null;
	cliente: {
		clienteId: string;
		nombre: string;
	};
	createdAt: string;
	updatedAt: string;
}

export interface GastoPendiente {
	tipo: "salario" | "gastoDE" | "compra" | "servicio" | "venta_servicio";
	referenciaId: string;
	descripcion: string;
	monto: number;
	periodo?: string;
	reconciliado: boolean;
	detalles: {
		empleado?: {
			nombre: string;
			apellido: string;
			cargo: string;
		};
		salarioBases?: number;
		bonificaciones?: number;
		deducciones?: number;
		horasExtras?: number;
		tipo?: string;
		proveedor?: string;
		descripcionOriginal?: string;
		isPagado?: string;
		producto?: string;
		vendor?: string;
		cantidad?: number;
		precioUnitario?: number;
		fechaCompra?: string;
		servicio?: string;
		proveedorNombre?: string;
		costoUnitario?: number;
		numeroFactura?: string;
	};
	createdAt: string;
	updatedAt: string;
}

// Financial summary and reports
export interface ResumenFinanciero {
	cuentasBancarias: CuentaBancaria[];
	estadisticas: {
		periodo: {
			fechaInicio: string;
			fechaFin: string;
		};
		totalAjustes: number;
		totalCuentas: number;
		totalReconciliaciones: number;
		totalTransferencias: number;
	};
	resumenPorMoneda: ResumenPorMoneda[];
}

export interface ResumenPorMoneda {
	moneda: string;
	saldoActual: number;
	totalIngresos: number;
	totalEgresos: number;
	flujoNeto: number;
	desglose: {
		ingresos: {
			ventas: number;
			servicios: number;
			ajustes: number;
			inyecciones: InyeccionCapital[];
		};
	};
	egresos: {
		gastos: number;
		ajustes: number;
	};
}

export interface Inyecciones {
	tipo: "CAPITAL_SOCIAL" | "DEUDA_EXTERNA";
	montoRecibido: number;
	moneda: string;
	cuentaId: string;
	descripcion?: string;
	socio?: string;
	entidadPrestamista?: string;
	tasaInteres?: number;
	plazoMeses?: number;
	fechaInicioPago?: string;
}

export interface MovimientoBancario {
	id: string;
	tipo: string;
	descripcion: string;
	monto: number;
	moneda: string;
	cuentaId: string;
	fecha: string;
	saldoAnterior: number;
	saldoNuevo: number;
	referencia?: string;
	cuentaBancaria?: CuentaBancaria;
}

export interface ReporteExchange {
	periodo: string;
	conversionesTotales: number;
	montoTotalConvertido: number;
	tasasUtilizadas: {
		monedaOrigen: string;
		monedaDestino: string;
		tasaPromedio: number;
		numeroConversiones: number;
		montoTotal: number;
	}[];
	impactoEnSaldos: {
		cuentaId: string;
		nombreCuenta: string;
		diferenciaPorTasa: number;
		moneda: string;
	}[];
}

export interface ReporteTransferencias {
	periodo: string;
	totalTransferencias: number;
	montoTotalTransferido: number;
	transferenciasEntreMonedas: number;
	cuentasMasActivas: {
		cuentaId: string;
		nombreCuenta: string;
		numeroTransferencias: number;
		montoTotal: number;
	}[];
	comprobantesGenerados: number;
} // Payment types request/response types
export interface CreateTipoPagoRequest {
	nombre: string;
	descripcion?: string;
	requiereCuenta: boolean;
	cuentaDefecto?: string;
	isActive?: boolean;
}

export interface UpdateTipoPagoRequest {
	nombre?: string;
	descripcion?: string;
	requiereCuenta?: boolean;
	cuentaDefecto?: string;
	isActive?: boolean;
}

export interface TipoPagoWithDetails extends TipoPago {
	cuentaDefectoInfo?: {
		cuentaId: string;
		nombreBanco: string;
		numeroCuenta: string;
		tipoCuenta: string;
		moneda: string;
		isActive: boolean;
	};
	_count?: {
		reconciliacionesVenta: number;
		reconciliacionesServicio: number;
		reconciliacionesGasto: number;
	};
}
export interface TransaccionesHistory {
	transaccionId: string;
	fecha: string;
	tipoMovimiento: string;
	descripcion: string;
	observaciones?: string;
	monedaOriginal: string;
	montoOriginal: number;
	tasaCambio?: number;
	saldoDespues?: number;
	esIngreso: boolean;
	detalles?: {
		tipoPago: string;
		venta: {
			cantidad: number;
			empleadoId: string;
			observaciones: string;
			ordenId: string;
			productoId: string;
			puntoDeVentaId: string;
			serviciosId: string;
			total: number;
			updatedAt: Date;
			ventaId: string;
		};
	};
}

export interface OfertaItem {
	id: string;
	ofertaId: string;
	productoId?: string;
	servicioId?: string;
	cantidad: number;
	precioUnitario: number;
	total: number;
	producto?: Producto;
	servicio?: Servicios;
}

export interface Oferta {
	id: string;
	numeroOferta: string;
	clienteId: string;
	fechaEmision: string;
	fechaVencimiento: string | null;
	estado: "PENDIENTE" | "ACEPTADA" | "RECHAZADA" | "FACTURADA";
	subtotal: number;
	impuestos: number;
	total: number;
	observaciones: string | null;
	items: OfertaItem[];
	ventaId?: string;
	venta?: Venta;
	cliente?: Cliente;
	createdAt: string;
	updatedAt: string;
}

export interface CuentaPorCobrar {
	id: string;
	idCC: number;
	facturaId?: string;
	numeroFactura?: string;
	clienteId: string;
	montoDeuda: number;
	montoPagado: number;
	idTransferencia?: string;
	estado: "PENDIENTE" | "PAGADA" | "PARCIAL";
	tipoCuenta?: "VENTA" | "PRESTAMO_CASH";
	fechaVencimiento?: string | null;
	totalVenta?: number;
	totalFactura?: number;
	totalPagadoFactura?: number;
	saldoFactura?: number;
	cliente?: Cliente;
	factura?: Factura;
	_reconciliaciones?: any[];
	prestamoCash?: {
		id: string;
		idNumerico: number;
		montoCapital: number;
		moneda: string;
		tasaCambioAlCrear?: number | null;
		observaciones?: string | null;
	};
	createdAt: string;
	updatedAt: string;
}

// === CASH LOANS & DEBTS ===

export type EstadoPrestamoCash = "ACTIVO" | "PAGADO" | "VENCIDO" | "CANCELADO";

export interface PrestamoCash {
	id: string;
	idNumerico: number;
	clienteId: string;
	cuentaPorCobrarId: string;
	montoCapital: number;
	moneda: string;
	tasaInteres?: number | null;
	fechaOtorgamiento: string;
	fechaVencimiento?: string | null;
	estado: EstadoPrestamoCash;
	observaciones?: string | null;
	createdById: string;
	deletedAt?: string | null;
	createdAt: string;
	updatedAt: string;
	cliente?: Cliente;
	cuentaPorCobrar?: CuentaPorCobrar;
}

export interface HistorialPrestamoCashItem {
	id: string;
	fecha: string;
	monto: number;
	moneda: string;
	tasaCambio?: number | null;
	montoConvertido?: number | null;
	observaciones?: string | null;
	tipoPago: string;
	cuentaBancaria: string;
}

export interface HistorialPrestamoCashResponse {
	prestamo: PrestamoCash;
	resumen: {
		montoCapital: number;
		totalDeuda: number;
		montoPagado: number;
		saldoPendiente: number;
		cantidadPagos: number;
	};
	historial: HistorialPrestamoCashItem[];
}

export interface PrestamosCashStats {
	totalActivos: number;
	totalPagados: number;
	totalVencidos: number;
	montoTotalPrestado: Record<string, number>;
	montoPendienteCobro: Record<string, number>;
	resumenMovimientos?: {
		totalPagos: number;
		promedioPago: number;
	};
}

export interface DeudaCash {
	id: string;
	idNumerico: number;
	proveedorId: string;
	cuentaPorPagarId: string;
	montoCapital: number;
	moneda: string;
	tasaInteres?: number | null;
	fechaOtorgamiento: string;
	fechaVencimiento?: string | null;
	estado: EstadoPrestamoCash;
	observaciones?: string | null;
	createdById: string;
	deletedAt?: string | null;
	createdAt: string;
	updatedAt: string;
	proveedor?: Vendor;
	cuentaPorPagar?: CuentaPorPagar;
}

export interface CreatePrestamoCashRequest {
	clienteId: string;
	montoCapital: number;
	moneda?: string;
	tasaInteres?: number;
	tasaCambioAlCrear?: number;
	fechaVencimiento?: string;
	observaciones?: string;
	cuentaBancariaId: string;
}

export interface UpdatePrestamoCashRequest {
	fechaVencimiento?: string;
	tasaInteres?: number;
	observaciones?: string;
}

export interface RegistrarPagoPrestamoRequest {
	monto: number;
	cuentaId: string;
	tipoPagoId: string;
	moneda?: string;
	tasaCambio?: number;
	observaciones?: string;
}

export interface CreateDeudaCashRequest {
	proveedorId: string;
	montoCapital: number;
	moneda?: string;
	tasaInteres?: number;
	fechaVencimiento?: string;
	observaciones?: string;
	comprobanteUrl?: string;
	cuentaBancariaId: string;
}

export interface UpdateDeudaCashRequest {
	fechaVencimiento?: string;
	tasaInteres?: number;
	observaciones?: string;
}

export interface RegistrarPagoDeudaRequest {
	monto: number;
	cuentaId: string;
	tipoPagoId: string;
	moneda?: string;
	tasaCambio?: number;
	observaciones?: string;
}

export interface DeudasCashStats {
	totalActivas: number;
	totalPagadas: number;
	totalVencidas: number;
	montoTotalDeuda: Record<string, number>;
	montoPendientePago: Record<string, number>;
}

export interface CreateCuentaPorCobrarRequest {
	clienteId: string;
	montoDeuda: number;
	facturaId?: string;
	fechaVencimiento?: string;
	estado?: "PENDIENTE" | "PAGADA" | "PARCIAL";
}

export interface SerieFacturacion {
	serieId: string;
	prefijo: string;
	descripcion: string;
	consecutivo: number;
	activa: boolean;
	esPorDefecto: boolean;
	facturas?: Factura[];
	createdAt: string;
	updatedAt: string;
}

export type TipoDocumento =
	| "FACTURA"
	| "NOTA_CREDITO"
	| "FACTURA_RECTIFICATIVA"
	| "PROFORMA";

export interface Factura {
	idFactura: string;
	numeroConsecutivo: number;
	numeroFactura: string;
	tipoDocumento: TipoDocumento;
	serieId: string;
	ventaId?: string;
	clienteId: string;
	subtotal: number;
	impuestos: number;
	descuento: number;
	total: number;
	observaciones?: string;
	terminosPago?: string;
	metodoPago?: string;
	estado: "PENDIENTE" | "PAGADA" | "ANULADA" | "VENCIDA";
	fechaEmision: string;
	fechaVencimiento?: string;
	creadoPor: string;
	actualizadoPor?: string;
	serie?: SerieFacturacion;
	venta?: Venta;
	cliente?: Cliente;
	cuentaPorCobrar?: CuentaPorCobrar;
	createdAt: string;
	updatedAt: string;
}

// === INYECCION DE CAPITAL ===

export interface InyeccionCapital {
	id: string;
	tipo: "CAPITAL_SOCIAL" | "DEUDA_EXTERNA";
	montoRecibido: number;
	moneda: string;

	tasaInteres?: number;
	montoInteres?: number;
	montoTotalDeuda?: number;
	saldoPendiente?: number;
	plazoMeses?: number;
	fechaInicioPago?: string;

	socio?: string;
	entidadPrestamista?: string;

	cuentaId: string;
	cuentaBancaria?: {
		nombreBanco: string;
		numeroCuenta: string;
		moneda: string;
	};

	estado?: "ACTIVA" | "PAGADA" | "EN_MORA";

	pagos?: PagoDeuda[];

	descripcion?: string;
	fechaRegistro: string;
	createdAt: string;
	updatedAt: string;
}

export interface PagoDeuda {
	id: string;
	inyeccionId: string;
	montoPagado: number;
	fechaPago: string;
	cuentaId: string;
	numeroCuota?: number;
	comprobante?: string;
	observaciones?: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateInyeccionCapitalRequest {
	tipo: "CAPITAL_SOCIAL" | "DEUDA_EXTERNA";
	montoRecibido: number;
	moneda: string;
	cuentaId: string;
	descripcion?: string;
	socio?: string;
	entidadPrestamista?: string;
	tasaInteres?: number;
	plazoMeses?: number;
	fechaInicioPago?: string;
}

export interface CreatePagoDeudaRequest {
	montoPagado: number;
	cuentaId: string;
	comprobante?: string;
	observaciones?: string;
}

// === REPARACIONES ===

export interface EquipoReparacion {
	id: string;
	nombre: string;
	descripcion: string | null;
	piezas?: PiezaReparacion[];
	createdAt: string;
	updatedAt: string;
}

export interface PiezaReparacion {
	id: string;
	nombre: string;
	equipoId: string;
	costoPequeno: number;
	costoMediano: number;
	costoGrande: number;
	createdAt: string;
	updatedAt: string;
	equipo?: EquipoReparacion;
}

export type EstadoOrden =
	| "RECIBIDO"
	| "EN_DIAGNOSTICO"
	| "ESPERANDO_APROBACION"
	| "EN_REPARACION"
	| "ESPERANDO_REPUESTOS"
	| "TERMINADO"
	| "ENTREGADO"
	| "CANCELADO";
// Nota: simplificamos la nomenclatura de complejidad para defectos
// y definimos como: SENCILLA, MEDIANA, COMPLEJA
export type ComplejidadReparacion = "PEQUENO" | "MEDIANO" | "GRANDE";

export interface OrdenReparacion {
	id: string;
	numeroOrden: number;

	clienteId: string;
	cliente?: Cliente;

	equipoTipoId: string;
	equipoTipo?: EquipoReparacion;

	marca: string;
	modelo: string | null;
	numeroSerie: string | null;
	contrasena: string | null;
	accesorios: string | null;
	fotos: string[];

	problemaReportado: string;
	diagnosticoTecnico: string | null;

	estado: EstadoOrden;
	prioridad: string;
	complejidad?: ComplejidadReparacion | null;
	esGarantia: boolean;

	fechaRecepcion: string;
	fechaEstimada: string | null;
	fechaEntrega: string | null;

	tecnicoId: string | null;
	tecnico?: Empleado;

	equipos?: OrdenReparacionEquipo[];
	items?: OrdenReparacionItem[];
	materiales?: OrdenReparacionMaterial[];
	recibos?: ReciboOrdenReparacion[];

	subtotal: number;
	descuento: number;
	total: number;

	ventaId: string | null;
	venta?: Venta;

	createdAt: string;
	updatedAt: string;
}

export interface ReciboOrdenReparacion {
	id: string;
	numeroRecibo: number;
	ordenId: string;
	clienteNombre: string;
	equipoInfo: string;
	problema: string;
	fechaRecepcion: string;
	estadoInicial: string;
	fotosIniciales: string[];
	observaciones?: string;
	createdAt: string;
	updatedAt: string;
	orden?: OrdenReparacion;
}

export interface OrdenReparacionEquipo {
	id: string;
	ordenId: string;
	equipoTipoId: string;
	equipoTipo?: EquipoReparacion;
	marca: string;
	modelo: string | null;
	numeroSerie: string | null;
	contrasena: string | null;
	accesorios: string | null;
	fotos: string[];
	problemaReportado: string;
	createdAt: string;
	updatedAt: string;
}

export interface DefectacionCatalogo {
	id: string;
	defecto: string;
	costo: number;
	createdAt: string;
	updatedAt: string;
}

export interface OrdenReparacionItem {
	id: string;
	ordenId: string;
	ordenEquipoId?: string | null;
	ordenEquipo?: OrdenReparacionEquipo | null;
	piezaId?: string | null;
	pieza?: PiezaReparacion;
	complejidad?: ComplejidadReparacion | null;
	defectacionId?: string | null;
	defectacion?: DefectacionCatalogo;
	precio: number;
	observaciones: string | null;
	tecnicoId: string | null;
}

export interface OrdenReparacionMaterial {
	id: string;
	ordenId: string;
	productoId: string;
	producto?: Producto;
	cantidad: number;
	precioUnitario: number;
	total: number;
}

export interface FacturarOrdenResponse {
	success?: boolean;
	facturaId?: string;
	total?: number;
}

export interface AuditLog {}

// ============================================
// TIPOS DE PRODUCCIÓN
// ============================================

// Enum para estados de orden de producción
export type EstadoProduccion =
	| "PENDIENTE"
	| "EN_PROCESO"
	| "COMPLETADA"
	| "CANCELADA";

// Enum para estados de vale de salida
export type EstadoValeSalida = "PENDIENTE" | "COMPLETADA" | "ANULADA";

// Ingrediente de receta para producción
export interface RecetaProduccionIngrediente {
	recetaIngredienteId: string;
	recetaId: string;
	productoId: string;
	cantidad: number;
	unidadSimbolo?: string | null;
	desperdicio: number;
	createdAt: string;
	updatedAt: string;
	producto?: Producto;
}

// Receta para producción de productos
export interface RecetaProduccion {
	recetaId: string;
	nombre: string;
	rendimiento: number;
	costoUnitario: number;
	instrucciones: string | null;
	tiempoPrep: number | null;
	productoId: string | null;
	createdAt: string;
	updatedAt: string;
	producto?: Producto | null;
	ingredientes: RecetaProduccionIngrediente[];
}

export interface UnitNormalization {
	productoId: string;
	productoNombre: string;
	providedUnit: string | null;
	canonicalUnit: string | null;
	originalCantidad: number;
	normalizedCantidad: number;
}

export interface UnitError {
	productoId: string;
	productoNombre: string | null;
	providedUnit: string | null;
	canonicalUnit: string | null;
	reason:
		| "incompatible_category"
		| "missing_unit"
		| "unknown_unit"
		| "missing_product";
}

// Orden de producción
export interface OrdenProduccion {
	ordenProduccionId: string;
	recetaId: string;
	cantidad: number;
	estado: EstadoProduccion;
	observaciones: string | null;
	fechaProduccion: string;
	costoMateriales: number | null;
	createdAt: string;
	updatedAt: string;
	receta?: RecetaProduccion;
}

// Historial de estados de orden de producción
export interface OrdenProduccionHistorial {
	historialId: string;
	ordenProduccionId: string;
	estadoAnterior: string | null;
	estadoNuevo: string;
	observaciones: string | null;
	usuarioId: string;
	createdAt: string;
}

// Item de vale de salida
export interface ValeSalidaItem {
	valeSalidaItemId: string;
	valeSalidaId: string;
	productoId: string;
	cantidad: number;
	createdAt: string;
	updatedAt: string;
	producto?: Producto;
}

// Vale de salida
export interface ValeSalida {
	valeSalidaId: string;
	concepto: string;
	observaciones: string | null;
	estado: EstadoValeSalida;
	createdAt: string;
	updatedAt: string;
	usuarioId: string;
	items: ValeSalidaItem[];
}

// Payload para crear vale de salida
export interface CreateValeSalidaPayload {
	concepto: string;
	observaciones?: string;
	items: Array<{
		productoId: string;
		cantidad: number;
	}>;
}

// Payload para crear orden de producción
export interface PaginationMeta {
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface OrdenesPaginationMeta extends PaginationMeta {
	stats: {
		pendientes: number;
		enProceso: number;
		completadas: number;
	};
}

export interface PaginatedResponse<T, M = PaginationMeta> {
	data: T[];
	meta: M;
}

export interface CreateOrdenProduccionPayload {
	recetaId: string;
	cantidad: number;
	observaciones?: string;
	fechaProduccion?: string;
}

// Respuesta de setIngredientes — extiende RecetaProduccion con contratos explícitos de unidades
export interface SetIngredientesResponse extends RecetaProduccion {
	unitNormalizations?: UnitNormalization[];
	unitErrors?: UnitError[];
}

// Payload para crear receta de producción
export interface CreateRecetaProduccionPayload {
	nombre: string;
	rendimiento: number;
	productoId?: string;
	instrucciones?: string;
	tiempoPrep?: number;
}

// Payload para setear ingredientes de receta
export interface SetIngredientesPayload {
	recetaId: string;
	ingredientes: Array<{
		productoId: string;
		cantidad: number;
		unidadSimbolo?: string | null;
		desperdicio?: number;
	}>;
}
