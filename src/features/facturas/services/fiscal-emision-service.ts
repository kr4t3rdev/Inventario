import { prisma } from '@/lib/prisma';
import type { FiscalAdapter } from '@/features/facturas/services/fiscal/fiscal-adapter';
import { FiscalRechazoDefinitivoError } from '@/features/facturas/services/fiscal/fiscal-adapter';

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
			select: { facturaId: true },
		});
		if (!documento) return null;

		// Delega en el procesamiento dirigido: misma máquina de estados,
		// claim con attemptId y clasificación de fallos.
		return this.procesarFacturaPendiente({ tenantId, facturaId: documento.facturaId, adapter });
	},

	/**
	 * @description Procesa la factura EXACTA solicitada (5.3): claim atómico
	 * `PENDIENTE → PROCESANDO` con attemptId, envío al adaptador y
	 * finalización CAS por attemptId. La acción de emitir nunca resuelve el
	 * estado de otra factura. Sólo selecciona PENDIENTE: históricos en
	 * PROCESANDO/INCIERTA jamás se reprocesan solos.
	 * @param {object} params - Tenant, factura y adaptador de la jurisdicción.
	 * @returns {Promise<FiscalDocumentoProcesado | null>} Documento resuelto, o null si el claim/CAS lo pierde.
	 */
	async procesarFacturaPendiente({
		tenantId,
		facturaId,
		adapter,
	}: {
		tenantId: string;
		facturaId: string;
		adapter: FiscalAdapter;
	}): Promise<FiscalDocumentoProcesado | null> {
		const attemptId = crypto.randomUUID();

		// Claim atómico por factura exacta: sólo un worker gana; el perdedor
		// aborta sin invocar al proveedor.
		const claimed = await prisma.fiscalDocument.updateMany({
			where: { facturaId, tenantId, estado: 'PENDIENTE' },
			data: { estado: 'PROCESANDO', attemptId },
		});
		if (claimed.count !== 1) return null;

		const documento = await prisma.fiscalDocument.findFirst({
			where: { facturaId, tenantId },
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
		// El evento PROCESANDO real, con el id del documento y el attemptId.
		await prisma.fiscalEmisionEvent.create({
			data: {
				tenantId,
				fiscalDocumentId: documento.fiscalDocumentId,
				estado: 'PROCESANDO',
				attemptId,
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

			// Finalización CAS por attemptId: un intento tardío no pisa el
			// estado que otro proceso ya resolvió.
			const terminadoCount = await prisma.fiscalDocument.updateMany({
				where: {
					facturaId,
					tenantId,
					estado: 'PROCESANDO',
					attemptId,
				},
				data: {
					estado: 'TIMBRADA',
					uuidExterno: resultado.uuidExterno,
					xml: resultado.xml,
					folio: resultado.folio,
					attemptId: null,
				},
			});
			if (terminadoCount.count !== 1) return null;
			await prisma.fiscalEmisionEvent.create({
				data: {
					tenantId,
					fiscalDocumentId: documento.fiscalDocumentId,
					estado: 'TIMBRADO',
					attemptId,
					detalle: { uuidExterno: resultado.uuidExterno },
				},
			});
			const terminado = await prisma.fiscalDocument.findFirst({
				where: { facturaId, tenantId },
			});
			return terminado as FiscalDocumentoProcesado;
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			// Clasificación (5.4): sólo un rechazo definitivo autenticado del
			// proveedor deja RECHAZADA; cualquier otro fallo post-envío es
			// INCIERTA y exige conciliación con evidencia (nunca retry a ciegas).
			const rechazoDefinitivo = error instanceof FiscalRechazoDefinitivoError;
			const estadoFinal = rechazoDefinitivo ? 'RECHAZADA' as const : 'INCIERTA' as const;
			const estadoEvento = rechazoDefinitivo ? 'RECHAZADO' : 'INCIERTO';

			const actualizadoCount = await prisma.fiscalDocument.updateMany({
				where: { facturaId, tenantId, estado: 'PROCESANDO', attemptId },
				data: {
					estado: estadoFinal,
					intentos: { increment: 1 },
					ultimoError: message.slice(0, MAX_ERROR_LEN),
					attemptId: null,
				},
			});
			if (actualizadoCount.count !== 1) return null;
			await prisma.fiscalEmisionEvent.create({
				data: {
					tenantId,
					fiscalDocumentId: documento.fiscalDocumentId,
					estado: estadoEvento,
					attemptId,
					detalle: rechazoDefinitivo
						? { codigo: (error as FiscalRechazoDefinitivoError).codigo, error: message.slice(0, MAX_ERROR_LEN) }
						: { error: message.slice(0, MAX_ERROR_LEN) },
				},
			});
			const actualizado = await prisma.fiscalDocument.findFirst({
				where: { facturaId, tenantId },
			});
			return actualizado as FiscalDocumentoProcesado;
		}
	},
 };
