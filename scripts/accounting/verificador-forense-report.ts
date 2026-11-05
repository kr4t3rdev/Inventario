#!/usr/bin/env npx tsx
/**
 * @description Verificador forense autónomo de la capa formal (D3b).
 *
 * Lee el libro mayor y la base operativa del tenant, verifica la integridad
 * del ledger y deja un artefacto JSON reproducible. **SOLO LEE**: no escribe
 * nada en la base de datos.
 *
 * @usage
 *   pnpm exec tsx scripts/accounting/verificador-forense-report.ts --tenant <id> [--out <archivo.json>]
 *   pnpm exec tsx scripts/accounting/verificador-forense-report.ts --all-tenants [--out <archivo.json>]
 */
import { writeFile } from 'node:fs/promises';
import { resolve as resolverRuta } from 'node:path';
import { Prisma } from '@/generated/prisma';
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma';
import {
	verificarTenant,
	type AsientoVerificable,
	type EntradaVerificacion,
	type InformeForense,
	type SaldoOperativoVerificable,
} from './verificador-forense';

/** Argumentos admitidos por el CLI. */
interface Argumentos {
	tenantId?: string;
	todos: boolean;
	salida?: string;
}

/**
 * @description Parsea los argumentos del CLI.
 * @param {string[]} argv - Argumentos del proceso.
 * @returns {Argumentos} Argumentos normalizados.
 */
function parsearArgumentos(argv: string[]): Argumentos {
	const argumentos: Argumentos = { todos: false };
	for (let indice = 0; indice < argv.length; indice += 1) {
		const actual = argv[indice];
		if (actual === '--tenant') {
			argumentos.tenantId = argv[indice + 1];
			indice += 1;
		} else if (actual === '--all-tenants') {
			argumentos.todos = true;
		} else if (actual === '--out') {
			argumentos.salida = argv[indice + 1];
			indice += 1;
		}
	}
	return argumentos;
}

/**
 * @description Lee el libro mayor del tenant con sus líneas.
 * @param {string} tenantId - Tenant a inspeccionar.
 * @returns {Promise<AsientoVerificable[]>} Asientos crudos con sus líneas.
 */
async function leerAsientos(tenantId: string): Promise<AsientoVerificable[]> {
	const asientos = await prisma.asiento.findMany({
		where: { tenantId },
		include: { lineas: { orderBy: { orden: 'asc' } } },
		orderBy: { createdAt: 'asc' },
	});
	return asientos.map((asiento) => ({
		asientoId: asiento.asientoId,
		tenantId: asiento.tenantId,
		diarioId: asiento.diarioId,
		periodoId: asiento.periodoId,
		numero: asiento.numero,
		fecha: asiento.fecha,
		estado: asiento.estado,
		origenTipo: asiento.origenTipo,
		origenId: asiento.origenId,
		hash: asiento.hash,
		hashAnterior: asiento.hashAnterior,
		hashVersion: asiento.hashVersion,
		tenantSequence: asiento.tenantSequence,
		lineas: asiento.lineas.map((linea) => ({
			orden: linea.orden,
			cuentaId: linea.cuentaId,
			debe: linea.debe.toString(),
			haber: linea.haber.toString(),
			monedaOriginal: linea.monedaOriginal,
			montoOriginal: linea.montoOriginal.toString(),
			tasaCambio: linea.tasaCambio == null ? null : linea.tasaCambio.toString(),
			fxEvidenceFingerprint: linea.fxEvidenceFingerprint,
		})),
	}));
}

/**
 * @description Calcula el saldo operativo en moneda funcional de un rol contable.
 * @param {string} tenantId - Tenant inspeccionado.
 * @param {string} rol - Rol contable ('CXC_CLIENTES' o 'CXP_PROVEEDORES').
 * @returns {Promise<SaldoOperativoVerificable>} Saldo operativo o su causa de no evaluabilidad.
 */
async function leerSaldoOperativo(
	tenantId: string,
	rol: 'CXC_CLIENTES' | 'CXP_PROVEEDORES',
): Promise<SaldoOperativoVerificable> {
	if (rol === 'CXC_CLIENTES') {
		const cuentas = await prisma.cuentaPorCobrar.findMany({
			where: { tenantId },
			select: {
				montoDeuda: true,
				montoPagado: true,
				montoDeudaFuncional: true,
				montoPagadoFuncional: true,
			},
		});
		if (cuentas.length === 0) {
			return { rol, saldo: '0', registros: 0 };
		}
		const sinEvidencia = cuentas.filter(
			(cuenta) => cuenta.montoDeudaFuncional == null || cuenta.montoPagadoFuncional == null,
		);
		if (sinEvidencia.length > 0) {
			return {
				rol,
				saldo: null,
				registros: cuentas.length,
				causaNoEvaluable: `${sinEvidencia.length} cuentas por cobrar sin importe funcional`,
			};
		}
		const saldo = cuentas.reduce(
			(total, cuenta) =>
				total
					.add(cuenta.montoDeudaFuncional as never)
					.sub(cuenta.montoPagadoFuncional as never),
			new Prisma.Decimal(0),
		);
		return { rol, saldo: saldo.toString(), registros: cuentas.length };
	}

	const cuentas = await prisma.cuentaPorPagar.findMany({
		where: { tenantId },
		select: {
			montoDeuda: true,
			montoPagado: true,
			montoDeudaFuncional: true,
			montoPagadoFuncional: true,
		},
	});
	if (cuentas.length === 0) {
		return { rol, saldo: '0', registros: 0 };
	}
	const sinEvidencia = cuentas.filter(
		(cuenta) => cuenta.montoDeudaFuncional == null || cuenta.montoPagadoFuncional == null,
	);
	if (sinEvidencia.length > 0) {
		return {
			rol,
			saldo: null,
			registros: cuentas.length,
			causaNoEvaluable: `${sinEvidencia.length} cuentas por pagar sin importe funcional`,
		};
	}
	const saldo = cuentas.reduce(
		(total, cuenta) =>
			total.add(cuenta.montoDeudaFuncional as never).sub(cuenta.montoPagadoFuncional as never),
		new Prisma.Decimal(0),
	);
	return { rol, saldo: saldo.toString(), registros: cuentas.length };
}

/**
 * @description Reúne la entrada de verificación de un tenant.
 * @param {string} tenantId - Tenant a inspeccionar.
 * @returns {Promise<EntradaVerificacion>} Entrada lista para verificar.
 */
async function reunirEntrada(tenantId: string): Promise<EntradaVerificacion> {
	const [asientos, roles, politica, saldosOperativos] = await Promise.all([
		leerAsientos(tenantId),
		prisma.cuentaRolTenant.findMany({
			where: { tenantId },
			select: { rol: true, cuentaId: true },
		}),
		prisma.tenantAccountingPolicy.findUnique({
			where: { tenantId },
			select: { functionalCurrencyCode: true },
		}),
		Promise.all([
			leerSaldoOperativo(tenantId, 'CXC_CLIENTES'),
			leerSaldoOperativo(tenantId, 'CXP_PROVEEDORES'),
		]),
	]);

	const cuentaPorRol: Record<string, string> = {};
	for (const rol of roles) {
		cuentaPorRol[rol.rol] = rol.cuentaId;
	}

	return {
		tenantId,
		monedaFuncional: politica?.functionalCurrencyCode ?? null,
		asientos,
		cuentaPorRol,
		saldosOperativos,
	};
}

/**
 * @description Punto de entrada del verificador.
 * @returns {Promise<void>} Finaliza el proceso con código 1 si hay hallazgos.
 */
async function main(): Promise<void> {
	const argumentos = parsearArgumentos(process.argv.slice(2));
	if (!argumentos.tenantId && !argumentos.todos) {
		console.error('Uso: --tenant <id> | --all-tenants [--out <archivo.json>]');
		process.exitCode = 2;
		return;
	}

	const tenantIds = argumentos.todos
		? (await prisma.tenant.findMany({ select: { tenantId: true }, orderBy: { tenantId: 'asc' } })).map(
				(tenant) => tenant.tenantId,
			)
		: [argumentos.tenantId as string];

	const informes: InformeForense[] = [];
	for (const tenantId of tenantIds) {
		const entrada = await reunirEntrada(tenantId);
		const informe = verificarTenant(entrada);
		informes.push(informe);
		console.log(
			`[verificador] ${tenantId}: ${informe.resumen.asientos} asientos, ` +
				`${informe.resumen.hallazgos} hallazgos, cadena ${informe.resumen.integridadCadena}`,
		);
	}

	const artefacto = {
		generadoEn: new Date().toISOString(),
		verificador: 'verificador-forense',
		version: 1,
		tenants: informes,
	};

	if (argumentos.salida) {
		const ruta = resolverRuta(argumentos.salida);
		await writeFile(ruta, `${JSON.stringify(artefacto, null, 2)}\n`, 'utf8');
		console.log(`[verificador] artefacto escrito en ${ruta}`);
	} else {
		console.log(JSON.stringify(artefacto, null, 2));
	}

	const totalHallazgos = informes.reduce((total, informe) => total + informe.resumen.hallazgos, 0);
	if (totalHallazgos > 0) process.exitCode = 1;
}

main().catch((error) => {
	console.error('[verificador] fallo la verificación:', error);
	process.exitCode = 2;
});
