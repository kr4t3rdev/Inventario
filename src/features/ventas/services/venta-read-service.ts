import { ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';

export const VENTA_SELECT = {
  ventaId: true,
  tenantId: true,
  estado: true,
  total: true,
  descuento: true,
  clienteId: true,
  empleadoId: true,
  puntoDeVentaId: true,
  observaciones: true,
  esVentaUnica: true,
  ofertaId: true,
  turnoId: true,
  metodoPago: true,
  montoEfectivo: true,
  montoTarjeta: true,
  montoTransferencia: true,
  montoCredito: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      productoId: true,
      cantidad: true,
      precioUnitario: true,
      total: true,
      producto: { select: { id: true, nombre: true, precioCosto: true } },
    },
  },
  puntoDeVenta: { select: { pvId: true, nombre: true } },
  cliente: { select: { clienteId: true, nombre: true } },
  factura: { select: { idFactura: true, numeroFactura: true } },
  // DNC: para el badge "Con devoluciones" en la tabla.
  devoluciones: {
    where: { estado: 'REGISTRADA' },
    select: { devolucionId: true, total: true },
  },
} as const;

interface SaleListFilters {
  clienteId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  puntoDeVentaId?: string | null;
  search?: string | null;
}

interface GetVentaByIdArgs {
  tenantId: string;
  ventaId: string;
}

function buildVentasWhere(tenantId: string, filters?: SaleListFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {
    tenantId,
    deletedAt: null,
  };

  if (filters?.puntoDeVentaId) {
    where.puntoDeVentaId = filters.puntoDeVentaId;
  }

  if (filters?.clienteId) {
    where.clienteId = filters.clienteId;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (filters.dateFrom) {
      createdAt.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    }
    if (filters.dateTo) {
      createdAt.lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
    }
    where.createdAt = createdAt;
  }

  const search = filters?.search?.trim();
  if (search) {
    where.OR = [
      { ventaId: { contains: search, mode: 'insensitive' } },
      { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
      { puntoDeVenta: { nombre: { contains: search, mode: 'insensitive' } } },
      { factura: { numeroFactura: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return where;
}

/**
 * @description Shared sales read service for web and mobile adapters.
 */
export const VentaReadService = {
  /**
   * @description Lists tenant-scoped sales with optional mobile/web read filters.
   * @param {string} tenantId - Authenticated tenant identifier.
   * @param {SaleListFilters} filters - Optional list filters.
   * @returns {Promise<unknown[]>} Sales list.
   */
  async list(tenantId: string, filters?: SaleListFilters) {
    return prisma.venta.findMany({
      where: buildVentasWhere(tenantId, filters),
      select: VENTA_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * @description Returns a tenant-scoped sale by id.
   * @param {GetVentaByIdArgs} args - Tenant and sale identifiers.
   * @returns {Promise<unknown>} Sale detail.
   */
  async getById({ tenantId, ventaId }: GetVentaByIdArgs) {
    const venta = await prisma.venta.findFirst({
      where: { ventaId, tenantId, deletedAt: null },
      select: VENTA_SELECT,
    });

    if (!venta) {
      throw new ActionError('Venta no encontrada', 'NOT_FOUND');
    }

    return venta;
  },
};
