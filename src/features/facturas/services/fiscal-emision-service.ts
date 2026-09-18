import { prisma } from '@/lib/prisma';
import type { FiscalAdapter } from '@/features/facturas/services/fiscal/fiscal-adapter';

/** Forma pública mínima del documento fiscal (evita acoplar el contrato al
 * include de la query interna). */
export interface FiscalDocumentMin {
	fiscalDocumentId: string;
	tenantId: string;
	facturaId: string;
	jurisdiccion: string;
	tipoDocumento: string;
	estado: string;
	uuidExterno: string | null;
	xml: string | null;
	folio: string | null;
	intentos: number;
	ultimoError: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/** Alias de conveniencia para el retorno de procesarSiguientePendiente. */
type FiscalDocumentoProcesado = FiscalDocumentMin;

/** Tamaño máximo del error persistido en el documento fiscal. */
const MAX_ERROR_LEN = 500;

interface FacturaFiscalMinima {
	idFactura: string;
	tenantId: string;
	numeroFactura: string;
	tipoDocumento: string;
	total: unknown;
	subtotal: unknown;
	descuento: unknown;
	cliente?: { nombre?: string | null; taxIdCliente?: string | null } | null;
	tenant?: {
		taxId?: string | null;
		razonSocial?: string | null;
		regimenFiscal?: string | null;
		codigoPostalFiscal?: string | null;
	} | null;
}

/**
 * @description Orquestador de la emisión fiscal (Gap 4): pone la factura en la
 * cola (documento PENDIENTE) y procesa los pendientes con el adaptador de la
 * jurisdicción. Diseñado para ser llamado por una acción del UI, un worker o un
 * cron posterior. Sin dependencia de red en esta ancla: el timing real lo da el
 * adaptador elegido.
 */
export const FiscalEmisionService = {
	/**
	 * @description Encola la factura en la cola fiscal si aún no existe.
	 * Idempotente por `facturaId` (upsert atómico: sin ventana de doble creación).
	 * @param {object} params - Tenant y factura mínimas.
	 * @returns {Promise<FiscalDocumentMin>} Documento fiscal (existente si se repite).
	 */
	async registrarEmisionPendiente({
		tenantId,
		factura,
	}: {
		tenantId: string;
		factura: FacturaFiscalMinima;
	}): Promise<FiscalDocumentMin> {
		return prisma.fiscalDocument.upsert({
			where: { facturaId: factura.idFactura },
			create: {
				tenantId,
				facturaId: factura.idFactura,
				jurisdiccion: 'LOCAL',
				tipoDocumento: factura.tipoDocumento ?? 'FACTURA',
				estado: 'PENDIENTE',
				eventos: {
					create: {
						tenantId,
						estado: 'GENERADO',
						detalle: { numeroFactura: factura.numeroFactura },
					},
				},
			},
			// Si ya existe, no toca nada y no duplica el evento GENERADO.
			update: {},
		});
	},

	/**
	 * @description Toma el documento PENDIENTE más antiguo del tenant y llama al
	 * adaptador. Con éxito marca TIMBRADA; con error marca RECHAZADA conservando
	 * el mensaje. Devuelve null si no hay nada que procesar.
	 *
	 * El claim del documento es atómico (updateMany condicionado por estado) para
	 * que dos workers paralelos no provoquen un doble timbrado en un PAC real.
	 */
	async procesarSiguientePendiente(
		tenantId: string,
		adapter: FiscalAdapter,
	): Promise<FiscalDocumentoProcesado | null> {
		const documento = await prisma.fiscalDocument.findFirst({
			where: { tenantId, estado: 'PENDIENTE' },
			orderBy: { createdAt: 'asc' },
			include: {
				factura: {
					include: {
						cliente: { select: { nombre: true, taxIdCliente: true } },
						tenant: {
							select: {
								taxId: true,
								razonSocial: true,
								regimenFiscal: true,
								codigoPostalFiscal: true,
							},
						},
					},
				},
			},
		});
		if (!documento) return null;

		// Claim atómico: solo un worker gana; el perdedor aborta sin llamar al PAC.
		const claimed = await prisma.fiscalDocument.updateMany({
			where: {
				fiscalDocumentId: documento.fiscalDocumentId,
				estado: 'PENDIENTE',
			},
			data: { estado: 'PROCESANDO' },
		});
		if (claimed.count !== 1) return null;
		await prisma.fiscalEmisionEvent.create({
			data: {
				tenantId,
				fiscalDocumentId: documento.fiscalDocumentId,
				estado: 'PROCESANDO',
			},
		});

		try {
			const resultado = await adapter.generar({
				facturaId: documento.facturaId,
				numeroFactura: documento.factura.numeroFactura,
				tipoDocumento: documento.tipoDocumento,
				total: Number(documento.factura.total),
				subtotal: Number(documento.factura.subtotal),
				descuento: Number(documento.factura.descuento),
				tenantId,
				emisor: documento.factura.tenant ?? undefined,
				clienteFiscal: documento.factura.cliente,
			});

			const terminado = await prisma.fiscalDocument.update({
				where: { fiscalDocumentId: documento.fiscalDocumentId },
				data: {
					estado: 'TIMBRADA',
					uuidExterno: resultado.uuidExterno,
					xml: resultado.xml,
					folio: resultado.folio,
				},
			});
			await prisma.fiscalEmisionEvent.create({
				data: {
					tenantId,
					fiscalDocumentId: documento.fiscalDocumentId,
					estado: 'TIMBRADO',
					detalle: { uuidExterno: resultado.uuidExterno },
				},
			});
			return terminado;
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			const rechazado = await prisma.fiscalDocument.update({
				where: { fiscalDocumentId: documento.fiscalDocumentId },
				data: {
					estado: 'RECHAZADA',
					intentos: { increment: 1 },
					ultimoError: message.slice(0, MAX_ERROR_LEN),
				},
			});
			await prisma.fiscalEmisionEvent.create({
				data: {
					tenantId,
					fiscalDocumentId: documento.fiscalDocumentId,
					estado: 'RECHAZADO',
					detalle: { error: message.slice(0, MAX_ERROR_LEN) },
				},
			});
			return rechazado;
		}
	},
};
