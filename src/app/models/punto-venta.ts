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

