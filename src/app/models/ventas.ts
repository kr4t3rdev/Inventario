import type { Vendor, GastosDE, GastosCompra } from './economicos';
import type { Producto } from './productos';
import type { Oferta } from './ofertas';
import type { Factura } from './facturacion';
import type { ReconciliacionVenta } from './contabilidad';
import type { PuntoDeVenta } from './punto-venta';
import type { DeudaCash } from './prestamos-cash';

export type TipoNotificacion = "info" | "warning" | "error" | "success";
export type Prioridad = "baja" | "media" | "alta" | "urgente";

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
	/** Ciclo de vida del pedido (PVE): PEDIDO | ENTREGADA | FACTURADA | ANULADA. */
	estado?: string;
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
	creadoPorId?: string | null;
	creadoPor?: {
		userId: string;
		name: string | null;
	} | null;
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
	/** Unidades confirmadas al recibir; ausente = recepción total (B-01). */
	cantidadRecibida?: number | null;
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

export type TransferenciaWithDetails = Omit<Transferencia, 'origen' | 'destino' | 'producto'> & {
	producto: Producto;
	origen: PuntoDeVenta;
	destino: PuntoDeVenta;
};

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
	| "APROBADA"
	| "EN_TRANSITO"
	| "COMPLETADA"
	| "RECHAZADA"
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
	tenantId?: string | null;
	isActive: boolean;
	avatar: string | null;
	activatedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
	updatedAt: string;
	onboardingStatus?: string | null;
	onboardingType?: string | null;
	planFeatures?: Record<string, boolean> | null;
	planName?: string | null;
	permissions?: string[] | null;

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

export interface Notification {
	id: string;
	title: string;
	message: string;
	link?: string | null;
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
