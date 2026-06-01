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
