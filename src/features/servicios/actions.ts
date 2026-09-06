'use server';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant, requirePermission } from '@/lib/services/tenant-scope';
import { servicioSchema, servicioUpdateSchema } from './schemas';
import type { ServicioInput, ServicioUpdateInput, ServicioResponse } from './types';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

/**
 * @description Serializa un registro de Prisma a ServicioResponse (Date → ISO string).
 * Solo incluye campos persistidos en Prisma.
 */
function serialize(s: {
  servicioId: string; nombre: string; descripcion: string;
  precio: number; moneda: string; createdAt: Date; updatedAt: Date;
}): ServicioResponse {
  return {
    servicioId: s.servicioId,
    nombre: s.nombre,
    descripcion: s.descripcion,
    precio: s.precio,
    moneda: s.moneda,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

/**
 * @description Obtiene todos los servicios del tenant actual.
 * @returns {Promise<ServicioResponse[]>} Lista de servicios ordenados por nombre.
 */
export const getServiciosAction = withAction(async (_: void, user: AuthenticatedUser) => {
  requireFeature(user, 'servicios', 'gestionar servicios');
  const tenantId = requireTenant(user);
  const servicios = await prisma.servicios.findMany({ where: { tenantId }, orderBy: { nombre: 'asc' } });
  return servicios.map(serialize);
});

/**
 * @description Obtiene un servicio por ID.
 * @param {string} id - servicioId del servicio a buscar.
 * @throws {ActionError} NOT_FOUND si no existe en el tenant.
 * @returns {Promise<ServicioResponse>} Servicio encontrado.
 */
export const getServicioByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'servicios', 'gestionar servicios');
  const tenantId = requireTenant(user);
  const s = await prisma.servicios.findFirst({ where: { servicioId: id, tenantId } });
  if (!s) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  return serialize(s);
});

/**
 * @description Crea un nuevo servicio. Solo acepta campos persistidos.
 * @param {ServicioInput} input - { nombre, descripcion, precio, moneda? }.
 * @throws {ActionError} VALIDATION_ERROR si hay campos extra (via .strict()).
 * @returns {Promise<ServicioResponse>} Servicio creado.
 */
export const createServicioAction = withAction(async (input: ServicioInput, user: AuthenticatedUser) => {
  requireFeature(user, 'servicios', 'gestionar servicios');
  requirePermission(user, 'operaciones.servicios.crear', 'crear servicios');
  const p = servicioSchema.parse(input);
  const tid = requireTenant(user);
  const s = await prisma.servicios.create({ data: { ...p, tenantId: tid } });
  revalidatePath('/busy/servicios');
  return serialize(s);
});

/**
 * @description Actualiza un servicio existente. Solo acepta campos persistidos.
 * @param {ServicioUpdateInput} input - { servicioId, nombre?, descripcion?, precio?, moneda? }.
 * @throws {ActionError} NOT_FOUND si no existe.
 * @throws {ActionError} VALIDATION_ERROR si hay campos extra.
 * @returns {Promise<ServicioResponse>} Servicio actualizado.
 */
export const updateServicioAction = withAction(async (input: ServicioUpdateInput, user: AuthenticatedUser) => {
  requireFeature(user, 'servicios', 'gestionar servicios');
  requirePermission(user, 'operaciones.servicios.editar', 'editar servicios');
  const p = servicioUpdateSchema.parse(input);
  const { servicioId, ...data } = p;
  const tid = requireTenant(user);
  const existing = await prisma.servicios.findFirst({ where: { servicioId, tenantId: tid } });
  if (!existing) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');
  const s = await prisma.servicios.update({ where: { servicioId }, data });
  revalidatePath('/busy/servicios');
  return serialize(s);
});

/**
 * @description Elimina un servicio si no tiene referencias activas.
 * Bloquea la eliminación si existen VentaServicios, CompraServicio u OfertaItem
 * que referencien este servicio (HTTP 409 equivalente).
 * @param {string} id - servicioId a eliminar.
 * @throws {ActionError} NOT_FOUND si no existe.
 * @throws {ActionError} HAS_REFERENCES si tiene ventas, compras u ofertas vinculadas.
 * @returns {Promise<{ id: string; eliminado: boolean }>}
 */
export const deleteServicioAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'servicios', 'gestionar servicios');
  requirePermission(user, 'operaciones.servicios.eliminar', 'eliminar servicios');
  const tid = requireTenant(user);
  const existing = await prisma.servicios.findFirst({ where: { servicioId: id, tenantId: tid } });
  if (!existing) throw new ActionError('Servicio no encontrado', 'NOT_FOUND');

  // Guarded deletion: verificar referencias antes de eliminar
  const [ventasCount, comprasCount, ofertasCount] = await Promise.all([
    prisma.ventaServicios.count({ where: { servicioId: id } }),
    prisma.compraServicio.count({ where: { servicioId: id } }),
    prisma.ofertaItem.count({ where: { servicioId: id } }),
  ]);

  if (ventasCount > 0 || comprasCount > 0 || ofertasCount > 0) {
    const reasons: string[] = [];
    if (ventasCount > 0) reasons.push(`${ventasCount} venta(s)`);
    if (comprasCount > 0) reasons.push(`${comprasCount} compra(s)`);
    if (ofertasCount > 0) reasons.push(`${ofertasCount} oferta(s)`);
    throw new ActionError(
      `No se puede eliminar el servicio: tiene ${reasons.join(', ')} asociadas`,
      'HAS_REFERENCES',
    );
  }

  await prisma.servicios.delete({ where: { servicioId: id } });
  revalidatePath('/busy/servicios');
  return { id, eliminado: true };
});
