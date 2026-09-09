import { TENANT_ROLES, type TenantRole } from '@/lib/auth/roles';

/**
 * Categorías de permisos, alineadas con las categorías de features del plan
 * (`feature-registry.ts`), sin `infra` (esa es de plataforma, no de tenant).
 */
export type PermissionCategory =
	| 'inventario'
	| 'operaciones'
	| 'ventas'
	| 'compras'
	| 'financiero'
	| 'produccion'
	| 'rrhh'
	| 'config';

/**
 * Definición de un permiso nombrado del sistema de autorización por rol.
 */
export interface PermissionDef {
	/** Clave única con formato `<categoria>.<recurso>.<accion>`. */
	key: string;
	/** Etiqueta corta en español neutro para la matriz de UI. */
	label: string;
	/** Descripción de la operación que habilita. */
	description: string;
	/** Categoría para agrupar en UI; coincide con el primer segmento de la clave. */
	category: PermissionCategory;
	/**
	 * Roles fijos que poseen el permiso por defecto. Reproduce la matriz de
	 * autorización vigente pre-change (paridad día-1). `manager` recibe además
	 * todas las claves por convención en la resolución.
	 */
	defaultRoles: TenantRole[];
	/** Marca operaciones de riesgo (eliminar, cerrar, masivas) para UI y auditoría. */
	sensitive?: boolean;
}

/**
 * Conjunto de categorías válidas para permisos de tenant.
 */
export const PERMISSION_CATEGORIES: readonly PermissionCategory[] = [
	'inventario',
	'operaciones',
	'ventas',
	'compras',
	'financiero',
	'produccion',
	'rrhh',
	'config',
];

/**
 * Catálogo central de permisos nombrados.
 *
 * Fuente de verdad: `openspec/changes/permisos-granulares/impact-map.md`.
 * Regla de `defaultRoles`: los roles que HOY ejecutan la acción en servidor —
 * `['manager']` donde existe `requireManagerRole`; `[manager, economico]` donde
 * el gate real incluye a económico; los tres roles donde aún no hay guard
 * server-side (mermas, transferencias, categorías, almacenes, registrar ventas).
 * Las claves `ventas.facturas.consultar` y `financiero.auditoria.ver` provienen
 * de los únicos gates vivos de allowlist/servicio respectivamente.
 */
export const PERMISSION_REGISTRY: PermissionDef[] = [
	// ── inventario ──
	{
		key: 'inventario.productos.crear',
		label: 'Crear productos',
		description: 'Dar de alta nuevos productos en el catálogo del tenant.',
		category: 'inventario',
		defaultRoles: ['manager'],
	},
	{
		key: 'inventario.productos.editar',
		label: 'Editar productos',
		description: 'Modificar datos de productos existentes.',
		category: 'inventario',
		defaultRoles: ['manager'],
	},
	{
		key: 'inventario.productos.eliminar',
		label: 'Eliminar productos',
		description: 'Eliminar productos del catálogo.',
		category: 'inventario',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'inventario.productos.restock',
		label: 'Hacer restock de productos',
		description: 'Registrar reposición de stock de productos.',
		category: 'inventario',
		defaultRoles: ['manager'],
	},
	{
		key: 'inventario.stock.editar',
		label: 'Modificar stock mínimo',
		description: 'Ajustar el umbral de stock mínimo de productos.',
		category: 'inventario',
		defaultRoles: ['manager'],
	},
	{
		key: 'inventario.listas-precios.gestionar',
		label: 'Gestionar listas de precios',
		description: 'Crear, editar y eliminar listas de precios.',
		category: 'inventario',
		defaultRoles: ['manager'],
	},
	{
		key: 'inventario.ficha-costo.editar-costo',
		label: 'Editar precio de costo',
		description: 'Modificar el precio de costo de un producto.',
		category: 'inventario',
		defaultRoles: ['manager'],
	},
	{
		key: 'inventario.ficha-costo.plantillas',
		label: 'Gestionar plantillas de costo',
		description: 'Crear, editar, activar y eliminar plantillas de ficha de costo.',
		category: 'inventario',
		defaultRoles: ['manager'],
	},
	{
		key: 'inventario.ficha-costo.aplicar-precios',
		label: 'Aplicar precios sugeridos',
		description: 'Aplicar precios sugeridos por la ficha de costo a productos.',
		category: 'inventario',
		defaultRoles: ['manager'],
	},
	{
		key: 'inventario.ficha-costo.bulk',
		label: 'Ajustes masivos de precios',
		description: 'Aplicar ajustes o plantillas de precios de forma masiva.',
		category: 'inventario',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'inventario.mermas.registrar',
		label: 'Registrar mermas',
		description: 'Registrar mermas de inventario.',
		category: 'inventario',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'inventario.mermas.editar',
		label: 'Editar mermas',
		description: 'Modificar mermas de inventario registradas.',
		category: 'inventario',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'inventario.mermas.eliminar',
		label: 'Eliminar mermas',
		description: 'Eliminar registros de mermas de inventario.',
		category: 'inventario',
		defaultRoles: ['manager', 'economico', 'dependiente'],
		sensitive: true,
	},
	{
		key: 'inventario.transferencias.gestionar',
		label: 'Gestionar transferencias',
		description: 'Crear y gestionar transferencias de stock entre almacenes.',
		category: 'inventario',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'inventario.categorias.gestionar',
		label: 'Gestionar categorías',
		description: 'Crear, editar y eliminar categorías y específicos de productos.',
		category: 'inventario',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'inventario.almacenes.gestionar',
		label: 'Gestionar almacenes',
		description: 'Crear, editar y eliminar almacenes.',
		category: 'inventario',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},

	// ── rrhh ──
	{
		key: 'rrhh.empleados.crear',
		label: 'Crear empleados',
		description: 'Dar de alta empleados del tenant.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.empleados.editar',
		label: 'Editar empleados',
		description: 'Modificar datos de empleados.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.empleados.eliminar',
		label: 'Eliminar empleados',
		description: 'Eliminar empleados del tenant.',
		category: 'rrhh',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'rrhh.asistencia.registrar',
		label: 'Registrar asistencia',
		description: 'Registrar entradas y salidas de asistencia.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.asistencia.editar',
		label: 'Editar asistencia',
		description: 'Corregir registros de asistencia.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.asistencia.eliminar',
		label: 'Eliminar asistencia',
		description: 'Eliminar registros de asistencia.',
		category: 'rrhh',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'rrhh.vacaciones.solicitar',
		label: 'Crear solicitudes de vacaciones',
		description: 'Registrar solicitudes de vacaciones de empleados.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.vacaciones.aprobar',
		label: 'Aprobar o rechazar vacaciones',
		description: 'Resolver solicitudes de vacaciones de empleados.',
		category: 'rrhh',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'rrhh.vacaciones.eliminar',
		label: 'Eliminar solicitudes de vacaciones',
		description: 'Eliminar solicitudes de vacaciones.',
		category: 'rrhh',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'rrhh.vacaciones.calcular-acumulacion',
		label: 'Calcular acumulación de vacaciones',
		description: 'Calcular días de vacaciones acumulados por empleado.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.nomina.calcular',
		label: 'Calcular nómina',
		description: 'Generar la nómina de empleados.',
		category: 'rrhh',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'rrhh.nomina.editar',
		label: 'Editar nómina',
		description: 'Modificar registros de nómina existentes.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.nomina.eliminar',
		label: 'Eliminar nómina',
		description: 'Eliminar registros de nómina.',
		category: 'rrhh',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'rrhh.horarios.gestionar',
		label: 'Guardar horarios',
		description: 'Crear y modificar horarios de trabajo.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.horarios.eliminar',
		label: 'Eliminar horarios',
		description: 'Eliminar horarios de trabajo.',
		category: 'rrhh',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'rrhh.salarios.crear',
		label: 'Crear pagos de salario',
		description: 'Registrar pagos de salario a empleados.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.salarios.editar',
		label: 'Editar pagos de salario',
		description: 'Modificar pagos de salario registrados.',
		category: 'rrhh',
		defaultRoles: ['manager'],
	},
	{
		key: 'rrhh.salarios.eliminar',
		label: 'Eliminar pagos de salario',
		description: 'Eliminar pagos de salario.',
		category: 'rrhh',
		defaultRoles: ['manager'],
		sensitive: true,
	},

	// ── operaciones (catálogo de servicios) ──
	{
		key: 'operaciones.servicios.crear',
		label: 'Crear servicios',
		description: 'Dar de alta servicios del catálogo.',
		category: 'operaciones',
		defaultRoles: ['manager'],
	},
	{
		key: 'operaciones.servicios.editar',
		label: 'Editar servicios',
		description: 'Modificar servicios del catálogo.',
		category: 'operaciones',
		defaultRoles: ['manager'],
	},
	{
		key: 'operaciones.servicios.eliminar',
		label: 'Eliminar servicios',
		description: 'Eliminar servicios del catálogo.',
		category: 'operaciones',
		defaultRoles: ['manager'],
		sensitive: true,
	},

	// ── ventas ──
	{
		key: 'ventas.servicios.editar',
		label: 'Editar ventas de servicios',
		description: 'Modificar ventas de servicios registradas.',
		category: 'ventas',
		defaultRoles: ['manager'],
	},
	{
		key: 'ventas.servicios.eliminar',
		label: 'Eliminar ventas de servicios',
		description: 'Eliminar ventas de servicios.',
		category: 'ventas',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'ventas.venta.registrar',
		label: 'Registrar ventas',
		description: 'Crear ventas en nombre del tenant.',
		category: 'ventas',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'ventas.facturas.consultar',
		label: 'Consultar facturas',
		description: 'Ver y descargar facturas emitidas.',
		category: 'ventas',
		defaultRoles: ['manager', 'dependiente'],
	},
	{
		key: 'ventas.ofertas.gestionar',
		label: 'Gestionar ofertas',
		description: 'Crear, editar y consultar ofertas comerciales.',
		category: 'ventas',
		defaultRoles: ['manager'],
	},

	// ── compras (servicios recibidos) ──
	{
		key: 'compras.servicios.crear',
		label: 'Registrar servicios recibidos',
		description: 'Registrar compras de servicios de proveedores.',
		category: 'compras',
		defaultRoles: ['manager'],
	},
	{
		key: 'compras.servicios.editar',
		label: 'Editar servicios recibidos',
		description: 'Modificar compras de servicios registradas.',
		category: 'compras',
		defaultRoles: ['manager'],
	},
	{
		key: 'compras.servicios.eliminar',
		label: 'Eliminar servicios recibidos',
		description: 'Eliminar compras de servicios.',
		category: 'compras',
		defaultRoles: ['manager'],
		sensitive: true,
	},

	// ── financiero ──
	{
		key: 'financiero.conversiones.registrar',
		label: 'Registrar conversiones históricas',
		description: 'Registrar conversiones de moneda históricas del balance.',
		category: 'financiero',
		defaultRoles: ['manager'],
	},
	{
		key: 'financiero.tipos-pago.crear',
		label: 'Crear tipos de pago',
		description: 'Dar de alta tipos de pago de contabilidad.',
		category: 'financiero',
		defaultRoles: ['manager'],
	},
	{
		key: 'financiero.tipos-pago.editar',
		label: 'Editar tipos de pago',
		description: 'Modificar tipos de pago de contabilidad.',
		category: 'financiero',
		defaultRoles: ['manager'],
	},
	{
		key: 'financiero.tipos-pago.eliminar',
		label: 'Eliminar tipos de pago',
		description: 'Eliminar tipos de pago de contabilidad.',
		category: 'financiero',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'financiero.auditoria.ver',
		label: 'Ver auditoría contable',
		description: 'Consultar los registros de auditoría contable del tenant.',
		category: 'financiero',
		defaultRoles: ['manager', 'economico'],
	},
	{
		key: 'financiero.reportes.ver',
		label: 'Ver reportes financieros',
		description: 'Acceder a los reportes financieros del tenant.',
		category: 'financiero',
		defaultRoles: ['manager', 'economico'],
	},
	{
		key: 'financiero.stats.ver',
		label: 'Ver estadísticas financieras',
		description: 'Consultar estadísticas de ventas y del panel financiero.',
		category: 'financiero',
		defaultRoles: ['manager', 'economico'],
	},
	{
		key: 'financiero.contabilidad.acceder',
		label: 'Acceder a contabilidad',
		description: 'Acceder al módulo de contabilidad del tenant.',
		category: 'financiero',
		defaultRoles: ['manager', 'economico'],
	},
	{
		key: 'financiero.gastos.acceder',
		label: 'Acceder a gastos de explotación',
		description: 'Acceder al módulo de gastos de explotación.',
		category: 'financiero',
		defaultRoles: ['manager', 'economico'],
	},

	// ── config ──
	{
		key: 'config.usuarios.gestionar',
		label: 'Gestionar usuarios y membresías',
		description: 'Invitar, aprobar, cambiar roles y desactivar usuarios del tenant.',
		category: 'config',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'config.tipos-contrato.crear',
		label: 'Crear tipos de contrato',
		description: 'Dar de alta tipos de contrato.',
		category: 'config',
		defaultRoles: ['manager'],
	},
	{
		key: 'config.tipos-contrato.eliminar',
		label: 'Eliminar tipos de contrato',
		description: 'Eliminar tipos de contrato.',
		category: 'config',
		defaultRoles: ['manager'],
		sensitive: true,
	},
	{
		key: 'config.empresa.logo',
		label: 'Actualizar logo de la empresa',
		description: 'Subir y reemplazar el logo de la empresa.',
		category: 'config',
		defaultRoles: ['manager'],
	},
	{
		key: 'config.contabilidad.politica',
		label: 'Gestionar política contable',
		description: 'Modificar la política contable del tenant.',
		category: 'config',
		defaultRoles: ['manager'],
		sensitive: true,
	},

	// ── produccion ──
	{
		key: 'produccion.reparaciones.gestionar',
		label: 'Gestionar reparaciones',
		description: 'Crear, editar y consultar órdenes de reparación, equipos, piezas y defectaciones.',
		category: 'produccion',
		defaultRoles: ['manager'],
	},
	{
		key: 'produccion.recetas.gestionar',
		label: 'Gestionar recetas',
		description: 'Crear, editar y consultar recetas de producción e ingredientes.',
		category: 'produccion',
		defaultRoles: ['manager'],
	},
	{
		key: 'produccion.vales.gestionar',
		label: 'Gestionar vales de salida',
		description: 'Crear, editar y consultar vales de salida de inventario.',
		category: 'produccion',
		defaultRoles: ['manager'],
	},
	{
		key: 'produccion.reparaciones.eliminar',
		label: 'Eliminar órdenes de reparación',
		description: 'Eliminar órdenes de reparación.',
		category: 'produccion',
		defaultRoles: ['manager'],
		sensitive: true,
	},

	// ── Acceso por móvil (módulos del API mobile, PG-05 mobile) ──
	// defaultRoles de paridad: mobile hoy no tiene control de rol (cualquier
	// miembro), así que las claves nuevas parten abiertas a los 3 roles y se
	// restringen vía roles custom del manager.
	{
		key: 'inventario.productos.consultar',
		label: 'Consultar productos',
		description: 'Ver el catálogo de productos desde la app móvil.',
		category: 'inventario',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'inventario.unidades.gestionar',
		label: 'Gestionar unidades',
		description: 'Gestionar unidades de medida.',
		category: 'inventario',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'ventas.contratos.gestionar',
		label: 'Gestionar contratos',
		description: 'Crear, editar y consultar contratos.',
		category: 'ventas',
		defaultRoles: ['manager'],
	},
	{
		key: 'compras.compras.gestionar',
		label: 'Gestionar compras',
		description: 'Registrar y consultar compras de productos y recibos.',
		category: 'compras',
		defaultRoles: ['manager'],
	},
	{
		key: 'compras.proveedores.gestionar',
		label: 'Gestionar proveedores',
		description: 'Gestionar proveedores del tenant.',
		category: 'compras',
		defaultRoles: ['manager'],
	},
	{
		key: 'operaciones.servicios.acceder',
		label: 'Acceder a servicios',
		description: 'Consultar y registrar servicios desde la app móvil.',
		category: 'operaciones',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'operaciones.clientes.gestionar',
		label: 'Gestionar clientes',
		description: 'Gestionar el listado de clientes.',
		category: 'operaciones',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'operaciones.referidos.gestionar',
		label: 'Gestionar referidos',
		description: 'Consultar y gestionar referidos del tenant.',
		category: 'operaciones',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
	{
		key: 'operaciones.pos.gestionar',
		label: 'Operar punto de venta',
		description: 'Abrir turnos, arqueos y operar el punto de venta.',
		category: 'operaciones',
		defaultRoles: ['manager', 'economico', 'dependiente'],
	},
];

const REGISTRY_BY_KEY = new Map(PERMISSION_REGISTRY.map((def) => [def.key, def]));

/**
 * @description Busca la definición de un permiso por su clave.
 * @param {string} key - Clave del permiso (`<categoria>.<recurso>.<accion>`).
 * @returns {PermissionDef | undefined} Definición o undefined si la clave no existe.
 */
export function getPermissionByKey(key: string): PermissionDef | undefined {
	return REGISTRY_BY_KEY.get(key);
}

/**
 * @description Devuelve el conjunto de permisos efectivos por defecto de un rol
 * fijo del tenant. `manager` recibe todas las claves (convención `*`); roles
 * desconocidos reciben conjunto vacío (fail-safe, nunca fail-open).
 * @param {TenantRole} role - Rol fijo del tenant.
 * @returns {ReadonlySet<string>} Conjunto inmutable de claves de permiso.
 */
export function getDefaultPermissionsForRole(role: TenantRole): ReadonlySet<string> {
	if (!TENANT_ROLES.includes(role)) {
		return new Set<string>();
	}
	if (role === 'manager') {
		return new Set(PERMISSION_REGISTRY.map((def) => def.key));
	}
	return new Set(
		PERMISSION_REGISTRY.filter((def) => def.defaultRoles.includes(role)).map((def) => def.key),
	);
}
