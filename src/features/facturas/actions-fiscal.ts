'use server';

/**
 * @description Server Actions de la capa fiscal (Gap 4). Detrás de la feature
 * de plan `facturacion-fiscal`; sin ella la app es idéntica a hoy.
 */
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { revalidatePath } from 'next/cache';
import { FiscalEmisionService } from '@/features/facturas/services/fiscal-emision-service';
import { LocalAdapter } from '@/features/facturas/services/fiscal/local-adapter';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const FACTURA_FISCAL_INCLUDE = {
	cliente: { select: { nombre: true, taxIdCliente: true } },
	tenant: true,
} as const;

/**
 * @description Encola la factura en la cola fiscal y la procesa de inmediato
 * con el adaptador de la jurisdicción (hoy: Local).
 * @param {string} facturaId - Factura interna a fiscalizar.
 * @returns {Promise<{fiscalDocumentId: string, estado: string}>} Resultado.
 */
export const emitirFiscalAction = withAction(
	async (facturaId: string, user: AuthenticatedUser) => {
		requireFeature(user, 'facturacion-fiscal', 'emitir documentos fiscales');
		const tenantId = requireTenant(user);

		const factura = await prisma.factura.findFirst({
			where: { idFactura: facturaId, tenantId },
			include: FACTURA_FISCAL_INCLUDE,
		});
		if (!factura) throw new ActionError('Factura no encontrada', 'NOT_FOUND');
		if (!factura.tenant.fiscalActivado) {
			throw new ActionError(
				'La facturación fiscal no está activada para este tenant. Completar los datos del emisor primero.',
				'FISCAL_NO_CONFIGURADO',
			);
		}

		const documento = await FiscalEmisionService.registrarEmisionPendiente({
			tenantId,
			factura: factura as never,
		});
		const procesado = await FiscalEmisionService.procesarSiguientePendiente(tenantId, LocalAdapter);
		revalidatePath('/busy/facturas');
		return {
			fiscalDocumentId: documento.fiscalDocumentId,
			estado: procesado?.estado ?? documento.estado,
		};
	},
);

/**
 * @description Devuelve el documento fiscal de una factura y su bitácora.
 */
export const getDocumentoFiscalAction = withAction(
	async (facturaId: string, user: AuthenticatedUser) => {
		requireFeature(user, 'facturacion-fiscal', 'consultar documentos fiscales');
		const tenantId = requireTenant(user);

		const documento = await prisma.fiscalDocument.findFirst({
			where: { tenantId, facturaId },
			select: {
				fiscalDocumentId: true,
				facturaId: true,
				estado: true,
				uuidExterno: true,
				folio: true,
				xml: true,
				intentos: true,
				ultimoError: true,
				updatedAt: true,
				factura: { select: { numeroFactura: true } },
			},
		});
		if (!documento) throw new ActionError('Documento fiscal no encontrado', 'NOT_FOUND');

		const eventos = await prisma.fiscalEmisionEvent.findMany({
			where: { tenantId, fiscalDocumentId: documento.fiscalDocumentId },
			orderBy: { createdAt: 'asc' },
			select: { estado: true, detalle: true, createdAt: true },
		});

		return { ...documento, eventos };
	},
);

/**
 * @description Reencola un documento RECHAZADA y lo reprocesa con el adaptador.
 */
export const reintentarFiscalAction = withAction(
	async (facturaId: string, user: AuthenticatedUser) => {
		requireFeature(user, 'facturacion-fiscal', 'reintentar emisión fiscal');
		const tenantId = requireTenant(user);

		const factura = await prisma.factura.findFirst({
			where: { idFactura: facturaId, tenantId },
			select: { fiscalDocument: { select: { estado: true } } },
		});
		if (!factura?.fiscalDocument) {
			throw new ActionError('Documento fiscal no encontrado', 'NOT_FOUND');
		}
		if (factura.fiscalDocument.estado !== 'RECHAZADA') {
			throw new ActionError(
				'Solo se puede reintentar un documento rechazado.',
				'ESTADO_INVALIDO',
			);
		}

		const documento = await prisma.fiscalDocument.update({
			where: { facturaId },
			data: { estado: 'PENDIENTE', ultimoError: null },
		});
		const procesado = await FiscalEmisionService.procesarSiguientePendiente(tenantId, LocalAdapter);
		revalidatePath('/busy/facturas');
		return { estado: procesado?.estado ?? documento.estado };
	},
);
