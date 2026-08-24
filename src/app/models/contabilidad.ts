import type { Venta } from "./ventas";
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
	fechaOperacion: string;
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
	tasaCambio?: number;
	descripcion: string;
	motivo: string;
	fechaOperacion?: string;
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
