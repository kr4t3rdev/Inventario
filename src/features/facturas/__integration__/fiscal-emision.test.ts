/**
 * @description Integración real (FE-T5): una factura en DB → en el runner con
 * LocalAdapter el documento fiscal termina TIMBRADA con uuid y XML.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { FiscalEmisionService } from '@/features/facturas/services/fiscal-emision-service';
import { LocalAdapter } from '@/features/facturas/services/fiscal/local-adapter';

const stamp = Date.now();

describe('emisión fiscal con LocalAdapter (integración real)', { timeout: 30_000 }, () => {
	afterAll(async () => {
		await prisma.fiscalEmisionEvent.deleteMany({ where: { tenant: { slug: `fe-${stamp}` } } });
		await prisma.fiscalDocument.deleteMany({ where: { tenant: { slug: `fe-${stamp}` } } });
		await prisma.factura.deleteMany({ where: { tenant: { slug: `fe-${stamp}` } } });
		await prisma.cliente.deleteMany({ where: { tenant: { slug: `fe-${stamp}` } } });
		await prisma.serieFacturacion.deleteMany({ where: { tenant: { slug: `fe-${stamp}` } } });
		await prisma.tenant.deleteMany({ where: { slug: `fe-${stamp}` } });
		await prisma.$disconnect();
	});

	it('una factura termina TIMBRADA con uuid LOCAL y bitácora completa', async () => {
		const tenant = await prisma.tenant.create({
			data: {
				nombre: `FE ${stamp}`,
				slug: `fe-${stamp}`,
				taxId: 'RFC123456AB1',
				razonSocial: 'Empresa FE S.A.',
				fiscalActivado: true,
			},
		});
		const cliente = await prisma.cliente.create({
			data: { nombre: 'Cliente FE', tenantId: tenant.tenantId },
		});
		const serie = await prisma.serieFacturacion.create({
			data: {
				tenantId: tenant.tenantId,
				prefijo: 'FV',
				descripcion: 'Ventas',
				consecutivo: 1,
				esPorDefecto: true,
			},
		});
		const factura = await prisma.factura.create({
			data: {
				tenantId: tenant.tenantId,
				serieId: serie.serieId,
				numeroConsecutivo: 1,
				numeroFactura: 'FV-000001',
				clienteId: cliente.clienteId,
				subtotal: 1000,
				descuento: 0,
				total: 1000,
				estado: 'PAGADA',
				creadoPor: 'tester',
			},
		});

		// 1) encolar
		const doc = await FiscalEmisionService.registrarEmisionPendiente({
			tenantId: tenant.tenantId,
			factura: factura as never,
		});
		expect(doc.estado).toBe('PENDIENTE');

		// 2) procesar con el adaptador local
		const procesado = await FiscalEmisionService.procesarSiguientePendiente(
			tenant.tenantId,
			LocalAdapter,
		);
		expect(procesado?.estado).toBe('TIMBRADA');
		expect(procesado?.uuidExterno).toMatch(/^LOCAL-/);
		expect(procesado?.xml).toContain('<ComprobanteLocal');

		// 3) bitácora completa y ordenada
		const eventos = await prisma.fiscalEmisionEvent.findMany({
			where: { tenantId: tenant.tenantId, fiscalDocumentId: doc.fiscalDocumentId },
			orderBy: { createdAt: 'asc' },
		});
		expect(eventos.map((e) => e.estado)).toEqual(['GENERADO', 'PROCESANDO', 'TIMBRADO']);
	});
});
