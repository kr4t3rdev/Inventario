import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * @description Maps a CompraProducto row to the mobile purchase contract.
 * @param {Record<string, any>} c - Raw purchase row with product/vendor.
 * @returns {Record<string, unknown>} Mobile-shaped purchase payload.
 */
export function mapCompra(c: any) {
  return {
    compraId: c.compraProductoId,
    proveedorId: c.proveedorId,
    productoId: c.productoId,
    cantidad: c.cantidad,
    precioUnitario: c.precioUnitario,
    total: c.total,
    descripcion: c.descripcion,
    estado: c.estado,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    proveedor: c.proveedor ? { nombre: c.proveedor.nombre } : undefined,
    producto: c.producto
      ? { nombre: c.producto.nombre, codigoInterno: c.producto.codigoInterno }
      : undefined,
  };
}

const SELECT = {
  compraProductoId: true,
  proveedorId: true,
  productoId: true,
  cantidad: true,
  precioUnitario: true,
  total: true,
  descripcion: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
  proveedor: { select: { nombre: true } },
  producto: { select: { nombre: true, codigoInterno: true } },
} as const;

/**
 * @description Mobile purchases list endpoint.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped purchase list.
 */
export async function GET(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const rows = await prisma.compraProducto.findMany({
      where: { tenantId, deletedAt: null },
      select: SELECT,
      orderBy: { fechaCompra: 'desc' },
    });
    return successResponse({ items: rows.map(mapCompra) });
  } catch (error) {
    console.error('Error en mobile purchases route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Creates a purchase record for the caller's tenant.
 * @param {Request} request - Incoming authenticated request with { proveedorId, productoId, cantidad, precioUnitario, descripcion? }.
 * @returns {Promise<Response>} Created mapped purchase.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const body = (await request.json()) as {
      proveedorId?: unknown;
      productoId?: unknown;
      cantidad?: unknown;
      precioUnitario?: unknown;
      descripcion?: unknown;
    };
    const proveedorId = typeof body.proveedorId === 'string' ? body.proveedorId : '';
    const productoId = typeof body.productoId === 'string' ? body.productoId : '';
    const cantidad = typeof body.cantidad === 'number' && Number.isFinite(body.cantidad) ? body.cantidad : 0;
    const precioUnitario =
      typeof body.precioUnitario === 'number' && Number.isFinite(body.precioUnitario) ? body.precioUnitario : 0;
    if (!proveedorId || !productoId || cantidad <= 0 || precioUnitario < 0) {
      return errorResponse('Datos inválidos', 400, 'VALIDATION_ERROR');
    }

    const [proveedor, producto] = await Promise.all([
      prisma.vendor.findFirst({ where: { vendorId: proveedorId, tenantId }, select: { vendorId: true } }),
      prisma.producto.findFirst({ where: { id: productoId, tenantId }, select: { id: true } }),
    ]);
    if (!proveedor) {
      return errorResponse('Proveedor no encontrado', 404, 'NOT_FOUND');
    }
    if (!producto) {
      return errorResponse('Producto no encontrado', 404, 'NOT_FOUND');
    }

    const total = Math.round(precioUnitario * cantidad);
    const descripcion =
      typeof body.descripcion === 'string' && body.descripcion.trim() ? body.descripcion.trim() : null;

    const created = await prisma.compraProducto.create({
      data: {
        tenantId,
        proveedorId,
        productoId,
        cantidad,
        precioUnitario: Math.round(precioUnitario),
        total,
        descripcion,
        numeroFactura: '',
        facturaUrl: '',
        formaPago: 'EFECTIVO',
        estado: 'PENDIENTE',
      },
      select: SELECT,
    });

    return successResponse(mapCompra(created as any), 201);
  } catch (error) {
    console.error('Error creando compra (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}