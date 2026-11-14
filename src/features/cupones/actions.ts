/**
 * @description Server Actions para el módulo de Cupones.
 *
 * CRUD de cupones y validación/aplicación en checkout.
 *
 * @module features/cupones/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { cuponSchema, cuponUpdateSchema, aplicarCuponSchema } from './schemas';
import type { CuponInput, CuponUpdateInput, AplicarCuponInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { validarCupon } from './services/cupon-validator';

// ─── CRUD de Cupones ───────────────────────────────────────────────────

/**
 * @description Obtiene los cupones activos del tenant.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Cupones activos.
 */
export const getCuponesAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'cupones-promociones', 'consultar cupones');
    const tenantId = requireTenant(user);
    return prisma.cupon.findMany({
      where: { tenantId, activo: true },
      orderBy: { createdAt: 'desc' },
    });
  },
);

/**
 * @description Crea un nuevo cupón.
 * @param {CuponInput} input - Datos del cupón.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Cupón creado.
 */
export const createCuponAction = withAction(
  async (input: CuponInput, user: AuthenticatedUser) => {
    requireFeature(user, 'cupones-promociones', 'crear cupones');
    const parsed = cuponSchema.parse(input);
    const tenantId = requireTenant(user);

    // Verificar que el código no existe ya
    const existente = await prisma.cupon.findFirst({
      where: { tenantId, codigo: parsed.codigo },
    });
    if (existente) throw new ActionError('Ya existe un cupón con ese código', 'DUPLICATE');

    const cupon = await prisma.cupon.create({
      data: {
        tenantId,
        codigo: parsed.codigo,
        tipo: parsed.tipo,
        valor: parsed.valor,
        descripcion: parsed.descripcion ?? null,
        usoMinimo: parsed.usoMinimo ?? null,
        usoMaximo: parsed.usoMaximo ?? null,
        vecesMaximo: parsed.vecesMaximo ?? null,
        vecesPorCliente: parsed.vecesPorCliente ?? null,
        validoDesde: parsed.validoDesde,
        validoHasta: parsed.validoHasta ?? null,
        activo: parsed.activo ?? true,
        aplicableA: parsed.aplicableA ?? null,
        filtros: (parsed.filtros ?? null) as any,
        canalAplicacion: parsed.canalAplicacion ?? null,
        segmentoTarget: parsed.segmentoTarget ?? null,
      },
    });

    revalidatePath('/busy/cupones');
    return cupon;
  },
);

/**
 * @description Actualiza un cupón existente.
 * @param {CuponUpdateInput} input - ID y campos a actualizar.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Cupón actualizado.
 */
export const updateCuponAction = withAction(
  async (input: CuponUpdateInput, user: AuthenticatedUser) => {
    requireFeature(user, 'cupones-promociones', 'editar cupones');
    const parsed = cuponUpdateSchema.parse(input);
    const tenantId = requireTenant(user);

    const existente = await prisma.cupon.findFirst({
      where: { cuponId: parsed.cuponId, tenantId },
    });
    if (!existente) throw new ActionError('Cupón no encontrado', 'NOT_FOUND');

    const { cuponId, ...data } = parsed;
    const cupon = await prisma.cupon.update({
      where: { cuponId },
      data: {
        ...(data.codigo !== undefined && { codigo: data.codigo }),
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.valor !== undefined && { valor: data.valor }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.usoMinimo !== undefined && { usoMinimo: data.usoMinimo }),
        ...(data.usoMaximo !== undefined && { usoMaximo: data.usoMaximo }),
        ...(data.vecesMaximo !== undefined && { vecesMaximo: data.vecesMaximo }),
        ...(data.vecesPorCliente !== undefined && { vecesPorCliente: data.vecesPorCliente }),
        ...(data.validoDesde !== undefined && { validoDesde: data.validoDesde }),
        ...(data.validoHasta !== undefined && { validoHasta: data.validoHasta }),
        ...(data.activo !== undefined && { activo: data.activo }),
        ...(data.aplicableA !== undefined && { aplicableA: data.aplicableA }),
        ...(data.filtros !== undefined && { filtros: data.filtros as any }),
        ...(data.canalAplicacion !== undefined && { canalAplicacion: data.canalAplicacion }),
        ...(data.segmentoTarget !== undefined && { segmentoTarget: data.segmentoTarget }),
      } as any,
    });

    revalidatePath('/busy/cupones');
    return cupon;
  },
);

/**
 * @description Obtiene un cupón por su código (para validación en checkout).
 * @param {string} codigo - Código del cupón.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Cupón encontrado.
 */
export const getCuponByCodigoAction = withAction(
  async (codigo: string, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    const cupon = await prisma.cupon.findFirst({
      where: { tenantId, codigo: codigo.toUpperCase() },
    });
    if (!cupon) throw new ActionError('Cupón no encontrado', 'NOT_FOUND');
    return cupon;
  },
);

// ─── Aplicación en Checkout ────────────────────────────────────────────

/**
 * @description Valida y aplica un cupón en el checkout.
 * Verifica todas las reglas y registra el uso si es válido.
 * @param {AplicarCuponInput} input - Código, cliente, venta, canal, total.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado con descuento y estado.
 */
export const aplicarCuponAction = withAction(
  async (input: AplicarCuponInput, user: AuthenticatedUser) => {
    requireFeature(user, 'cupones-promociones', 'aplicar cupones');
    const parsed = aplicarCuponSchema.parse(input);
    const tenantId = requireTenant(user);

    return await prisma.$transaction(async (tx) => {
      // Buscar el cupón
      const cupon = await tx.cupon.findFirst({
        where: { tenantId, codigo: parsed.codigo.toUpperCase() },
      });
      if (!cupon) {
        return { valido: false, motivoRechazo: 'Cupón no encontrado' };
      }

      // Contar usos por cliente
      let usosPorCliente = 0;
      if (parsed.clienteId) {
        usosPorCliente = await tx.cuponUso.count({
          where: { tenantId, cuponId: cupon.cuponId, clienteId: parsed.clienteId },
        });
      }

      // Obtener segmento del cliente
      let segmentoCliente: string | null = null;
      if (parsed.clienteId) {
        const cliente = await tx.cliente.findFirst({
          where: { clienteId: parsed.clienteId },
          select: { segmento: true },
        });
        segmentoCliente = cliente?.segmento ?? null;
      }

      // Validar con el servicio puro
      const validacion = validarCupon({
        cupon: {
          cuponId: cupon.cuponId,
          codigo: cupon.codigo,
          tipo: cupon.tipo as any,
          valor: cupon.valor,
          usoMinimo: cupon.usoMinimo,
          usoMaximo: cupon.usoMaximo,
          vecesMaximo: cupon.vecesMaximo,
          vecesPorCliente: cupon.vecesPorCliente,
          validoDesde: cupon.validoDesde,
          validoHasta: cupon.validoHasta,
          activo: cupon.activo,
          aplicableA: cupon.aplicableA,
          filtros: cupon.filtros as any,
          canalAplicacion: cupon.canalAplicacion,
          segmentoTarget: cupon.segmentoTarget,
          vecesUsado: cupon.vecesUsado,
        },
        totalCompra: parsed.totalCompra,
        canal: parsed.canal,
        clienteId: parsed.clienteId,
        segmentoCliente,
        productoIds: parsed.productoIds,
        usosPorCliente,
      });

      if (!validacion.valido) {
        return { valido: false, motivoRechazo: validacion.motivoRechazo };
      }

      // Registrar el uso
      await tx.cuponUso.create({
        data: {
          tenantId,
          cuponId: cupon.cuponId,
          clienteId: parsed.clienteId ?? null,
          ventaId: parsed.ventaId,
          descuentoAplicado: validacion.descuento ?? 0,
          canal: parsed.canal,
        },
      });

      // Incrementar contador
      await tx.cupon.update({
        where: { cuponId: cupon.cuponId },
        data: { vecesUsado: { increment: 1 } },
      });

      return {
        valido: true,
        descuento: validacion.descuento,
        cuponId: cupon.cuponId,
        codigo: cupon.codigo,
      };
    });
  },
);

/**
 * @description Obtiene el historial de uso de un cupón.
 * @param {string} cuponId - ID del cupón.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Usos del cupón.
 */
export const getCuponUsosAction = withAction(
  async (cuponId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'cupones-promociones', 'consultar usos de cupones');
    const tenantId = requireTenant(user);

    const cupon = await prisma.cupon.findFirst({
      where: { cuponId, tenantId },
    });
    if (!cupon) throw new ActionError('Cupón no encontrado', 'NOT_FOUND');

    return prisma.cuponUso.findMany({
      where: { tenantId, cuponId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },
);
