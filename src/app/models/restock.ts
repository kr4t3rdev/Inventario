import type { Producto } from './productos';
import type { GastosCompra } from './economicos';

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

