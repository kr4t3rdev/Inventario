import { prisma } from '@/lib/prisma';

export const OFERTA_INCLUDE = {
  cliente: true,
  items: { include: { producto: true, servicio: true } },
} as const;

export interface OfertaReadRecord {
  id: string;
  tenantId: string;
  numeroOferta: string;
  clienteId: string;
  cliente?: { nombre?: string | null } | null;
  fechaEmision: Date;
  fechaVencimiento?: Date | null;
  estado: string;
  subtotal: unknown;
  impuestos: unknown;
  total: unknown;
  observaciones?: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: unknown[];
}

/**
 * @description Lists offers scoped to a tenant using the shared Oferta include graph.
 * @param {string} tenantId - Authenticated tenant identifier.
 * @returns {Promise<OfertaReadRecord[]>} Tenant offers ordered newest first.
 */
export async function listOfertasForTenant(tenantId: string): Promise<OfertaReadRecord[]> {
  return prisma.oferta.findMany({
    where: { tenantId },
    include: OFERTA_INCLUDE,
    orderBy: { createdAt: 'desc' },
  }) as unknown as Promise<OfertaReadRecord[]>;
}

/**
 * @description Gets one offer without allowing cross-tenant access.
 * @param {string} id - Offer identifier.
 * @param {string} tenantId - Authenticated tenant identifier.
 * @returns {Promise<OfertaReadRecord | null>} Matching offer or null.
 */
export async function getOfertaForTenant(
  id: string,
  tenantId: string,
): Promise<OfertaReadRecord | null> {
  return prisma.oferta.findFirst({
    where: { id, tenantId },
    include: OFERTA_INCLUDE,
  }) as unknown as Promise<OfertaReadRecord | null>;
}

/**
 * @description Maps the existing Oferta domain to the stable mobile read contract.
 * @param {OfertaReadRecord} oferta - Oferta row with client relation.
 * @returns {Record<string, unknown>} JSON-safe mobile offer.
 */
export function mapOfertaForMobile(oferta: OfertaReadRecord): Record<string, unknown> {
  return {
    ofertaId: oferta.id,
    numeroOferta: oferta.numeroOferta,
    clienteId: oferta.clienteId,
    clienteNombre: oferta.cliente?.nombre ?? undefined,
    fechaEmision: oferta.fechaEmision.toISOString(),
    fechaVencimiento: oferta.fechaVencimiento?.toISOString() ?? null,
    estado: oferta.estado,
    subtotal: Number(oferta.subtotal),
    impuestos: Number(oferta.impuestos),
    total: Number(oferta.total),
    observaciones: oferta.observaciones ?? undefined,
    createdAt: oferta.createdAt.toISOString(),
    updatedAt: oferta.updatedAt.toISOString(),
  };
}
