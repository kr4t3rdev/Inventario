import type { Cliente, CuentaPorCobrar } from './clientes';
import type { Vendor } from './economicos';
import type { CuentaPorPagar } from './ventas';

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

