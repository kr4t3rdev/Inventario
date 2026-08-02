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
export interface CuentaPorCobrar {
	id: string;
	idCC: number;
	facturaId?: string;
	numeroFactura?: string;
	clienteId: string;
	montoDeuda: number;
	montoPagado: number;
	idTransferencia?: string;
	estado: "PENDIENTE" | "PAGADA" | "PARCIAL" | "ANULADA";
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
export interface CreateCuentaPorCobrarRequest {
	clienteId: string;
	montoDeuda: number;
	facturaId?: string;
	fechaVencimiento?: string;
	estado?: "PENDIENTE" | "PAGADA" | "PARCIAL";
}
