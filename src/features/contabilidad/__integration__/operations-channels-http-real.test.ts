/**
 * @description R6 filas 17–20 — canales HTTP reales de operaciones contables
 * (transferencia, ajuste, inyección de capital) con sesión Bearer real
 * (JWT firmado + UserSession + membresía manager + licencia activa), modo
 * enforce y un asiento formal por operación con el actor del usuario.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

import { getJwtSecret } from '@/lib/secrets';
import { prisma } from '@/lib/prisma';
import {
	seedPlanContable,
	seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { POST as postTransferencia } from '@/app/api/mobile/v1/accounting/bank-transfers/route';
import { POST as postAjuste } from '@/app/api/mobile/v1/accounting/bank-adjustments/route';
import { POST as postCapital } from '@/app/api/mobile/v1/accounting/capital-injections/route';
import { POST as postPagoCapital } from '@/app/api/mobile/v1/accounting/capital-injections/[id]/payments/route';
import { POST as postTransferenciaWeb } from '@/app/api/contabilidad/transferencias/route';

vi.mock('@/lib/services/audit-log-service', () => ({
	AuditLogService: { log: async () => undefined, logStrict: async () => undefined },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const prefix = `ops-http-${crypto.randomUUID().replaceAll('-', '')}`;
let tenantId = '';
let userId = '';
let token = '';
let cuentaA = '';
let cuentaB = '';
let tipoPagoId = '';
const originalMode = process.env.CONTABILIDAD_FORMAL_MODE;

function authed(url: string, body: Record<string, unknown>, withToken = true) {
	return new NextRequest(url, {
		method: 'POST',
		headers: withToken ? { authorization: `Bearer ${token}` } : {},
		body: JSON.stringify(body),
	});
}

describe('operaciones contables — canales HTTP reales (filas 17–20)', { timeout: 60_000 }, () => {
	beforeAll(async () => {
		const target = new URL(process.env.DATABASE_URL ?? '');
		const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
			SELECT current_database() AS db, inet_server_port() AS port`;
		expect(identity[0]).toMatchObject({
			db: target.pathname.slice(1),
			port: Number(target.port),
		});
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';

		await prisma.moneda.upsert({
			where: { codigo: 'CUP' },
			create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
			update: {},
		});
		const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
		tenantId = tenant.tenantId;
		const plan = await prisma.plan.create({
			data: {
				nombre: prefix, duracionDias: 365,
				features: {
					'contabilidad-formal': true, contabilidad: true,
					'transferencias-bancarias': true, 'inyeccion-capital': true,
				},
			},
		});
		const user = await prisma.user.create({
			data: { name: `${prefix}-user`, email: `${prefix}@test.local`, password: 'x' },
		});
		userId = user.userId;
		await prisma.tenantMembership.create({
			data: { tenantId, userId, tenantRole: 'manager' },
		});
		await prisma.tenantLicense.create({
			data: { tenantId, planId: plan.planId, activa: true, expiracion: new Date('2099-01-01') },
		});
		// Política contable requerida por los writers y el guard fail-closed del motor.
		await prisma.tenantAccountingPolicy.create({
			data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
		});
		token = jwt.sign({ userId, email: user.email, tenantId }, getJwtSecret());
		await prisma.userSession.create({
			data: { userId, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
		});

		cuentaA = (await prisma.cuentaBancaria.create({
			data: {
				tenantId, nombreBanco: 'Banco A', numeroCuenta: `A-${prefix.slice(-8)}`,
				tipoCuenta: 'CORRIENTE', saldo: 5000, moneda: 'CUP',
			},
		})).cuentaId;
		cuentaB = (await prisma.cuentaBancaria.create({
			data: {
				tenantId, nombreBanco: 'Banco B', numeroCuenta: `B-${prefix.slice(-8)}`,
				tipoCuenta: 'CORRIENTE', saldo: 0, moneda: 'CUP',
			},
		})).cuentaId;
		tipoPagoId = (await prisma.tipoPago.create({
			data: { tenantId, nombre: 'Efectivo ops', cuentaDefecto: cuentaA },
		})).tipoId;

		await prisma.$transaction(async (tx) => seedPlanContable(tx, tenantId));
		await prisma.$transaction(async (tx) => seedPlantillasGlobales(tx));
		const now = new Date();
		const inicio = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
		const fin = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1);
		await prisma.periodoContable.create({
			data: {
				tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
				codigo: `OPS-${prefix.slice(-8)}`, fechaInicio: inicio, fechaFin: fin,
			},
		});
	});

	afterAll(async () => {
		delete process.env.CONTABILIDAD_FORMAL_MODE;
		if (originalMode !== undefined) process.env.CONTABILIDAD_FORMAL_MODE = originalMode;
		if (!tenantId) return;
		await prisma.shadowPosteoOutbox.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.asiento.deleteMany({ where: { tenantId } });
		await prisma.transferenciaBancaria.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.ajusteBancario.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.inyeccionCapital.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.cuentaBancaria.deleteMany({ where: { tenantId } });
		await prisma.tipoPago.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.userSession.deleteMany({ where: { userId } }).catch(() => undefined);
		await prisma.tenantMembership.deleteMany({ where: { tenantId } });
		await prisma.tenantLicense.deleteMany({ where: { tenantId } });
		await prisma.user.delete({ where: { userId } }).catch(() => undefined);
		await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
		await prisma.cuentaContable.updateMany({ where: { tenantId }, data: { padreId: null } });
		await prisma.cuentaContable.deleteMany({ where: { tenantId } });
		await prisma.diario.deleteMany({ where: { tenantId } });
		await prisma.periodoContable.deleteMany({ where: { tenantId } });
		await prisma.plan.deleteMany({ where: { nombre: prefix } }).catch(() => undefined);
		await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId } }).catch(() => undefined);
		await prisma.tenant.delete({ where: { tenantId } }).catch(() => undefined);
	});

	it('rejects requests without a Bearer session (401) on the three channels', async () => {
		const [t, a, c] = await Promise.all([
			postTransferencia(authed('http://localhost/api/mobile/v1/accounting/bank-transfers',
				{ cuentaOrigenId: cuentaA, cuentaDestinoId: cuentaB, montoOrigen: 100 }, false)),
			postAjuste(authed('http://localhost/api/mobile/v1/accounting/bank-adjustments',
				{ cuentaId: cuentaA, tipo: 'ingreso', monto: 10, moneda: 'CUP' }, false)),
			postCapital(authed('http://localhost/api/mobile/v1/accounting/capital-injections',
				{ montoRecibido: 100, moneda: 'CUP', cuentaId: cuentaA }, false)),
		]);
		expect(t.status).toBe(401);
		expect(a.status).toBe(401);
		expect(c.status).toBe(401);
	});

	it('posts one formal asiento per operation with the real actor in enforce', async () => {
		const transfer = await postTransferencia(authed(
			'http://localhost/api/mobile/v1/accounting/bank-transfers',
			{ cuentaOrigenId: cuentaA, cuentaDestinoId: cuentaB, montoOrigen: 250, motivo: 'Transferencia real' },
		));
		const transferBody = await transfer.json();
		expect(transfer.status, JSON.stringify(transferBody)).toBe(200);

		const asientosTransferencia = await prisma.asiento.findMany({
			where: { tenantId, origenTipo: 'transferencia_bancaria' },
		});
		expect(asientosTransferencia).toHaveLength(1);
		expect(asientosTransferencia[0].createdBy).toBe(userId);

		const ajuste = await postAjuste(authed(
			'http://localhost/api/mobile/v1/accounting/bank-adjustments',
			{ cuentaId: cuentaA, tipo: 'ingreso', monto: 40, moneda: 'CUP',
				descripcion: 'Ajuste real', motivo: 'Corrección de caja' },
		));
		expect(ajuste.status).toBe(200);
		expect(await prisma.asiento.count({
			where: { tenantId, origenTipo: 'ajuste_bancario' },
		})).toBe(1);

		const capital = await postCapital(authed(
			'http://localhost/api/mobile/v1/accounting/capital-injections',
			{ montoRecibido: 1000, moneda: 'CUP', cuentaId: cuentaB, descripcion: 'Capital real',
				tipo: 'CAPITAL_SOCIAL', socio: 'Socio Test' },
		));
		const capitalBody = await capital.json();
		expect(capital.status, JSON.stringify(capitalBody)).toBe(200);
		expect(await prisma.asiento.count({
			where: { tenantId, origenTipo: 'inyeccion_capital' },
		})).toBe(1);

		// Cobertura de eventos: 3 orígenes distintos del mismo tenant, todos cuadrados.
		const asientos = await prisma.asiento.findMany({
			where: { tenantId }, include: { lineas: true },
		});
		for (const asiento of asientos) {
			const debe = asiento.lineas.reduce((acc, l) => acc + Number(l.debe), 0);
			const haber = asiento.lineas.reduce((acc, l) => acc + Number(l.haber), 0);
			expect(debe).toBe(haber);
		}
	});

	it('web transfer endpoint delegates to the same tenant-scoped formal writer', async () => {
		const saldoOrigenAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: cuentaA },
		})).saldo);
		const saldoDestinoAntes = Number((await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: cuentaB },
		})).saldo);
		const response = await postTransferenciaWeb(new NextRequest(
			'http://localhost/api/contabilidad/transferencias', {
				method: 'POST',
				headers: { authorization: `Bearer ${token}` },
				body: JSON.stringify({
					cuentaOrigenId: cuentaA,
					cuentaDestinoId: cuentaB,
					montoOrigen: 75,
					motivo: 'Transferencia web formal',
				}),
			},
		));
		const body = await response.json();
		expect(response.status, JSON.stringify(body)).toBe(201);
		expect(body.transferencia.transferenciaId).toBeTruthy();
		expect(await prisma.asiento.count({
			where: {
				tenantId,
				origenTipo: 'transferencia_bancaria',
				origenId: body.transferencia.transferenciaId,
			},
		})).toBe(1);
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: cuentaA } }))
			.saldo.toString()).toBe(String(saldoOrigenAntes - 75));
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: cuentaB } }))
			.saldo.toString()).toBe(String(saldoDestinoAntes + 75));
	});

	it('serializes concurrent PAGO_DEUDA_CAPITAL requests through the real Bearer channel', async () => {
		// Deuda externa creada por canal real; dos pagos mayores que el saldo
		// restante no pueden sobrepagar ni duplicar asiento/tesorería.
		const deuda = await postCapital(authed(
			'http://localhost/api/mobile/v1/accounting/capital-injections',
			{
				montoRecibido: 500, moneda: 'CUP', cuentaId: cuentaA,
				descripcion: 'Deuda real', tipo: 'DEUDA_EXTERNA',
				entidadPrestamista: 'Prestamista Test', tasaInteres: 0,
			},
		));
		const deudaBody = await deuda.json();
		expect(deuda.status, JSON.stringify(deudaBody)).toBe(200);
		const deudaId = deudaBody?.id ?? deudaBody?.inyeccionId ?? deudaBody?.data?.id;
		expect(deudaId).toBeTruthy();

		const saldoAntes = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: cuentaA },
		})).saldo;
		const respuestas = await Promise.all([
			postPagoCapital(
				authed('http://localhost/api/mobile/v1/accounting/capital-injections/x/payments',
					{ monto: 350, moneda: 'CUP', cuentaBancariaId: cuentaA, tipoPagoId }),
				{ params: Promise.resolve({ id: deudaId }) } as never,
			),
			postPagoCapital(
				authed('http://localhost/api/mobile/v1/accounting/capital-injections/x/payments',
					{ monto: 350, moneda: 'CUP', cuentaBancariaId: cuentaA, tipoPagoId }),
				{ params: Promise.resolve({ id: deudaId }) } as never,
			),
		]);
		const respuestasJson = await Promise.all(respuestas.map(async (response) => ({
			status: response.status,
			body: await response.clone().json(),
		})));
		expect(respuestas.map((response) => response.status).sort()).toEqual([200, 400]);
		expect(respuestasJson.find((response) => response.status === 400)?.body)
			.toMatchObject({ code: 'VALIDATION_ERROR' });
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: cuentaA },
		})).saldo.toString()).toBe((Number(saldoAntes) - 350).toString());
		expect(await prisma.pagoDeuda.count({ where: { inyeccionId: deudaId } })).toBe(1);
		expect((await prisma.inyeccionCapital.findUniqueOrThrow({ where: { id: deudaId } }))
			.saldoPendiente.toString()).toBe('150');

		const asientosPago = await prisma.asiento.findMany({
			where: { tenantId, origenTipo: 'pago_deuda_capital' },
		});
		expect(asientosPago).toHaveLength(1);
		expect(asientosPago[0].createdBy).toBe(userId);
	});

	it('reintento de transferencia con mismo comprobante devuelve 409 sin duplicar (C3/G2)', async () => {
		const comprobante = `TRF-RETRY-${crypto.randomUUID().slice(0, 8)}`;
		const body = {
			cuentaOrigenId: cuentaA,
			cuentaDestinoId: cuentaB,
			montoOrigen: 25,
			motivo: 'Transferencia idempotente',
			numeroComprobante: comprobante,
		};
		const post = () => postTransferenciaWeb(new NextRequest(
			'http://localhost/api/contabilidad/transferencias', {
				method: 'POST',
				headers: { authorization: `Bearer ${token}` },
				body: JSON.stringify(body),
			},
		));

		const primera = await post();
		expect(primera.status, await primera.clone().text()).toBe(201);

		const reintento = await post();
		expect(reintento.status).toBe(409);
		expect(await reintento.json()).toMatchObject({ code: 'TRANSFERENCIA_DUPLICADA' });

		expect(await prisma.transferenciaBancaria.count({
			where: { tenantId, numeroComprobante: comprobante },
		})).toBe(1);
	});
});
