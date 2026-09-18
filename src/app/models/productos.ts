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
	tenantId: string;
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
	moneda: "CUP" | "USD" | "EUR" | "MLC";
	estado: "PENDIENTE" | "PAGADA" | "ANULADA";
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

