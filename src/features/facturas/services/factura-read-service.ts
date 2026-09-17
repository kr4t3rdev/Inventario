import { prisma } from '@/lib/prisma';

export const FACTURA_INCLUDE = {
  serie: { select: { serieId: true, prefijo: true, descripcion: true } },
  // Gap 4: estado fiscal (null si la factura nunca se emitió).
  fiscalDocument: {
    select: { fiscalDocumentId: true, estado: true, uuidExterno: true },
  },
  cliente: {
    select: { clienteId: true, nombre: true, direccion: true, telefono: true },
  },
  venta: {
    include: {
      puntoDeVenta: { select: { pvId: true, nombre: true } },
      producto: { select: { id: true, nombre: true, precioVenta: true } },
    },
  },
} as const;

export interface FacturaFilters {
  search?: string;
  tipoDocumento?: string;
  estado?: string;
  clienteId?: string;
  serieId?: string;
  fechaInicio?: string;
  fechaFin?: string;
  page?: number;
  limit?: number;
}

interface FacturaReadRecord {
  idFactura: string;
  numeroFactura: string;
  tipoDocumento: string;
  ventaId?: string | null;
  clienteId: string;
  cliente?: { nombre?: string | null } | null;
  subtotal: unknown;
  impuestos: unknown;
  descuento?: unknown;
  total: unknown;
  cargoTransporte?: unknown;
  tasaCambio?: unknown;
  estado: string;
  fechaEmision: Date;
  fechaVencimiento?: Date | null;
  observaciones?: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

export interface FacturasReadResult {
  data: FacturaReadRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * @description Serializes Prisma Decimal fields without changing the invoice domain.
 * @param {FacturaReadRecord} factura - Invoice record returned by Prisma.
 * @returns {FacturaReadRecord} JSON-safe invoice record.
 */
export function serializeFactura(factura: FacturaReadRecord): FacturaReadRecord {
  return {
    ...factura,
    subtotal: Number(factura.subtotal),
    total: Number(factura.total),
    descuento: Number(factura.descuento ?? 0),
    impuestos: Number(factura.impuestos ?? 0),
    cargoTransporte: Number(factura.cargoTransporte ?? 0),
    tasaCambio: factura.tasaCambio ? Number(factura.tasaCambio) : null,
  };
}

/**
 * @description Lists tenant invoices with the existing filters and bounded pagination.
 * @param {string} tenantId - Authenticated tenant identifier.
 * @param {FacturaFilters} filters - Existing invoice filters.
 * @returns {Promise<FacturasReadResult>} Serialized invoices and pagination.
 */
export async function listFacturasForTenant(
  tenantId: string,
  filters: FacturaFilters = {},
): Promise<FacturasReadResult> {
  const {
    search,
    estado,
    tipoDocumento,
    clienteId,
    serieId,
    fechaInicio,
    fechaFin,
    page = 1,
    limit = 50,
  } = filters;
  const boundedPage = Math.max(1, page);
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const where: Record<string, unknown> = { tenantId };
  if (estado) where.estado = estado;
  if (tipoDocumento) where.tipoDocumento = tipoDocumento;
  if (clienteId) where.clienteId = clienteId;
  if (serieId) where.serieId = serieId;
  if (fechaInicio || fechaFin) {
    const createdAt: Record<string, Date> = {};
    if (fechaInicio) createdAt.gte = new Date(`${fechaInicio}T00:00:00.000Z`);
    if (fechaFin) createdAt.lte = new Date(`${fechaFin}T23:59:59.999Z`);
    where.createdAt = createdAt;
  }
  if (search) {
    where.OR = [
      { numeroFactura: { contains: search } },
      { cliente: { nombre: { contains: search } } },
      { venta: { producto: { nombre: { contains: search } } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.factura.findMany({
      where,
      include: FACTURA_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (boundedPage - 1) * boundedLimit,
      take: boundedLimit,
    }),
    prisma.factura.count({ where }),
  ]);

  return {
    data: (data as unknown as FacturaReadRecord[]).map(serializeFactura),
    pagination: {
      page: boundedPage,
      limit: boundedLimit,
      total,
      totalPages: Math.ceil(total / boundedLimit),
    },
  };
}

/**
 * @description Gets one invoice without allowing cross-tenant access.
 * @param {string} id - Invoice identifier.
 * @param {string} tenantId - Authenticated tenant identifier.
 * @returns {Promise<FacturaReadRecord | null>} Serialized invoice or null.
 */
export async function getFacturaForTenant(
  id: string,
  tenantId: string,
): Promise<FacturaReadRecord | null> {
  const factura = await prisma.factura.findFirst({
    where: { idFactura: id, tenantId },
    include: FACTURA_INCLUDE,
  });
  return factura
    ? serializeFactura(factura as unknown as FacturaReadRecord)
    : null;
}

/**
 * @description Maps an existing invoice to the stable mobile read contract.
 * @param {FacturaReadRecord} factura - Serialized invoice with client relation.
 * @returns {Record<string, unknown>} JSON-safe mobile invoice.
 */
export function mapFacturaForMobile(factura: FacturaReadRecord): Record<string, unknown> {
  return {
    facturaId: factura.idFactura,
    numeroFactura: factura.numeroFactura,
    tipoDocumento: factura.tipoDocumento,
    ventaId: factura.ventaId ?? null,
    clienteId: factura.clienteId,
    clienteNombre: factura.cliente?.nombre ?? undefined,
    subtotal: Number(factura.subtotal),
    impuestos: Number(factura.impuestos),
    descuento: Number(factura.descuento ?? 0),
    total: Number(factura.total),
    estado: factura.estado,
    fechaEmision: factura.fechaEmision.toISOString(),
    fechaVencimiento: factura.fechaVencimiento?.toISOString() ?? null,
    observaciones: factura.observaciones ?? undefined,
    createdAt: factura.createdAt.toISOString(),
    updatedAt: factura.updatedAt.toISOString(),
  };
}
