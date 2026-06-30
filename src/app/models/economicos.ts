export interface Empleado {
	empleadoId: string;
	nombre: string;
	apellido: string;
	/** Puede ser null en la BD (campo opcional) */
	telefono?: string | null;
	cargo: string;
	salarioBases: number;
	bonificaciones?: number;
	deducciones?: number;
	horasExtras?: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface Vendor {
	vendorId: string;
	nombre: string;
	contacto?: string | null;
	email?: string | null;
	telefono?: string | null;
	direccion?: string | null;
	notas?: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface Attendance {
	attendanceId: string;
	employeeId: string;
	employee?: {
		nombre: string;
		apellido: string;
		cargo: string;
	};
	date: Date;
	checkIn?: Date;
	checkOut?: Date;
	totalHours?: number;
	status: string;
	// Manual editing fields
	manualCheckIn?: Date;
	manualCheckOut?: Date;
	isManualEntry: boolean;
	notes?: string;
	// Working hours tracking
	scheduledHours?: number;
	overtimeHours?: number;
	breakHours?: number;
	// Approval workflow
	approvedBy?: string;
	approvedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface EmployeeWorkSchedule {
	scheduleId: string;
	employeeId: string;
	employee?: Empleado;
	dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
	startTime: string; // Format: "HH:MM"
	endTime: string; // Format: "HH:MM"
	breakStartTime?: string; // Format: "HH:MM"
	breakEndTime?: string; // Format: "HH:MM"
	isWorkingDay: boolean;
	scheduledHours: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface Pagosalario {
	pgId: string;
	empleadoId: string;
	salario: number;
	bonificaciones?: number;
	deducciones?: number;
	horasExtras?: number;
	observaciones?: string;
	periodo: string;
	createdAt: string;
	updatedAt: string;
	empleado?: Empleado;
}
export interface GastosCompra {
	id: string;
	productoNombre: string;
	vendor: {
		vendorId: string;
		nombre: string;
	};
	cantidad: number;
	precioUnitario: number;
	total: number;
	fechaCompra: string;
	descripcion: string;
	isRestock?: boolean;
	tipoOperacion?: "restock" | "regular";
}
export interface GastosDE {
	gastosDEId: string;
	tipo: string | null;
	conceptoId: string | null;
	elementoId: string | null;
	numeroFactura?: string | null;
	proveedor: string;
	monto: number;
	descripcion: string | null;
	periodo: string;
	isPagado: string;
	createdAt: Date;
	updatedAt: Date;
	concepto?: GastoConcepto | null;
	elemento?: GastoElemento | null;
}

export interface GastoConcepto {
	conceptoId: string;
	nombre: string;
	descripcion: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	elementos?: GastoElemento[];
}

export interface GastoElemento {
	elementoId: string;
	conceptoId: string;
	nombre: string;
	descripcion: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	concepto?: GastoConcepto;
}

export interface Servicios {
	servicioId: string;
	nombre: string;
	descripcion: string;
	precio: number;
	precioCosto?: number | null;
	precioVenta?: number | null;
	codigoInterno?: string | null;
	codigoNegocio?: string | null;
	proveedorCodigo?: string | null;
	idSeccionCodigo?: string | null;
	especificoCodigo?: string | null;
	surtidoCodigo?: string | null;
	dcCodigo?: string | null;
	categoriaId?: string | null;
	subcategoriaId?: string | null;
	unidadId?: string | null;
	vendorId?: string | null;
	activo?: boolean;
	deletedAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CompraServicio {
	compraServicioId: string;
	servicioId: string;
	proveedorId?: string | null;
	numeroFactura?: string | null;
	costoUnitario: number;
	cantidad: number;
	total: number;
	moneda?: string | null;
	formaPago: "PAGO_PARCIAL" | "PAGO_COMPLETO";
	estado: "PENDIENTE" | "PAGADA";
	descripcion?: string | null;
	fechaServicio: string;
	fechaVencimiento?: string | null;
	createdAt: string;
	updatedAt: string;
	servicio?: Servicios;
	proveedor?: Vendor | null;
}
export interface Currency {
	id: string;
	code: string;
	name: string;
	rate: number; // Tasa respecto a USD como base
	symbol: string;
}

export interface ResumenData {
	periodo?: string;
	ingresos: number;
	gastos: number;
	utilidad: number;
	margen: number;
	ventasCount: number;
	empleadosCount: number;
	gastosCompra: number;
	gastosSalarios: number;
	gastosServicios: number;
	gastosMermas: number;
}
export interface DatosGrafico {
	mes?: string;
	ingresos: number;
	gastos: number;
	utilidad: number;
}

// === RESTOCK INTERFACES ===
