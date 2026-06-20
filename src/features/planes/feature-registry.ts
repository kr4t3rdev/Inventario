/**
 * @description Catálogo central de todos los módulos/features del sistema.
 * Cada entrada define un feature con su clave, etiqueta, categoría y descripción.
 * Es la fuente de verdad para el sistema de planes y la landing page.
 *
 * @module features/planes/feature-registry
 */

export type FeatureCategory =
	| "inventario"
	| "operaciones"
	| "ventas"
	| "compras"
	| "financiero"
	| "produccion"
	| "rrhh"
	| "config"
	| "infra";

export interface FeatureDef {
	/** Clave única del feature (se guarda en el JSON `features` del plan) */
	key: string;
	/** Etiqueta visible para el usuario */
	label: string;
	/** Descripción corta de qué incluye */
	description: string;
	/** Categoría funcional para agrupar en la UI */
	category: FeatureCategory;
}

export const FEATURE_REGISTRY: FeatureDef[] = [
	// ════════════════════════════════════════════
	// Inventario
	// ════════════════════════════════════════════
	{
		key: "productos",
		label: "Productos",
		description: "Gestión completa de productos con código interno EAN-13",
		category: "inventario",
	},
	{
		key: "productos-stock-masivo",
		label: "Stock mínimo masivo",
		description: "Actualización masiva de stock mínimo desde una lista",
		category: "inventario",
	},
	{
		key: "restock",
		label: "Restock de productos",
		description: "Sugerencias y gestión de reposición de inventario",
		category: "inventario",
	},
	{
		key: "categorias",
		label: "Categorías",
		description: "Categorías jerárquicas para clasificar productos",
		category: "inventario",
	},
	{
		key: "categorias-ean13",
		label: "Config. EAN-13 en categorías",
		description: "Prefijos y configuración EAN-13 por categoría",
		category: "inventario",
	},
	{
		key: "unidades",
		label: "Unidades de medida",
		description: "Unidades de medida para productos (kg, unidad, etc.)",
		category: "inventario",
	},
	{
		key: "listas-precios",
		label: "Listas de precios",
		description: "Listas de precios diferenciadas por producto y cliente",
		category: "inventario",
	},
	{
		key: "ficha-costo-bulk",
		label: "Actualización masiva de precios",
		description: "Ajuste porcentual y aplicación de plantillas a múltiples productos",
		category: "inventario",
	},

	// ════════════════════════════════════════════
	// Operaciones (almacenes, sucursales)
	// ════════════════════════════════════════════
	{
		key: "almacenes",
		label: "Almacenes",
		description: "Gestión de almacenes con control de ubicaciones",
		category: "operaciones",
	},
	{
		key: "puntos-venta",
		label: "Puntos de venta",
		description: "Puntos de venta o sucursales activas",
		category: "operaciones",
	},
	{
		key: "transferencias",
		label: "Transferencias",
		description: "Transferencias de stock entre almacenes con trazabilidad",
		category: "operaciones",
	},
	{
		key: "mermas",
		label: "Control de mermas",
		description: "Registro y control de mermas y ajustes de inventario",
		category: "operaciones",
	},

	// ════════════════════════════════════════════
	// Ventas
	// ════════════════════════════════════════════
	{
		key: "ventas-pos",
		label: "Ventas POS",
		description: "Ventas en punto de venta con cálculo automático",
		category: "ventas",
	},
	{
		key: "ventas-factura",
		label: "Ventas con factura",
		description: "Ventas que generan factura / crédito",
		category: "ventas",
	},
	{
		key: "turnos-pos",
		label: "Turnos POS",
		description: "Gestión de turnos de empleados por punto de venta",
		category: "ventas",
	},
	{
		key: "arqueo-caja",
		label: "Arqueo de caja",
		description: "Arqueo y cierre de caja automático por turno",
		category: "ventas",
	},
	{
		key: "cuadre-diario",
		label: "Cuadre diario",
		description: "Cuadre diario consolidado de ventas",
		category: "ventas",
	},
	{
		key: "ofertas",
		label: "Ofertas y promociones",
		description: "Ofertas, descuentos y promociones por producto",
		category: "ventas",
	},

	// ════════════════════════════════════════════
	// Clientes y Facturación
	// ════════════════════════════════════════════
	{
		key: "clientes",
		label: "Clientes",
		description: "Gestión de clientes con historial de compras",
		category: "ventas",
	},
	{
		key: "facturacion",
		label: "Facturación electrónica",
		description: "Emisión de facturas electrónicas y notas de crédito",
		category: "ventas",
	},
	{
		key: "series-facturacion",
		label: "Series fiscales",
		description: "Configuración de series, prefijos y numeración fiscal",
		category: "ventas",
	},

	// ════════════════════════════════════════════
	// Compras y Proveedores
	// ════════════════════════════════════════════
	{
		key: "proveedores",
		label: "Proveedores",
		description: "Gestión de proveedores y contacto",
		category: "compras",
	},
	{
		key: "compras",
		label: "Compras",
		description: "Compras de productos con control de documentos",
		category: "compras",
	},
	{
		key: "servicios",
		label: "Servicios",
		description: "Gestión de servicios ofrecidos",
		category: "compras",
	},

	// ════════════════════════════════════════════
	// Financiero
	// ════════════════════════════════════════════
	{
		key: "gastos",
		label: "Gastos",
		description: "Control de gastos de empresa",
		category: "financiero",
	},
	{
		key: "contabilidad",
		label: "Contabilidad",
		description:
			"Contabilidad completa: cuentas, ajustes, reconciliación, reportes, logs",
		category: "financiero",
	},
	{
		key: "inyeccion-capital",
		label: "Inyección de capital",
		description:
			"Inyecciones y aportaciones de capital con registro de pagos de deuda",
		category: "financiero",
	},
	{
		key: "multi-moneda",
		label: "Multi-moneda (USD)",
		description: "Operaciones en múltiples monedas con conversión automática",
		category: "financiero",
	},
	{
		key: "rentabilidad-compra",
		label: "Rentabilidad por compra",
		description: "Análisis de rentabilidad detallado por cada compra realizada",
		category: "financiero",
	},
	{
		key: "reportes-financieros",
		label: "Reportes financieros avanzados",
		description: "Indicadores de rentabilidad, balances y reportes exportables",
		category: "financiero",
	},
	{
		key: "cuentas-cobrar",
		label: "Cuentas por cobrar",
		description: "Seguimiento de cuentas por cobrar y pagos pendientes",
		category: "financiero",
	},
	{
		key: "cuentas-pagar",
		label: "Cuentas por pagar",
		description: "Control de cuentas por pagar a proveedores",
		category: "financiero",
	},
	{
		key: "prestamos-cash",
		label: "Préstamos cash",
		description: "Gestión de préstamos otorgados",
		category: "financiero",
	},
	{
		key: "deudas-cash",
		label: "Deudas cash",
		description: "Control de deudas y obligaciones",
		category: "financiero",
	},
	{
		key: "anticipos",
		label: "Anticipos",
		description: "Gestión de anticipos a proveedores",
		category: "financiero",
	},
	{
		key: "analisis-estado-cuenta",
		label: "Análisis de Estado de Cuenta",
		description: "Análisis detallado de cuenta por cliente con antigüedad de saldos",
		category: "financiero",
	},
	{
		key: "facturas-vencidas",
		label: "Facturas Vencidas",
		description: "Reporte de facturas vencidas por antigüedad de deuda",
		category: "financiero",
	},

	// ════════════════════════════════════════════
	// Producción
	// ════════════════════════════════════════════
	{
		key: "produccion",
		label: "Órdenes de producción",
		description: "Órdenes de producción con recetas e ingredientes",
		category: "produccion",
	},
	{
		key: "reparaciones",
		label: "Taller de reparaciones",
		description: "Taller de reparaciones con seguimiento de equipos",
		category: "produccion",
	},

	// ════════════════════════════════════════════
	// RRHH
	// ════════════════════════════════════════════
	{
		key: "empleados",
		label: "Empleados",
		description: "Gestión de empleados y datos laborales",
		category: "rrhh",
	},
	{
		key: "vacaciones",
		label: "Vacaciones",
		description: "Solicitudes, acumulación automática y aprobación de vacaciones",
		category: "rrhh",
	},
	{
		key: "asistencia",
		label: "Asistencia",
		description: "Checkin/checkout de empleados con horarios semanales",
		category: "rrhh",
	},
	{
		key: "nomina",
		label: "Nómina y salarios",
		description: "Pago de salarios, comisiones dinámicas y vacaciones",
		category: "rrhh",
	},

	// ════════════════════════════════════════════
	// Empresa y Configuración
	// ════════════════════════════════════════════
	{
		key: "mi-empresa",
		label: "Mi Empresa",
		description: "Datos de la empresa (nombre, dirección, contacto)",
		category: "config",
	},
	{
		key: "mi-empresa-ean13",
		label: "Generación EAN-13",
		description:
			"Activar casilla de verificación EAN-13 en Mi Empresa y configuración por categoría",
		category: "config",
	},
	{
		key: "contratos",
		label: "Contratos",
		description: "Gestión de contratos con clientes y proveedores",
		category: "config",
	},
	{
		key: "gestion-usuarios",
		label: "Gestión de usuarios",
		description: "Administración de usuarios del negocio con roles",
		category: "config",
	},
	{
		key: "notificaciones",
		label: "Notificaciones",
		description: "Notificaciones automáticas del sistema",
		category: "config",
	},
	{
		key: "configuracion",
		label: "Configuración",
		description: "Configuración general del sistema",
		category: "config",
	},
	{
		key: "dashboard",
		label: "Dashboard ejecutivo",
		description: "Panel principal con indicadores en tiempo real",
		category: "config",
	},

	{
		key: "multitenantmembership",
		label: "Membresía multi-tenant",
		description:
			"Permite que un mismo usuario pertenezca y trabaje en varias empresas simultáneamente",
		category: "config",
	},

	// ════════════════════════════════════════════
	// Backups
	// ════════════════════════════════════════════
	{
		key: "backups-semanal",
		label: "Backups semanales",
		description: "Copias de seguridad automáticas semanales",
		category: "infra",
	},
	{
		key: "backups-diario",
		label: "Backups diarios",
		description: "Copias de seguridad automáticas diarias",
		category: "infra",
	},
	{
		key: "backups-tiempo-real",
		label: "Backups cada hora",
		description: "Copias de seguridad cada hora con restauración point-in-time",
		category: "infra",
	},

	// ════════════════════════════════════════════
	// Integraciones
	// ════════════════════════════════════════════
	{
		key: "api-integraciones",
		label: "API e integraciones",
		description: "Endpoints públicos para integraciones externas",
		category: "infra",
	},
];

/** Etiquetas de categoría para mostrar en la UI */
export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
	inventario: "Inventario",
	operaciones: "Operaciones",
	ventas: "Ventas",
	compras: "Compras",
	financiero: "Financiero",
	produccion: "Producción",
	rrhh: "RRHH",
	config: "Empresa y Configuración",
	infra: "Infraestructura",
};

/** Orden de visualización de las categorías */
export const CATEGORY_ORDER: FeatureCategory[] = [
	"inventario",
	"operaciones",
	"ventas",
	"compras",
	"financiero",
	"produccion",
	"rrhh",
	"config",
	"infra",
];

/**
 * @description Obtiene un feature por su clave.
 */
export function getFeatureByKey(key: string): FeatureDef | undefined {
	return FEATURE_REGISTRY.find((f) => f.key === key);
}

/**
 * @description Obtiene los features agrupados por categoría.
 */
export function getFeaturesGrouped(): Record<FeatureCategory, FeatureDef[]> {
	const grouped: Record<string, FeatureDef[]> = {};
	for (const cat of CATEGORY_ORDER) {
		grouped[cat] = [];
	}
	for (const f of FEATURE_REGISTRY) {
		if (!grouped[f.category]) grouped[f.category] = [];
		grouped[f.category].push(f);
	}
	return grouped as Record<FeatureCategory, FeatureDef[]>;
}

/**
 * @description Filtra los features habilitados según un objeto de features flags.
 */
export function getEnabledFeatures(
	features: Record<string, boolean>,
): FeatureDef[] {
	return FEATURE_REGISTRY.filter((f) => features[f.key] === true);
}

/**
 * @description Obtiene los labels de los features habilitados.
 */
export function getEnabledFeatureLabels(
	features: Record<string, boolean>,
): string[] {
	return getEnabledFeatures(features).map((f) => f.label);
}
