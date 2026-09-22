/**
 * @description Plan de cuentas por defecto y semillas de la capa de contabilidad
 * formal (CTA-0). Datos puros, sin dependencias de Prisma: el seed los persiste
 * y el motor de asientos (CTA-1) consume las plantillas.
 *
 * Convenciones:
 * - `codigo` jerárquico con puntos ("1", "1.1", "1.1.01"); el padre se deriva.
 * - Cabeceras `aceptaMovimiento = false`; todas las hojas tienen un rol semántico.
 * - La naturaleza se deriva del tipo: ACTIVO/COSTO/GASTO → DEUDORA;
 *   PASIVO/PATRIMONIO/INGRESO → ACREEDORA (no hay contra-cuentas en el plan base).
 * - Condiciones de plantilla interpretadas por el motor: FX_POSITIVA (la
 *   diferencia cambiaria favorece a la empresa), FX_NEGATIVA (la perjudica) y
 *   SIN_DIFERENCIA_FX (cobro/pago sin diferencial). Exactamente una rama condicional
 *   se activa por evento.
 * @module src/features/contabilidad-formal/lib/plan-default
 */

export type TipoCuentaPlan =
	| 'ACTIVO'
	| 'PASIVO'
	| 'PATRIMONIO'
	| 'INGRESO'
	| 'COSTO'
	| 'GASTO';

export type NaturalezaPlan = 'DEUDORA' | 'ACREEDORA';

export type LadoAsientoPlan = 'DEBE' | 'HABER';

export type RolCuentaClave =
	| 'CAJA_PRINCIPAL'
	| 'BANCOS'
	| 'INVENTARIOS'
	| 'CXC_CLIENTES'
	| 'ANTICIPOS_CLIENTES'
	| 'PRESTAMOS_OTORGADOS'
	| 'CXP_PROVEEDORES'
	| 'ANTICIPOS_PROVEEDORES'
	| 'DEUDAS_RECIBIDAS'
	| 'CAPITAL_SOCIAL'
	| 'RESULTADOS_ACUMULADOS'
	| 'RESULTADO_PERIODO'
	| 'VENTAS_PRODUCTOS'
	| 'VENTAS_SERVICIOS'
	| 'OTROS_INGRESOS'
	| 'INTERESES_GANADOS'
	| 'DIFERENCIA_CAMBIARIA_INGRESO'
	| 'COSTO_VENTAS'
	| 'GASTOS_OPERATIVOS'
	| 'GASTOS_NOMINA'
	| 'GASTOS_FINANCIEROS'
	| 'MERMAS'
	| 'DIFERENCIA_CAMBIARIA_GASTO';

export type TipoEventoClave =
	| 'VENTA_CONTADO'
	| 'VENTA_CREDITO'
	| 'COBRO_CXC'
	| 'COSTO_VENTA_DEVENGADO'
	| 'DEVOLUCION_VENTA'
	| 'VENTA_SERVICIO'
	| 'COBRO_SERVICIO'
	| 'COMPRA_CONTADO'
	| 'COMPRA_CREDITO'
	| 'PAGO_CXP'
	| 'GASTO_CONTADO'
	| 'GASTO_CREDITO'
	| 'PAGO_GASTO_CREDITO'
	| 'PAGO_NOMINA'
	| 'ANTICIPO_CLIENTE_RECIBIDO'
	| 'ANTICIPO_CLIENTE_APLICADO'
	| 'ANTICIPO_PROVEEDOR_ENTREGADO'
	| 'ANTICIPO_PROVEEDOR_APLICADO'
	| 'PRESTAMO_OTORGADO'
	| 'COBRO_PRESTAMO'
	| 'DEUDA_RECIBIDA'
	| 'PAGO_DEUDA'
	| 'AJUSTE_BANCARIO_CARGO'
	| 'AJUSTE_BANCARIO_ABONO'
	| 'TRANSFERENCIA_BANCARIA'
	| 'INYECCION_CAPITAL'
	| 'PAGO_DEUDA_CAPITAL'
	| 'MERMA_INVENTARIO'
	| 'PRODUCCION_SALIDA'
	| 'GASTO_CON_ANTICIPO_PROVEEDOR'
	| 'DIFERENCIA_CAMBIARIA'
	| 'APERTURA_PERIODO'
	| 'CIERRE_PERIODO';

export type ReglaMontoClave =
	| 'TOTAL'
	| 'MONTO_PAGADO'
	| 'COSTO_FIFO'
	| 'INTERESES'
	| 'TOTAL_MENOS_INTERESES'
	| 'DIFERENCIA_FX'
	| 'TOTAL_MENOS_DIFERENCIA'
	| 'TOTAL_MAS_DIFERENCIA';

export type CondicionPlantilla = 'FX_POSITIVA' | 'FX_NEGATIVA' | 'SIN_DIFERENCIA_FX';

/**
 * @description Diario asignado a cada tipo de evento de negocio (autoridad del
 * dominio; el engine resuelve el diario del tenant por tipo, no por código).
 */
export const DIARIO_POR_EVENTO: Record<TipoEventoClave, DiarioDefault['tipo']> = {
	VENTA_CONTADO: 'VENTAS',
	VENTA_CREDITO: 'VENTAS',
	COBRO_CXC: 'VENTAS',
	COSTO_VENTA_DEVENGADO: 'VENTAS',
	DEVOLUCION_VENTA: 'VENTAS',
	VENTA_SERVICIO: 'VENTAS',
	COBRO_SERVICIO: 'VENTAS',
	ANTICIPO_CLIENTE_RECIBIDO: 'VENTAS',
	ANTICIPO_CLIENTE_APLICADO: 'VENTAS',
	COMPRA_CONTADO: 'COMPRAS',
	COMPRA_CREDITO: 'COMPRAS',
	PAGO_CXP: 'COMPRAS',
	GASTO_CREDITO: 'COMPRAS',
	PAGO_GASTO_CREDITO: 'COMPRAS',
	ANTICIPO_PROVEEDOR_ENTREGADO: 'COMPRAS',
	ANTICIPO_PROVEEDOR_APLICADO: 'COMPRAS',
	GASTO_CON_ANTICIPO_PROVEEDOR: 'COMPRAS',
	GASTO_CONTADO: 'CAJA',
	PAGO_NOMINA: 'NOMINA',
	INYECCION_CAPITAL: 'CAJA',
	PAGO_DEUDA_CAPITAL: 'CAJA',
	DEUDA_RECIBIDA: 'BANCOS',
	PAGO_DEUDA: 'BANCOS',
	PRESTAMO_OTORGADO: 'BANCOS',
	COBRO_PRESTAMO: 'BANCOS',
	AJUSTE_BANCARIO_CARGO: 'BANCOS',
	AJUSTE_BANCARIO_ABONO: 'BANCOS',
	TRANSFERENCIA_BANCARIA: 'BANCOS',
	DIFERENCIA_CAMBIARIA: 'BANCOS',
	MERMA_INVENTARIO: 'AJUSTES',
	PRODUCCION_SALIDA: 'AJUSTES',
	APERTURA_PERIODO: 'APERTURA_CIERRE',
	CIERRE_PERIODO: 'APERTURA_CIERRE',
};

export interface CuentaPlanDefault {
	codigo: string;
	nombre: string;
	tipo: TipoCuentaPlan;
	naturaleza: NaturalezaPlan;
	nivel: number;
	aceptaMovimiento: boolean;
}

export interface DiarioDefault {
	tipo:
		| 'VENTAS'
		| 'COMPRAS'
		| 'CAJA'
		| 'BANCOS'
		| 'NOMINA'
		| 'AJUSTES'
		| 'APERTURA_CIERRE';
	codigo: string;
	nombre: string;
}

export interface PlantillaLineaDefault {
	evento: TipoEventoClave;
	orden: number;
	lado: LadoAsientoPlan;
	rolCuenta: RolCuentaClave;
	montoRegla: ReglaMontoClave;
	condicion?: CondicionPlantilla;
}

/**
 * @description Calcula el código padre de un código jerárquico.
 * @param {string} codigo - Código de la cuenta ("1.2.01").
 * @returns {string | null} Código padre ("1.2") o null para raíces.
 */
export function padreDeCodigo(codigo: string): string | null {
	const partes = codigo.split('.');
	if (partes.length < 2) return null;
	return partes.slice(0, -1).join('.');
}

/**
 * @description Naturaleza contable derivada del tipo de cuenta.
 * @param {TipoCuentaPlan} tipo - Tipo de la cuenta.
 * @returns {NaturalezaPlan} DEUDORA para activo/costo/gasto; ACREEDORA en caso contrario.
 */
export function naturalezaParaTipo(tipo: TipoCuentaPlan): NaturalezaPlan {
	return tipo === 'ACTIVO' || tipo === 'COSTO' || tipo === 'GASTO'
		? 'DEUDORA'
		: 'ACREEDORA';
}

interface DefinicionCuenta {
	codigo: string;
	nombre: string;
	tipo: TipoCuentaPlan;
	rol?: RolCuentaClave;
}

const DEFINICION_CUENTAS: DefinicionCuenta[] = [
	// 1 ACTIVO
	{ codigo: '1', nombre: 'Activo', tipo: 'ACTIVO' },
	{ codigo: '1.1', nombre: 'Efectivo y equivalentes', tipo: 'ACTIVO' },
	{ codigo: '1.1.01', nombre: 'Caja general', tipo: 'ACTIVO', rol: 'CAJA_PRINCIPAL' },
	{ codigo: '1.1.02', nombre: 'Bancos', tipo: 'ACTIVO', rol: 'BANCOS' },
	{ codigo: '1.2', nombre: 'Cuentas por cobrar y exigible', tipo: 'ACTIVO' },
	{ codigo: '1.2.01', nombre: 'Clientes por ventas a crédito', tipo: 'ACTIVO', rol: 'CXC_CLIENTES' },
	{
		codigo: '1.2.02',
		nombre: 'Préstamos otorgados a clientes',
		tipo: 'ACTIVO',
		rol: 'PRESTAMOS_OTORGADOS',
	},
	{
		codigo: '1.2.03',
		nombre: 'Anticipos entregados a proveedores',
		tipo: 'ACTIVO',
		rol: 'ANTICIPOS_PROVEEDORES',
	},
	{ codigo: '1.3', nombre: 'Inventarios', tipo: 'ACTIVO' },
	{
		codigo: '1.3.01',
		nombre: 'Inventario de mercancías',
		tipo: 'ACTIVO',
		rol: 'INVENTARIOS',
	},
	// 2 PASIVO
	{ codigo: '2', nombre: 'Pasivo', tipo: 'PASIVO' },
	{ codigo: '2.1', nombre: 'Obligaciones con terceros', tipo: 'PASIVO' },
	{
		codigo: '2.1.01',
		nombre: 'Proveedores y cuentas por pagar',
		tipo: 'PASIVO',
		rol: 'CXP_PROVEEDORES',
	},
	{ codigo: '2.1.02', nombre: 'Deudas recibidas', tipo: 'PASIVO', rol: 'DEUDAS_RECIBIDAS' },
	{
		codigo: '2.1.03',
		nombre: 'Anticipos recibidos de clientes',
		tipo: 'PASIVO',
		rol: 'ANTICIPOS_CLIENTES',
	},
	// 3 PATRIMONIO
	{ codigo: '3', nombre: 'Patrimonio', tipo: 'PATRIMONIO' },
	{ codigo: '3.1', nombre: 'Capital social', tipo: 'PATRIMONIO', rol: 'CAPITAL_SOCIAL' },
	{
		codigo: '3.2',
		nombre: 'Resultados acumulados',
		tipo: 'PATRIMONIO',
		rol: 'RESULTADOS_ACUMULADOS',
	},
	{
		codigo: '3.3',
		nombre: 'Resultado del período',
		tipo: 'PATRIMONIO',
		rol: 'RESULTADO_PERIODO',
	},
	// 4 INGRESOS
	{ codigo: '4', nombre: 'Ingresos', tipo: 'INGRESO' },
	{ codigo: '4.1', nombre: 'Ventas de productos', tipo: 'INGRESO', rol: 'VENTAS_PRODUCTOS' },
	{ codigo: '4.2', nombre: 'Ventas de servicios', tipo: 'INGRESO', rol: 'VENTAS_SERVICIOS' },
	{ codigo: '4.3', nombre: 'Otros ingresos', tipo: 'INGRESO', rol: 'OTROS_INGRESOS' },
	{ codigo: '4.4', nombre: 'Intereses ganados', tipo: 'INGRESO', rol: 'INTERESES_GANADOS' },
	{
		codigo: '4.5',
		nombre: 'Diferencia cambiaria (ingreso)',
		tipo: 'INGRESO',
		rol: 'DIFERENCIA_CAMBIARIA_INGRESO',
	},
	// 5 COSTOS
	{ codigo: '5', nombre: 'Costos', tipo: 'COSTO' },
	{ codigo: '5.1', nombre: 'Costo de ventas', tipo: 'COSTO', rol: 'COSTO_VENTAS' },
	// 6 GASTOS
	{ codigo: '6', nombre: 'Gastos', tipo: 'GASTO' },
	{ codigo: '6.1', nombre: 'Gastos operativos', tipo: 'GASTO', rol: 'GASTOS_OPERATIVOS' },
	{ codigo: '6.2', nombre: 'Gastos de nómina', tipo: 'GASTO', rol: 'GASTOS_NOMINA' },
	{ codigo: '6.3', nombre: 'Gastos financieros', tipo: 'GASTO', rol: 'GASTOS_FINANCIEROS' },
	{ codigo: '6.4', nombre: 'Mermas y faltantes', tipo: 'GASTO', rol: 'MERMAS' },
	{
		codigo: '6.5',
		nombre: 'Diferencia cambiaria (gasto)',
		tipo: 'GASTO',
		rol: 'DIFERENCIA_CAMBIARIA_GASTO',
	},
];

/**
 * @description Plan de cuentas por defecto derivado de DEFINICION_CUENTAS:
 * nivel = segmentos del código; aceptaMovimiento = hoja con rol semántico.
 */
export const CUENTAS_PLAN_DEFAULT: CuentaPlanDefault[] = DEFINICION_CUENTAS.map(
	(definicion) => {
		const tieneHijas = DEFINICION_CUENTAS.some((otra) =>
			otra.codigo.startsWith(`${definicion.codigo}.`),
		);
		return {
			codigo: definicion.codigo,
			nombre: definicion.nombre,
			tipo: definicion.tipo,
			naturaleza: naturalezaParaTipo(definicion.tipo),
			nivel: definicion.codigo.split('.').length,
			aceptaMovimiento: !tieneHijas && definicion.rol !== undefined,
		};
	},
);

/**
 * @description Rol semántico → código de cuenta del plan por defecto (23 hojas).
 */
export const ROLES_CUENTA_DEFAULT: Record<RolCuentaClave, string> = Object.fromEntries(
	DEFINICION_CUENTAS.filter((cuenta) => cuenta.rol !== undefined).map((cuenta) => [
		cuenta.rol,
		cuenta.codigo,
	]),
) as Record<RolCuentaClave, string>;

/**
 * @description Diarios contables sembrados por tenant al activar la capa formal.
 */
export const DIARIOS_DEFAULT: DiarioDefault[] = [
	{ tipo: 'VENTAS', codigo: 'VTA', nombre: 'Diario de ventas' },
	{ tipo: 'COMPRAS', codigo: 'CMP', nombre: 'Diario de compras' },
	{ tipo: 'CAJA', codigo: 'CAJ', nombre: 'Diario de caja' },
	{ tipo: 'BANCOS', codigo: 'BAN', nombre: 'Diario de bancos' },
	{ tipo: 'NOMINA', codigo: 'NOM', nombre: 'Diario de nómina' },
	{ tipo: 'AJUSTES', codigo: 'AJU', nombre: 'Diario de ajustes' },
	{ tipo: 'APERTURA_CIERRE', codigo: 'APE', nombre: 'Diario de apertura y cierre' },
];

/**
 * @description Líneas de un tipo de evento, en orden de asiento.
 */
interface LineasEvento {
	orden: number;
	lado: LadoAsientoPlan;
	rol: RolCuentaClave;
	regla: ReglaMontoClave;
	condicion?: CondicionPlantilla;
}

/**
 * @description Constructor auxiliar para plantillas: las líneas conservan el
 * orden declarado y heredan el evento.
 */
function plantilla(
	evento: TipoEventoClave,
	lineas: Array<Omit<LineasEvento, 'orden'>>,
): PlantillaLineaDefault[] {
	return lineas.map((linea, index) => ({
		evento,
		orden: index + 1,
		lado: linea.lado,
		rolCuenta: linea.rol,
		montoRegla: linea.regla,
		...(linea.condicion ? { condicion: linea.condicion } : {}),
	}));
}

/**
 * @description Plantillas globales por defecto (evento → líneas por rol).
 * APERTURA_PERIODO y CIERRE_PERIODO no tienen plantilla: sus asientos se
 * construyen programáticamente en CTA-3 desde AperturaPeriodo y los saldos
 * de resultado.
 *
 * Regla del motor (CTA-1) para tesorería: si el evento indica medio bancario,
 * el rol CAJA_PRINCIPAL se sustituye por BANCOS en todas las líneas.
 */
export const PLANTILLAS_DEFAULT: PlantillaLineaDefault[] = [
	...plantilla('VENTA_CONTADO', [
		{ lado: 'DEBE', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'VENTAS_PRODUCTOS', regla: 'TOTAL' },
	]),
	...plantilla('VENTA_CREDITO', [
		{ lado: 'DEBE', rol: 'CXC_CLIENTES', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'VENTAS_PRODUCTOS', regla: 'TOTAL' },
	]),
	...plantilla('COBRO_CXC', [
		{ lado: 'DEBE', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
		{
			lado: 'HABER',
			rol: 'CXC_CLIENTES',
			regla: 'TOTAL',
			condicion: 'SIN_DIFERENCIA_FX',
		},
		{
			lado: 'HABER',
			rol: 'CXC_CLIENTES',
			regla: 'TOTAL_MENOS_DIFERENCIA',
			condicion: 'FX_POSITIVA',
		},
		{
			lado: 'HABER',
			rol: 'CXC_CLIENTES',
			regla: 'TOTAL_MAS_DIFERENCIA',
			condicion: 'FX_NEGATIVA',
		},
		{
			lado: 'HABER',
			rol: 'DIFERENCIA_CAMBIARIA_INGRESO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_POSITIVA',
		},
		{
			lado: 'DEBE',
			rol: 'DIFERENCIA_CAMBIARIA_GASTO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_NEGATIVA',
		},
	]),
	...plantilla('COSTO_VENTA_DEVENGADO', [
		{ lado: 'DEBE', rol: 'COSTO_VENTAS', regla: 'COSTO_FIFO' },
		{ lado: 'HABER', rol: 'INVENTARIOS', regla: 'COSTO_FIFO' },
	]),
	...plantilla('DEVOLUCION_VENTA', [
		{ lado: 'DEBE', rol: 'VENTAS_PRODUCTOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
		{ lado: 'DEBE', rol: 'INVENTARIOS', regla: 'COSTO_FIFO' },
		{ lado: 'HABER', rol: 'COSTO_VENTAS', regla: 'COSTO_FIFO' },
	]),
	...plantilla('VENTA_SERVICIO', [
		{ lado: 'DEBE', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'VENTAS_SERVICIOS', regla: 'TOTAL' },
	]),
	...plantilla('COBRO_SERVICIO', [
		{ lado: 'DEBE', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
		{
			lado: 'HABER',
			rol: 'CXC_CLIENTES',
			regla: 'TOTAL',
			condicion: 'SIN_DIFERENCIA_FX',
		},
		{
			lado: 'HABER',
			rol: 'CXC_CLIENTES',
			regla: 'TOTAL_MENOS_DIFERENCIA',
			condicion: 'FX_POSITIVA',
		},
		{
			lado: 'HABER',
			rol: 'CXC_CLIENTES',
			regla: 'TOTAL_MAS_DIFERENCIA',
			condicion: 'FX_NEGATIVA',
		},
		{
			lado: 'HABER',
			rol: 'DIFERENCIA_CAMBIARIA_INGRESO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_POSITIVA',
		},
		{
			lado: 'DEBE',
			rol: 'DIFERENCIA_CAMBIARIA_GASTO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_NEGATIVA',
		},
	]),
	...plantilla('COMPRA_CONTADO', [
		{ lado: 'DEBE', rol: 'INVENTARIOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
	]),
	...plantilla('COMPRA_CREDITO', [
		{ lado: 'DEBE', rol: 'INVENTARIOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CXP_PROVEEDORES', regla: 'TOTAL' },
	]),
	...plantilla('PAGO_CXP', [
		{
			lado: 'DEBE',
			rol: 'CXP_PROVEEDORES',
			regla: 'TOTAL',
			condicion: 'SIN_DIFERENCIA_FX',
		},
		{
			lado: 'DEBE',
			rol: 'CXP_PROVEEDORES',
			regla: 'TOTAL_MENOS_DIFERENCIA',
			condicion: 'FX_POSITIVA',
		},
		{
			lado: 'DEBE',
			rol: 'CXP_PROVEEDORES',
			regla: 'TOTAL_MAS_DIFERENCIA',
			condicion: 'FX_NEGATIVA',
		},
		{
			lado: 'DEBE',
			rol: 'DIFERENCIA_CAMBIARIA_GASTO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_NEGATIVA',
		},
		{
			lado: 'HABER',
			rol: 'DIFERENCIA_CAMBIARIA_INGRESO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_POSITIVA',
		},
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
	]),
	...plantilla('GASTO_CONTADO', [
		{ lado: 'DEBE', rol: 'GASTOS_OPERATIVOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
	]),
	...plantilla('GASTO_CREDITO', [
		{ lado: 'DEBE', rol: 'GASTOS_OPERATIVOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CXP_PROVEEDORES', regla: 'TOTAL' },
	]),
	...plantilla('PAGO_GASTO_CREDITO', [
		{
			lado: 'DEBE',
			rol: 'CXP_PROVEEDORES',
			regla: 'TOTAL',
			condicion: 'SIN_DIFERENCIA_FX',
		},
		{
			lado: 'DEBE',
			rol: 'CXP_PROVEEDORES',
			regla: 'TOTAL_MENOS_DIFERENCIA',
			condicion: 'FX_POSITIVA',
		},
		{
			lado: 'DEBE',
			rol: 'CXP_PROVEEDORES',
			regla: 'TOTAL_MAS_DIFERENCIA',
			condicion: 'FX_NEGATIVA',
		},
		{
			lado: 'DEBE',
			rol: 'DIFERENCIA_CAMBIARIA_GASTO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_NEGATIVA',
		},
		{
			lado: 'HABER',
			rol: 'DIFERENCIA_CAMBIARIA_INGRESO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_POSITIVA',
		},
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
	]),
	...plantilla('PAGO_NOMINA', [
		{ lado: 'DEBE', rol: 'GASTOS_NOMINA', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
	]),
	...plantilla('ANTICIPO_CLIENTE_RECIBIDO', [
		{ lado: 'DEBE', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'ANTICIPOS_CLIENTES', regla: 'TOTAL' },
	]),
	...plantilla('ANTICIPO_CLIENTE_APLICADO', [
		{ lado: 'DEBE', rol: 'ANTICIPOS_CLIENTES', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CXC_CLIENTES', regla: 'TOTAL' },
	]),
	...plantilla('ANTICIPO_PROVEEDOR_ENTREGADO', [
		{ lado: 'DEBE', rol: 'ANTICIPOS_PROVEEDORES', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
	]),
	...plantilla('ANTICIPO_PROVEEDOR_APLICADO', [
		{ lado: 'DEBE', rol: 'CXP_PROVEEDORES', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'ANTICIPOS_PROVEEDORES', regla: 'TOTAL' },
	]),
	...plantilla('PRESTAMO_OTORGADO', [
		{ lado: 'DEBE', rol: 'PRESTAMOS_OTORGADOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
	]),
	...plantilla('COBRO_PRESTAMO', [
		{ lado: 'DEBE', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'PRESTAMOS_OTORGADOS', regla: 'TOTAL_MENOS_INTERESES' },
		{ lado: 'HABER', rol: 'INTERESES_GANADOS', regla: 'INTERESES' },
	]),
	...plantilla('DEUDA_RECIBIDA', [
		{ lado: 'DEBE', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'DEUDAS_RECIBIDAS', regla: 'TOTAL' },
	]),
	...plantilla('PAGO_DEUDA', [
		{ lado: 'DEBE', rol: 'DEUDAS_RECIBIDAS', regla: 'TOTAL_MENOS_INTERESES' },
		{ lado: 'DEBE', rol: 'GASTOS_FINANCIEROS', regla: 'INTERESES' },
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
	]),
	...plantilla('AJUSTE_BANCARIO_CARGO', [
		{ lado: 'DEBE', rol: 'GASTOS_FINANCIEROS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'BANCOS', regla: 'TOTAL' },
	]),
	...plantilla('AJUSTE_BANCARIO_ABONO', [
		{ lado: 'DEBE', rol: 'BANCOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'OTROS_INGRESOS', regla: 'TOTAL' },
	]),
	...plantilla('TRANSFERENCIA_BANCARIA', [
		{ lado: 'DEBE', rol: 'BANCOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'BANCOS', regla: 'TOTAL' },
	]),
	...plantilla('INYECCION_CAPITAL', [
		{ lado: 'DEBE', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CAPITAL_SOCIAL', regla: 'TOTAL' },
	]),
	...plantilla('PAGO_DEUDA_CAPITAL', [
		{ lado: 'DEBE', rol: 'CAPITAL_SOCIAL', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'CAJA_PRINCIPAL', regla: 'TOTAL' },
	]),
	...plantilla('MERMA_INVENTARIO', [
		{ lado: 'DEBE', rol: 'MERMAS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'INVENTARIOS', regla: 'TOTAL' },
	]),
	...plantilla('PRODUCCION_SALIDA', [
		{ lado: 'DEBE', rol: 'INVENTARIOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'INVENTARIOS', regla: 'TOTAL' },
	]),
	...plantilla('GASTO_CON_ANTICIPO_PROVEEDOR', [
		{ lado: 'DEBE', rol: 'GASTOS_OPERATIVOS', regla: 'TOTAL' },
		{ lado: 'HABER', rol: 'ANTICIPOS_PROVEEDORES', regla: 'TOTAL' },
	]),
	...plantilla('DIFERENCIA_CAMBIARIA', [
		{
			lado: 'DEBE',
			rol: 'BANCOS',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_POSITIVA',
		},
		{
			lado: 'HABER',
			rol: 'DIFERENCIA_CAMBIARIA_INGRESO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_POSITIVA',
		},
		{
			lado: 'DEBE',
			rol: 'DIFERENCIA_CAMBIARIA_GASTO',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_NEGATIVA',
		},
		{
			lado: 'HABER',
			rol: 'BANCOS',
			regla: 'DIFERENCIA_FX',
			condicion: 'FX_NEGATIVA',
		},
	]),
];
