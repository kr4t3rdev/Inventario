'use server';

/**
 * @description Server Actions de la capa fiscal (Gap 4 / Phase 5 del change
 * remediacion-integridad-ventas-credito-fiscal). Detrás de la feature de plan
 * `facturacion-fiscal`; sin ella la app es idéntica a hoy.
 *
 * Política aprobada (gates 1.4/1.5): un documento INCIERTA jamás se reprocesa
 * solo — sólo la conciliación de un operador autorizado con evidencia externa
 * lo resuelve; el reintento exige prueba de no emisión del mismo intento; el
 * adaptador LOCAL no acredita emisión externa.
 */
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { revalidatePath } from 'next/cache';
import { FiscalEmisionService } from '@/features/facturas/services/fiscal-emision-service';
import { LocalAdapter } from '@/features/facturas/services/fiscal/local-adapter';
import { AuditLogService } from '@/lib/services/audit-log-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const FACTURA_FISCAL_INCLUDE = {
	cliente: { select: { nombre: true, taxIdCliente: true } },
	tenant: true,
} as const;

/**
 * @description Encola la factura en la cola fiscal y procesa exactamente ESA
 * factura con el adaptador de la jurisdicción (5.3): nunca resuelve el
 * estado de otro pendiente del tenant.
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
		// Procesamiento dirigido: la factura solicitada, no el más antiguo.
		const procesado = await FiscalEmisionService.procesarFacturaPendiente({
			tenantId,
			facturaId,
			adapter: LocalAdapter,
		});
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
 * @description Reintenta un documento RECHAZADA. Política (1.4): exige permiso
 * de conciliación y una prueba verificable de que el proveedor NO emitió el
 * comprobante del intento; INCIERTA jamás se reintenta directamente (sólo
 * conciliación).
 */
export const reintentarFiscalAction = withAction(
	async (
		input: { facturaId: string; pruebaNoEmision: string },
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'facturacion-fiscal', 'reintentar emisión fiscal');
		requirePermission(user, 'config.fiscal.conciliar', 'reintentar una emisión fiscal');
		const tenantId = requireTenant(user);

		if (!input?.pruebaNoEmision?.trim()) {
			throw new ActionError(
				'El reintento exige una prueba verificable de que el proveedor no emitió el comprobante.',
				'EVIDENCIA_REQUERIDA',
			);
		}

		const factura = await prisma.factura.findFirst({
			where: { idFactura: input.facturaId, tenantId },
			select: { fiscalDocument: { select: { estado: true } } },
		});
		if (!factura?.fiscalDocument) {
			throw new ActionError('Documento fiscal no encontrado', 'NOT_FOUND');
		}
		if (factura.fiscalDocument.estado !== 'RECHAZADA') {
			throw new ActionError(
				'Solo se puede reintentar un documento rechazado con prueba de no emisión; los inciertos se concilian.',
				'ESTADO_INVALIDO',
			);
		}

		// CAS RECHAZADA→PENDIENTE con la evidencia persistida en la bitácora.
		const reencolado = await prisma.fiscalDocument.updateMany({
			where: { facturaId: input.facturaId, tenantId, estado: 'RECHAZADA' },
			data: { estado: 'PENDIENTE', ultimoError: null, attemptId: null },
		});
		if (reencolado.count !== 1) {
			throw new ActionError(
				'El documento cambió mientras se reintentaba; vuelve a cargarlo.',
				'ESTADO_INVALIDO',
			);
		}
		const documento = await prisma.fiscalDocument.findFirst({
			where: { facturaId: input.facturaId, tenantId },
			select: { fiscalDocumentId: true },
		});
		if (documento) {
			await prisma.fiscalEmisionEvent.create({
				data: {
					tenantId,
					fiscalDocumentId: documento.fiscalDocumentId,
					estado: 'REINTENTO',
					detalle: { pruebaNoEmision: input.pruebaNoEmision.trim() },
				},
			});
		}
		await AuditLogService.logStrict({
			accion: 'EXECUTE',
			entidad: 'FISCAL_DOCUMENT',
			entidadId: documento?.fiscalDocumentId ?? input.facturaId,
			usuarioId: user.userId,
			detalles: {
				tipo: 'FISCAL_REINTENTO_CON_EVIDENCIA',
				facturaId: input.facturaId,
				pruebaNoEmision: input.pruebaNoEmision.trim(),
			},
		});

		const procesado = await FiscalEmisionService.procesarFacturaPendiente({
			tenantId,
			facturaId: input.facturaId,
			adapter: LocalAdapter,
		});
		revalidatePath('/busy/facturas');
		return { estado: procesado?.estado ?? 'PENDIENTE' };
	},
);

/**
 * @description Concilia un documento INCIERTA (5.7): sólo un operador con
 * permiso `config.fiscal.conciliar` y evidencia externa verificable.
 * `TIMBRADA` confirma con el uuid del proveedor SIN nuevo envío; `NO_EMITIDA`
 * prueba que el comprobante no existe y lo devuelve a PENDIENTE para reintentar.
 * CAS sobre INCIERTA: nunca pisa un estado resuelto por otro proceso.
 */
export const conciliarFiscalAction = withAction(
	async (
		input: {
			facturaId: string;
			resultado: 'TIMBRADA' | 'NO_EMITIDA';
			uuidExterno?: string;
			folio?: string;
			motivo: string;
		},
		user: AuthenticatedUser,
	) => {
		requireFeature(user, 'facturacion-fiscal', 'conciliar emisiones fiscales');
		requirePermission(user, 'config.fiscal.conciliar', 'conciliar una emisión fiscal');
		const tenantId = requireTenant(user);

		if (!input?.motivo?.trim()) {
			throw new ActionError('La conciliación exige un motivo que respalde la evidencia.', 'VALIDATION_ERROR');
		}
		if (input?.resultado === 'TIMBRADA' && !input.uuidExterno?.trim()) {
			throw new ActionError(
				'Confirmar el timbrado exige el uuid externo del proveedor como evidencia verificable.',
				'VALIDATION_ERROR',
			);
		}

		const factura = await prisma.factura.findFirst({
			where: { idFactura: input.facturaId, tenantId },
			select: { numeroFactura: true, fiscalDocument: { select: { estado: true } } },
		});
		if (!factura?.fiscalDocument) {
			throw new ActionError('Documento fiscal no encontrado', 'NOT_FOUND');
		}
		if (factura.fiscalDocument.estado !== 'INCIERTA') {
			throw new ActionError(
				'Sólo se concilian documentos en estado INCIERTA.',
				'ESTADO_INVALIDO',
			);
		}

		const dataConciliacion =
			input.resultado === 'TIMBRADA'
				? {
						estado: 'TIMBRADA' as const,
						uuidExterno: input.uuidExterno?.trim(),
						...(input.folio?.trim() ? { folio: input.folio.trim() } : {}),
						ultimoError: null,
						attemptId: null,
					}
				: {
						estado: 'PENDIENTE' as const,
						ultimoError: null,
						attemptId: null,
					};

		const conciliado = await prisma.fiscalDocument.updateMany({
			where: { facturaId: input.facturaId, tenantId, estado: 'INCIERTA' },
			data: dataConciliacion,
		});
		if (conciliado.count !== 1) {
			throw new ActionError(
				'El documento cambió mientras se conciliaba; vuelve a cargarlo.',
				'ESTADO_INVALIDO',
			);
		}

		const documento = await prisma.fiscalDocument.findFirst({
			where: { facturaId: input.facturaId, tenantId },
			select: { fiscalDocumentId: true, estado: true },
		});
		if (documento) {
			await prisma.fiscalEmisionEvent.create({
				data: {
					tenantId,
					fiscalDocumentId: documento.fiscalDocumentId,
					estado: 'CONCILIADO',
					detalle: {
						resultado: input.resultado,
						...(input.uuidExterno?.trim() ? { uuidExterno: input.uuidExterno.trim() } : {}),
						...(input.folio?.trim() ? { folio: input.folio.trim() } : {}),
						motivo: input.motivo.trim(),
					},
				},
			});
		}
		await AuditLogService.logStrict({
			accion: 'EXECUTE',
			entidad: 'FISCAL_DOCUMENT',
			entidadId: documento?.fiscalDocumentId ?? input.facturaId,
			usuarioId: user.userId,
			detalles: {
				tipo: 'FISCAL_CONCILIACION',
				facturaId: input.facturaId,
				numeroFactura: factura.numeroFactura,
				resultado: input.resultado,
				uuidExterno: input.uuidExterno ?? null,
				motivo: input.motivo.trim(),
			},
		});

		revalidatePath('/busy/facturas');
		return {
			estado: documento?.estado ?? dataConciliacion.estado,
			...(input.resultado === 'TIMBRADA' && input.uuidExterno
				? { uuidExterno: input.uuidExterno.trim() }
				: {}),
		};
	},
);
