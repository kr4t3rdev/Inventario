/**
 * @description Integración real (Phase 5, tareas 5.5 del change
 * remediacion-integridad-ventas-credito-fiscal): máquina de estados fiscal
 * contra PostgreSQL aislado con adaptadores falsos que cuentan invocaciones.
 *
 * Escenarios: dos claims de la misma factura (uno gana), emisión dirigida de B
 * no toca A, fallo post-envío → INCIERTA persistida (jamás reprocesada sola),
 * rechazo definitivo autenticado → RECHAZADA, CAS por attemptId.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { FiscalEmisionService } from '@/features/facturas/services/fiscal-emision-service';
import {
	FiscalRechazoDefinitivoError,
} from '@/features/facturas/services/fiscal/fiscal-adapter';
import type { FiscalAdapter } from '@/features/facturas/services/fiscal/fiscal-adapter';

const stamp = Date.now();
const tenantIds: string[] = [];

/** Adaptador falso que cuenta invocaciones externas y falla cuando se pide. */
function adapterFalso(opts: { falla?: 'generico' | 'definitivo' } = {}) {
	const invocaciones = { count: 0 };
	const adapter: FiscalAdapter = {
		jurisdiccion: 'TEST',
		async generar() {
			invocaciones.count += 1;
			if (opts.falla === 'generico') throw new Error('timeout simulado del PAC');
			if (opts.falla === 'definitivo') {
				throw new FiscalRechazoDefinitivoError('Rechazo autenticado', 'R-401');
			}
			return { uuidExterno: `TEST-${Date.now()}`, xml: '<x/>', folio: 'F-1' };
		},
	};
	return { adapter, invocaciones };
}

/** Crea tenant + factura PENDIENTE de fiscalizar. */
async function crearFacturaPendiente(numero: string) {
	const tenant = await prisma.tenant.create({
		data: { nombre: `F5 ${stamp}-${numero}`, slug: `f5-${stamp}-${numero}-${crypto.randomUUID().slice(0, 6)}`, fiscalActivado: true },
	});
	tenantIds.push(tenant.tenantId);
	const cliente = await prisma.cliente.create({
		data: { nombre: 'Cliente F5', tenantId: tenant.tenantId },
	});
	const serie = await prisma.serieFacturacion.create({
		data: { tenantId: tenant.tenantId, prefijo: 'FV', descripcion: 'Ventas', consecutivo: 1, esPorDefecto: true },
	});
	const factura = await prisma.factura.create({
		data: {
			tenantId: tenant.tenantId,
			serieId: serie.serieId,
			numeroConsecutivo: 1,
			numeroFactura: `FV-${numero}`,
			clienteId: cliente.clienteId,
			subtotal: 1000,
			descuento: 0,
			total: 1000,
			estado: 'PAGADA',
			creadoPor: 'tester',
		},
	});
	await FiscalEmisionService.registrarEmisionPendiente({
		tenantId: tenant.tenantId,
		factura: factura as never,
	});
	return { tenantId: tenant.tenantId, facturaId: factura.idFactura };
}

afterAll(async () => {
	for (const tenantId of tenantIds) {
		await prisma.fiscalEmisionEvent.deleteMany({ where: { tenantId } });
		await prisma.fiscalDocument.deleteMany({ where: { tenantId } });
		await prisma.factura.deleteMany({ where: { tenantId } });
		await prisma.cliente.deleteMany({ where: { tenantId } });
		await prisma.serieFacturacion.deleteMany({ where: { tenantId } });
		await prisma.tenant.deleteMany({ where: { tenantId } });
	}
	await prisma.$disconnect();
});

describe('máquina de estados fiscal dirigida e incierta (integración real)', () => {
	it('dos claims simultáneos de la misma factura: uno gana, el otro no invoca al proveedor', async () => {
		const { tenantId, facturaId } = await crearFacturaPendiente('000010');
		const a = adapterFalso();
		const b = adapterFalso();

		// Barrera: ambos claims compiten por el mismo PENDIENTE.
		const [r1, r2] = await Promise.allSettled([
			FiscalEmisionService.procesarFacturaPendiente({ tenantId, facturaId, adapter: a.adapter }),
			FiscalEmisionService.procesarFacturaPendiente({ tenantId, facturaId, adapter: b.adapter }),
		]);

		const ganadores = [r1, r2].filter((r) => r.status === 'fulfilled' && r.value !== null);
		expect(ganadores).toHaveLength(1);
		expect(a.invocaciones.count + b.invocaciones.count).toBe(1);

		const doc = await prisma.fiscalDocument.findUniqueOrThrow({ where: { facturaId } });
		expect(doc.estado).toBe('TIMBRADA');
		expect(doc.attemptId).toBeNull();
	});

	it('emisión dirigida de B deja intacta la factura A pendiente', async () => {
		const escenarioA = await crearFacturaPendiente('000020');
		const escenarioB = await crearFacturaPendiente('000021');
		const { adapter } = adapterFalso();

		const r = await FiscalEmisionService.procesarFacturaPendiente({
			tenantId: escenarioB.tenantId,
			facturaId: escenarioB.facturaId,
			adapter,
		});

		expect(r?.estado).toBe('TIMBRADA');
		const docA = await prisma.fiscalDocument.findUniqueOrThrow({
			where: { facturaId: escenarioA.facturaId },
		});
		expect(docA.estado).toBe('PENDIENTE');
	});

	it('fallo post-envío → INCIERTA persistida, con intento y evento; nunca reprocesada sola', async () => {
		const { tenantId, facturaId } = await crearFacturaPendiente('000030');
		const { adapter } = adapterFalso({ falla: 'generico' });

		const r = await FiscalEmisionService.procesarFacturaPendiente({ tenantId, facturaId, adapter });

		expect(r?.estado).toBe('INCIERTA');
		const doc = await prisma.fiscalDocument.findUniqueOrThrow({ where: { facturaId } });
		expect(doc.estado).toBe('INCIERTA');
		expect(doc.intentos).toBe(1);
		expect(doc.ultimoError).toContain('timeout simulado');
		const eventos = await prisma.fiscalEmisionEvent.findMany({
			where: { fiscalDocumentId: doc.fiscalDocumentId },
			orderBy: { createdAt: 'asc' },
		});
		expect(eventos.map((e) => e.estado)).toContain('INCIERTO');

		// La cola nunca la toca de nuevo.
		const cola = await FiscalEmisionService.procesarSiguientePendiente(tenantId, adapterFalso().adapter);
		expect(cola).toBeNull();
	});

	it('rechazo definitivo autenticado → RECHAZADA con código del proveedor', async () => {
		const { tenantId, facturaId } = await crearFacturaPendiente('000040');
		const { adapter } = adapterFalso({ falla: 'definitivo' });

		const r = await FiscalEmisionService.procesarFacturaPendiente({ tenantId, facturaId, adapter });

		expect(r?.estado).toBe('RECHAZADA');
		const doc = await prisma.fiscalDocument.findUniqueOrThrow({ where: { facturaId } });
		expect(doc.estado).toBe('RECHAZADA');
		const eventos = await prisma.fiscalEmisionEvent.findMany({
			where: { fiscalDocumentId: doc.fiscalDocumentId },
		});
		const rechazo = eventos.find((e) => e.estado === 'RECHAZADO');
		expect((rechazo?.detalle as { codigo?: string })?.codigo).toBe('R-401');
	});

	it('tenant cruzado: la factura ajena no existe para el procesamiento dirigido', async () => {
		const escenarioA = await crearFacturaPendiente('000050');
		const otroTenant = await crearFacturaPendiente('000051');
		const { adapter, invocaciones } = adapterFalso();

		// El tenant de A no ve el PENDIENTE de B.
		const r = await FiscalEmisionService.procesarFacturaPendiente({
			tenantId: escenarioA.tenantId,
			facturaId: otroTenant.facturaId,
			adapter,
		});

		expect(r).toBeNull();
		expect(invocaciones.count).toBe(0);
	});
});
