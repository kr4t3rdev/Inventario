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


