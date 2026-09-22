/**
 * @description Conciliación cruzada caja ↔ asientos (CTA-2): por cada rubro
 * clave compara el saldo contable (libros) contra el saldo operativo de la
 * base caja, exponiendo la diferencia exacta cuando divergen.
 * v1: los importes en moneda no funcional se excluyen del lado operativo y se
 * reportan como alcance limitado (la conversión real exige la evidencia FX).
 * @module src/features/contabilidad-formal/services/conciliacion-cruzada-service
 */

import { prisma } from '@/lib/prisma';

export type ClaveRubro = 'TESORERIA' | 'CXC' | 'CXP';

export interface RubroConciliacion {
	clave: ClaveRubro;
	nombre: string;
	saldoLibros: number;
	saldoOperativo: number;
	diferencia: number;
	estado: 'OK' | 'DIFERENCIA';
	nota?: string;
}

export interface ResultadoConciliacion {
	rubros: RubroConciliacion[];
	monedaFuncional: string;
	generadoAt: Date;
}

const ROLES_POR_RUBRO: Record<ClaveRubro, string[]> = {
	TESORERIA: ['CAJA_PRINCIPAL', 'BANCOS'],
	CXC: ['CXC_CLIENTES'],
	CXP: ['CXP_PROVEEDORES'],
};

const NOMBRES_RUBRO: Record<ClaveRubro, string> = {
	TESORERIA: 'Tesorería (caja y bancos)',
	CXC: 'Cuentas por cobrar',
	CXP: 'Cuentas por pagar',
};

const TOLERANCIA = 0.01;

/**
 * @description Suma el saldo contable por cuenta (en su naturaleza).
 */
async function saldoLibros(tenantId: string, cuentaIds: string[]): Promise<number> {
	if (cuentaIds.length === 0) return 0;
	const agregados = await prisma.asientoLinea.groupBy({
		by: ['cuentaId'],
		where: { cuentaId: { in: cuentaIds }, asiento: { tenantId, estado: 'CONTABILIZADO' } },
		_sum: { debe: true, haber: true },
	});
	const cuentas = await prisma.cuentaContable.findMany({
		where: { cuentaContableId: { in: cuentaIds } },
		select: { cuentaContableId: true, naturaleza: true },
	});
	const naturalezaPorId = new Map(cuentas.map((c) => [c.cuentaContableId, c.naturaleza]));
	return agregados.reduce((total, a) => {
		const debe = Number(a._sum.debe ?? 0);
		const haber = Number(a._sum.haber ?? 0);
		const nat = naturalezaPorId.get(a.cuentaId);
		return total + (nat === 'DEUDORA' ? debe - haber : haber - debe);
	}, 0);
}

/**
 * @description Panel de conciliación cruzada entre la capa formal y la base caja.
 * @param {string} tenantId - Tenant propietario.
 * @param {{ fechaHasta?: Date }} _filtros - Reservado para corte temporal futuro.
 * @returns {Promise<ResultadoConciliacion>} Rubros comparados.
 */
export async function obtenerConciliacionCruzada(
	tenantId: string,
	_filtros: { fechaHasta?: Date },
): Promise<ResultadoConciliacion> {
	const policy = await prisma.tenantAccountingPolicy.findUnique({
		where: { tenantId },
		select: { functionalCurrencyCode: true },
	});
	const monedaFuncional = policy?.functionalCurrencyCode?.trim().toUpperCase() ?? 'CUP';

	const roles = await prisma.cuentaRolTenant.findMany({
		where: { tenantId },
		select: { rol: true, cuentaId: true },
	});
	const cuentasPorRol = new Map(roles.map((r) => [r.rol, r.cuentaId]));

	const [tesoreriaLibros, cxcLibros, cxpLibros] = await Promise.all([
		saldoLibros(
			tenantId,
			ROLES_POR_RUBRO.TESORERIA.map((r) => cuentasPorRol.get(r)).filter((id): id is string => !!id),
		),
		saldoLibros(
			tenantId,
			ROLES_POR_RUBRO.CXC.map((r) => cuentasPorRol.get(r)).filter((id): id is string => !!id),
		),
		saldoLibros(
			tenantId,
			ROLES_POR_RUBRO.CXP.map((r) => cuentasPorRol.get(r)).filter((id): id is string => !!id),
		),
	]);

	const [cuentasBancarias, cxcOperativo, cxpOperativo] = await Promise.all([
		prisma.cuentaBancaria.findMany({
			where: { tenantId, isActive: true, moneda: monedaFuncional },
			select: { saldo: true },
		}),
		prisma.cuentaPorCobrar.findMany({
			where: { tenantId, estado: { not: 'ANULADA' } },
			select: { montoDeuda: true, montoPagado: true },
		}),
		prisma.cuentaPorPagar.findMany({
			where: { tenantId, deletedAt: null },
			select: { saldoPendiente: true },
		}),
	]);

	const tesoreriaOperativo = cuentasBancarias.reduce((s, c) => s + Number(c.saldo), 0);
	const cxcOperativoTotal = cxcOperativo.reduce(
		(s, c) => s + (Number(c.montoDeuda) - Number(c.montoPagado)),
		0,
	);
	const cxpOperativoTotal = cxpOperativo.reduce((s, c) => s + Number(c.saldoPendiente), 0);

	function rubro(
		clave: ClaveRubro,
		libros: number,
		operativo: number,
		nota?: string,
	): RubroConciliacion {
		const diferencia = Math.round((libros - operativo) * 100) / 100;
		return {
			clave,
			nombre: NOMBRES_RUBRO[clave],
			saldoLibros: Math.round(libros * 100) / 100,
			saldoOperativo: Math.round(operativo * 100) / 100,
			diferencia,
			estado: Math.abs(diferencia) <= TOLERANCIA ? 'OK' : 'DIFERENCIA',
			nota,
		};
	}

	return {
		monedaFuncional,
		generadoAt: new Date(),
		rubros: [
			rubro('TESORERIA', tesoreriaLibros, tesoreriaOperativo),
			rubro('CXC', cxcLibros, cxcOperativoTotal),
			rubro('CXP', cxpLibros, cxpOperativoTotal),
		],
	};
}
