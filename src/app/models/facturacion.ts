import type { Venta } from './ventas';
import type { Cliente, CuentaPorCobrar } from './clientes';

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
