/**
 * @description Ejercita en produccion la liquidacion de una deuda cash
 * heredada (dato previo a la restriction de plan) y verifica el asiento
 * formal que deja el writer contable compartido.
 *
 * Secuencia:
 * 1. Habilita el flag `contabilidad-formal` en la licencia del tenant
 *    (override explicito, reversible) para que la capa formal escriba.
 * 2. Inserta la deuda heredada (CuentaPorPagar + DeudaCash) directamente en
 *    base de datos: es el patron de los datos heredados, que el tenant ya no
 *    puede crear porque el plan no habilita `deudas-cash`.
 * 3. Registra el pago contra la API real de produccion con una sesion
 *    efimera de manager (equivale a un login).
 * 4. Verifica reconciliacion, saldo bancario, cuota pagada, estado de la
 *    deuda, asiento formal (partida doble, estado, hash y cadena) y auditoria.
 *
 * Uso:
 *   DATABASE_URL=<url publica de produccion> JWT_SECRET=<secreto> \
 *   node --import tsx scripts/ops/exercise-cash-debt-liquidation-production.ts \
 *   --tenant <tenantId> [--base-url <url>] [--monto <importe>]
 */
import jwt from 'jsonwebtoken';
import { prismaPlatform as prisma } from '@/lib/db/platform-prisma';
import { Prisma } from '@/generated/prisma';
import { validateHashChain } from '@/features/contabilidad-formal/services/hash-chain-integrity';
import { construirHashAsientoV2 } from '@/features/contabilidad-formal/services/posting-engine';

const BASE_URL_POR_DEFECTO = 'https://financemdm.kr4t3rdev.xyz';
const MONEDA = 'CUP';

interface Opciones {
	tenantId: string;
	baseUrl: string;
	monto: number;
}

/**
 * @description Parsea los argumentos de linea de comandos del script.
 * @param {string[]} argv - Argumentos sin el nombre del ejecutable.
 * @returns {Opciones} Opciones normalizadas.
 */
function parseArgs(argv: string[]): Opciones {
	const args = argv.slice(2);
	const tenantIndex = args.indexOf('--tenant');
	const tenantId = tenantIndex >= 0 ? args[tenantIndex + 1] : undefined;
	if (!tenantId) throw new Error('Falta --tenant <tenantId>');
	const urlIndex = args.indexOf('--base-url');
	const montoIndex = args.indexOf('--monto');
	return {
		tenantId,
		baseUrl: urlIndex >= 0 ? (args[urlIndex + 1] ?? BASE_URL_POR_DEFECTO) : BASE_URL_POR_DEFECTO,
		monto: montoIndex >= 0 ? Number(args[montoIndex + 1]) : 1000,
	};
}

/**
 * @description Habilita el flag `contabilidad-formal` en la licencia activa.
 * @param {string} tenantId - Tenant objetivo.
 * @returns {Promise<boolean>} Verdadero si el override quedo aplicado.
 */
async function habilitarCapaFormal(tenantId: string): Promise<boolean> {
	const licencia = await prisma.tenantLicense.findFirst({
		where: { tenantId, activa: true, expiracion: { gt: new Date() } },
		select: { tenantLicenseId: true, featureOverrides: true },
		orderBy: { inicio: 'desc' },
	});
	if (!licencia) throw new Error('El tenant no tiene licencia activa');
	const overrides = (licencia.featureOverrides ?? {}) as Record<string, boolean>;
	if (overrides['contabilidad-formal'] === true) return false;
	await prisma.tenantLicense.update({
		where: { tenantLicenseId: licencia.tenantLicenseId },
		data: { featureOverrides: { ...overrides, 'contabilidad-formal': true } },
	});
	return true;
}

/**
 * @description Inserta la deuda heredada que se liquidara: cuota por pagar y
 * deuda cash con la politica de interes versionada completa.
 * @param {string} tenantId - Tenant objetivo.
 * @param {Prisma.Decimal} monto - Capital de la deuda.
 * @param {string} actorId - Usuario que figura como creador del registro.
 * @returns {Promise<{ deudaId: string; cuentaPorPagarId: string; numeroFactura: string }>} Identificadores creados.
 */
async function insertarDeudaHeredada(
	tenantId: string,
	monto: Prisma.Decimal,
	actorId: string,
): Promise<{ deudaId: string; cuentaPorPagarId: string; numeroFactura: string; reutilizada: boolean }> {
	const existente = await prisma.deudaCash.findFirst({
		where: { tenantId, estado: 'ACTIVO', deletedAt: null },
		select: { id: true, cuentaPorPagar: { select: { cuentaPorPagarId: true, numeroFactura: true, saldoPendiente: true } } },
		orderBy: { createdAt: 'desc' },
	});
	if (existente && new Prisma.Decimal(existente.cuentaPorPagar.saldoPendiente).equals(monto)) {
		return {
			deudaId: existente.id,
			cuentaPorPagarId: existente.cuentaPorPagar.cuentaPorPagarId,
			numeroFactura: existente.cuentaPorPagar.numeroFactura ?? 'n/d',
			reutilizada: true,
		};
	}
	const proveedor = await prisma.vendor.findFirst({
		where: { tenantId },
		select: { vendorId: true, nombre: true },
		orderBy: { createdAt: 'asc' },
	});
	if (!proveedor) throw new Error('El tenant no tiene proveedores para la deuda heredada');
	const numeroFactura = `HEREDADA-${Date.now()}`;
	const emision = new Date('2026-09-01T00:00:00.000Z');
	const cuota = await prisma.cuentaPorPagar.create({
		data: {
			tenantId,
			numeroFactura,
			proveedorId: proveedor.vendorId,
			proveedorNombre: proveedor.nombre,
			montoDeuda: monto,
			montoPagado: 0,
			montoDeudaFuncional: monto,
			montoPagadoFuncional: 0,
			monedaOriginal: MONEDA,
			monedaFuncional: MONEDA,
			tasaCambio: 1,
			saldoPendiente: monto,
			moneda: MONEDA,
			estado: 'PENDIENTE',
			tipo: 'compra',
			tipoDeuda: 'DEUDA_CASH',
			fechaEmision: emision,
		},
		select: { cuentaPorPagarId: true },
	});
	const deuda = await prisma.deudaCash.create({
		data: {
			tenantId,
			proveedorId: proveedor.vendorId,
			cuentaPorPagarId: cuota.cuentaPorPagarId,
			montoCapital: monto,
			moneda: MONEDA,
			tasaInteres: 0,
			fechaVencimiento: null,
			createdById: actorId,
			estado: 'ACTIVO',
			ordinaryAnnualRate: 0,
			moratoryAnnualRate: 0,
			cashInterestPolicyVersion: 1,
			cashInterestGrantDate: emision,
			cashInterestMaturityDate: null,
			cashInterestAccruedThroughDate: emision,
			cashInterestPrincipalRemaining: monto,
			cashInterestOrdinaryCarry: 0,
			cashInterestMoratoryCarry: 0,
			observaciones: 'Deuda heredada de la cadena #62 (verificacion de liquidacion).',
		},
		select: { id: true },
	});
	return { deudaId: deuda.id, cuentaPorPagarId: cuota.cuentaPorPagarId, numeroFactura, reutilizada: false };
}

/**
 * @description Crea la sesion efimera del manager del tenant.
 * @param {string} tenantId - Tenant del actor.
 * @returns {Promise<{ token: string; sessionId: string; userId: string }>} Datos de la sesion.
 */
async function crearSesion(
	tenantId: string,
): Promise<{ token: string; sessionId: string; userId: string }> {
	const secret = process.env.JWT_SECRET;
	if (!secret) throw new Error('JWT_SECRET es obligatoria');
	const membresia = await prisma.tenantMembership.findFirst({
		where: { tenantId, isActive: true },
		select: { userId: true, tenantRole: true, user: { select: { email: true } } },
	});
	if (!membresia) throw new Error(`El tenant ${tenantId} no tiene membresia activa`);
	const token = jwt.sign(
		{
			userId: membresia.userId,
			email: membresia.user?.email ?? '',
			tenantId,
			tenantRole: membresia.tenantRole,
		},
		secret,
		{ expiresIn: '30m' },
	);
	const sesion = await prisma.userSession.create({
		data: {
			userId: membresia.userId,
			token,
			isActive: true,
			expiresAt: new Date(Date.now() + 30 * 60 * 1000),
			userAgent: 'ops-liquidacion-deuda-cash',
		},
		select: { id: true },
	});
	return { token, sessionId: sesion.id, userId: membresia.userId };
}

/**
 * @description Ejecuta el flujo completo de liquidacion y su verificacion.
 * @param {Opciones} opciones - Opciones de ejecucion.
 * @returns {Promise<void>} Resuelve cuando termina la verificacion.
 */
async function main(): Promise<void> {
	const { tenantId, baseUrl, monto } = parseArgs(process.argv);
	const montoDecimal = new Prisma.Decimal(monto);
	console.log(`\n=== Liquidacion de deuda cash heredada: ${tenantId} ===`);
	console.log(`destino: ${baseUrl} | monto: ${montoDecimal.toString()} ${MONEDA}`);

	const flagAplicado = await habilitarCapaFormal(tenantId);
	console.log(`flag contabilidad-formal: ${flagAplicado ? 'habilitado en la licencia' : 'ya estaba activo'}`);

	const sesion = await crearSesion(tenantId);
	try {
		const deuda = await insertarDeudaHeredada(tenantId, montoDecimal, sesion.userId);
		console.log(
			`deuda heredada ${deuda.reutilizada ? 'reutilizada' : 'creada'}: ${deuda.deudaId} (cuota ${deuda.cuentaPorPagarId}, factura ${deuda.numeroFactura})`,
		);

		const banco = await prisma.cuentaBancaria.findFirst({
			where: { tenantId, isActive: true, moneda: MONEDA },
			select: { cuentaId: true, nombreBanco: true, saldo: true },
			orderBy: { createdAt: 'asc' },
		});
		if (!banco) throw new Error('El tenant no tiene cuenta bancaria activa en CUP');
		const tipoPago = await prisma.tipoPago.findFirst({
			where: { tenantId, isActive: true },
			select: { tipoId: true, nombre: true },
			orderBy: { createdAt: 'asc' },
		});
		if (!tipoPago) throw new Error('El tenant no tiene tipo de pago activo');
		console.log(`cuenta ${banco.cuentaId} (${banco.nombreBanco}, saldo ${banco.saldo}) | tipoPago ${tipoPago.nombre}`);

		const idempotencyKey = `ops-liquidacion-${deuda.deudaId.slice(-8)}`;
		const respuesta = await fetch(`${baseUrl}/api/contabilidad/deudas-cash/${deuda.deudaId}/pagar`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${sesion.token}`,
				Cookie: `auth_token=${sesion.token}`,
				'User-Agent': 'ops-liquidacion-deuda-cash',
			},
			body: JSON.stringify({
				monto: montoDecimal.toNumber(),
				cuentaId: banco.cuentaId,
				tipoPagoId: tipoPago.tipoId,
				moneda: MONEDA,
				observaciones: 'Liquidacion de deuda heredada (cadena #62).',
				idempotencyKey,
			}),
		});
		const cuerpo = await respuesta.json().catch(() => ({}));
		console.log(`respuesta pago: HTTP ${respuesta.status}`);
		console.log(JSON.stringify(cuerpo).slice(0, 700));

		// ── Verificacion contable ─────────────────────────────────────────────
		const reconciliacion = await prisma.reconciliacionVenta.findFirst({
			where: { tenantId, idempotencyKey: `cash-payment:${idempotencyKey}` },
			select: {
				reconciliacionId: true,
				monto: true,
				moneda: true,
				montoConvertido: true,
				tipoReconciliacion: true,
				deudaCashId: true,
				fechaReconciliacion: true,
			},
		});
		const bancoDespues = await prisma.cuentaBancaria.findUnique({
			where: { cuentaId: banco.cuentaId },
			select: { saldo: true },
		});
		const cuotaDespues = await prisma.cuentaPorPagar.findUnique({
			where: { cuentaPorPagarId: deuda.cuentaPorPagarId },
			select: {
				montoDeuda: true,
				montoPagado: true,
				saldoPendiente: true,
				estado: true,
			},
		});
		const deudaDespues = await prisma.deudaCash.findUnique({
			where: { id: deuda.deudaId },
			select: { estado: true, cashInterestPrincipalRemaining: true },
		});
		const asientos = await prisma.asiento.findMany({
			where: { tenantId },
			orderBy: { tenantSequence: 'asc' },
			select: {
				asientoId: true,
				tenantId: true,
				tenantSequence: true,
				diarioId: true,
				periodoId: true,
				numero: true,
				estado: true,
				descripcion: true,
				fecha: true,
				origenTipo: true,
				origenId: true,
				hash: true,
				hashAnterior: true,
				hashVersion: true,
				lineas: {
					select: {
						orden: true,
						cuentaId: true,
						debe: true,
						haber: true,
						monedaOriginal: true,
						montoOriginal: true,
						tasaCambio: true,
						cuenta: { select: { codigo: true, nombre: true } },
					},
					orderBy: { orden: 'asc' },
				},
			},
		});
		const auditoria = await prisma.auditLog.findMany({
			where: { entidad: 'PAGO_DEUDA', entidadId: reconciliacion?.reconciliacionId ?? '__sin_reconciliacion__' },
			orderBy: { createdAt: 'desc' },
			take: 3,
			select: { usuarioId: true, createdAt: true, detalles: true },
		});

		console.log('\n-- verificacion --');
		console.log(
			`reconciliacion: ${reconciliacion?.reconciliacionId ?? 'n/d'} tipo=${reconciliacion?.tipoReconciliacion} monto=${reconciliacion?.monto ?? 'n/d'} ${reconciliacion?.moneda ?? ''} funcional=${reconciliacion?.montoConvertido ?? 'n/d'}`,
		);
		console.log(
			`banco: ${banco.saldo} -> ${bancoDespues?.saldo} | cuota pagada=${cuotaDespues?.montoPagado} pendiente=${cuotaDespues?.saldoPendiente} estado=${cuotaDespues?.estado} | deuda=${deudaDespues?.estado}`,
		);
		console.log(`asientos formales del tenant: ${asientos.length}`);
		for (const asiento of asientos) {
			const totalDebe = asiento.lineas.reduce(
				(total, linea) => total.plus(new Prisma.Decimal(linea.debe)),
				new Prisma.Decimal(0),
			);
			const totalHaber = asiento.lineas.reduce(
				(total, linea) => total.plus(new Prisma.Decimal(linea.haber)),
				new Prisma.Decimal(0),
			);
			console.log(
				`  ${asiento.tenantSequence} ${asiento.asientoId} ${asiento.estado} ${asiento.fecha.toISOString().slice(0, 10)} ${asiento.descripcion} origen=${asiento.origenTipo}/${asiento.origenId} debe=${totalDebe.toString()} haber=${totalHaber.toString()} lineas=${asiento.lineas.length}`,
			);
			console.log(`    hash=${asiento.hash?.slice(0, 16)}... anterior=${asiento.hashAnterior?.slice(0, 16) ?? 'null'} version=${asiento.hashVersion}`);
			for (const linea of asiento.lineas) {
				console.log(
					`    ${String(linea.orden).padStart(2, '0')} ${linea.cuenta.codigo} ${linea.cuenta.nombre} debe=${linea.debe} haber=${linea.haber} (original ${linea.monedaOriginal} ${linea.montoOriginal}${linea.tasaCambio ? ` @ ${linea.tasaCambio}` : ''})`,
				);
			}
		}
		const cadena = validateHashChain(asientos, construirHashAsientoV2 as never);
		console.log(
			`cadena de hash: ${cadena.valid ? 'valida' : `INVALIDA (fallo en ${cadena.failureId})`} | nodos=${cadena.ordered.length}`,
		);
		console.log(`auditorias PAGO_DEUDA: ${auditoria.length}`);
		for (const entry of auditoria) {
			console.log(`  ${entry.createdAt.toISOString()} ${JSON.stringify(entry.detalles).slice(0, 220)}`);
		}
	} finally {
		await prisma.userSession.delete({ where: { id: sesion.sessionId } });
		console.log('\nsesion efimera eliminada');
	}
}

main()
	.then(async () => {
		await prisma.$disconnect();
		process.exit(0);
	})
	.catch(async (error: unknown) => {
		console.error('\nERROR:', error instanceof Error ? error.message : error);
		await prisma.$disconnect();
		process.exit(1);
	});
