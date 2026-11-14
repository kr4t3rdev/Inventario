/**
 * @description Server Actions para la gestión de lealtad (puntos, canjes, tiers).
 *
 * Conecta los servicios puros de lealtad con la base de datos Prisma.
 * Todas las mutaciones usan withAction para auth y error handling.
 *
 * @module features/lealtad/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { canjePuntosSchema, puntosManualesSchema } from './schemas';
import type { CanjePuntosInput, PuntosManualesInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { procesarCanje } from './services/canje-service';
import { crearIdempotenciaKey } from './services/idempotency-service';
import { acumularPuntosPorCompraVenta } from '@/features/ventas/services/lealtad-integration';

/**
 * @description Obtiene el programa de lealtad activo del tenant.
 * @param {void} _input - Sin parámetros.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object | null>} Programa activo o null si no existe.
 */
export const getProgramaLealtadAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'gestionar programa de lealtad');
    const tenantId = requireTenant(user);
    return prisma.programaLealtad.findFirst({
      where: { tenantId, activo: true },
      include: { tiers: { where: { activo: true }, orderBy: { orden: 'asc' } } },
    });
  },
);

/**
 * @description Obtiene el saldo y tier actual de un cliente en el programa de lealtad.
 * @param {string} clienteId - ID del cliente.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Saldo, tier, puntos ganados/canjeados.
 */
export const getClienteLealtadAction = withAction(
  async (clienteId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'consultar lealtad de cliente');
    const tenantId = requireTenant(user);
    const clienteLealtad = await prisma.clienteLealtad.findFirst({
      where: { tenantId, clienteId },
      include: { programa: { include: { tiers: { where: { activo: true }, orderBy: { orden: 'asc' } } } } },
    });
    if (!clienteLealtad) throw new ActionError('Cliente no tiene lealtad registrada', 'NOT_FOUND');
    return clienteLealtad;
  },
);

/**
 * @description Obtiene el historial de puntos de un cliente.
 * @param {string} clienteId - ID del cliente.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object[]>} Historial de movimientos de puntos.
 */
export const getHistorialPuntosAction = withAction(
  async (clienteId: string, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'consultar historial de puntos');
    const tenantId = requireTenant(user);
    return prisma.historialPuntos.findMany({
      where: { tenantId, clienteId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },
);

/**
 * @description Canjea puntos de lealtad por un descuento.
 * Verifica saldo, calcula el valor del canje y registra la operación.
 * @param {CanjePuntosInput} input - Cliente, puntos a canjear y referencia.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Resultado del canje con valor y nuevo saldo.
 */
export const canjePuntosAction = withAction(
  async (input: CanjePuntosInput, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'canjear puntos de lealtad');
    const parsed = canjePuntosSchema.parse(input);
    const tenantId = requireTenant(user);

    const resultado = await prisma.$transaction(async (tx) => {
      // Obtener saldo y programa
      const clienteLealtad = await tx.clienteLealtad.findFirst({
        where: { tenantId, clienteId: parsed.clienteId },
        include: { programa: true },
      });
      if (!clienteLealtad) throw new ActionError('Cliente no tiene lealtad registrada', 'NOT_FOUND');
      if (!clienteLealtad.programa) throw new ActionError('Programa de lealtad no encontrado', 'NOT_FOUND');

      // Verificar idempotencia
      if (parsed.referenciaId) {
        const idemKey = crearIdempotenciaKey('CANJE', parsed.referenciaId);
        const existente = await tx.historialPuntos.findFirst({
          where: { tenantId, idempotenciaKey: idemKey },
        });
        if (existente) throw new ActionError('Este canje ya fue procesado', 'DUPLICATE');
      }

      // Procesar canje con reglas puras
      const canjeResult = procesarCanje({
        saldoActual: clienteLealtad.saldoPuntos,
        puntosSolicitados: parsed.puntos,
        puntosMinimos: clienteLealtad.programa.puntosMinimos,
        valorCanje: clienteLealtad.programa.valorCanje,
      });

      if (!canjeResult.aprobado) {
        throw new ActionError(canjeResult.motivo || 'Canje no aprobado', 'CANJE_RECHAZADO');
      }

      // Registrar el movimiento
      const idemKey = parsed.referenciaId ? crearIdempotenciaKey('CANJE', parsed.referenciaId) : null;
      await tx.historialPuntos.create({
        data: {
          tenantId,
          clienteId: parsed.clienteId,
          programaId: clienteLealtad.programaId,
          puntos: -parsed.puntos,
          tipo: 'CANJE',
          referenciaId: parsed.referenciaId ?? null,
          saldoAcumulado: canjeResult.nuevoSaldo,
          idempotenciaKey: idemKey,
        },
      });

      // Actualizar saldo
      await tx.clienteLealtad.update({
        where: { clienteId: parsed.clienteId },
        data: {
          saldoPuntos: canjeResult.nuevoSaldo,
          puntosCanjeados: { increment: parsed.puntos },
        },
      });

      return canjeResult;
    });

    revalidatePath('/busy/lealtad');
    return resultado;
  },
);

/**
 * @description Agrega o resta puntos manualmente (bonus, cumpleaños, ajuste).
 * @param {PuntosManualesInput} input - Cliente, puntos, tipo y referencia.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Nuevo saldo después de la operación.
 */
export const addPuntosManualesAction = withAction(
  async (input: PuntosManualesInput, user: AuthenticatedUser) => {
    requireFeature(user, 'lealtad-programa', 'gestionar puntos manualmente');
    const parsed = puntosManualesSchema.parse(input);
    const tenantId = requireTenant(user);

    const resultado = await prisma.$transaction(async (tx) => {
      const clienteLealtad = await tx.clienteLealtad.findFirst({
        where: { tenantId, clienteId: parsed.clienteId },
      });
      if (!clienteLealtad) throw new ActionError('Cliente no tiene lealtad registrada', 'NOT_FOUND');

      // Verificar idempotencia
      if (parsed.referenciaId) {
        const idemKey = crearIdempotenciaKey(parsed.tipo, parsed.referenciaId);
        const existente = await tx.historialPuntos.findFirst({
          where: { tenantId, idempotenciaKey: idemKey },
        });
        if (existente) throw new ActionError('Esta operación ya fue procesada', 'DUPLICATE');
      }

      const nuevoSaldo = clienteLealtad.saldoPuntos + parsed.puntos;
      if (nuevoSaldo < 0) throw new ActionError('El saldo no puede ser negativo', 'INVALID_SALDO');

      const idemKey = parsed.referenciaId ? crearIdempotenciaKey(parsed.tipo, parsed.referenciaId) : null;
      await tx.historialPuntos.create({
        data: {
          tenantId,
          clienteId: parsed.clienteId,
          programaId: clienteLealtad.programaId,
          puntos: parsed.puntos,
          tipo: parsed.tipo,
          referenciaId: parsed.referenciaId ?? null,
          saldoAcumulado: nuevoSaldo,
          idempotenciaKey: idemKey,
        },
      });

      await tx.clienteLealtad.update({
        where: { clienteId: parsed.clienteId },
        data: {
          saldoPuntos: nuevoSaldo,
          puntosGanados: parsed.puntos > 0 ? { increment: parsed.puntos } : undefined,
        },
      });

      return { nuevoSaldo, puntos: parsed.puntos, tipo: parsed.tipo };
    });

    revalidatePath('/busy/lealtad');
    return resultado;
  },
);

/**
 * @description Registra los puntos acumulados por una compra (se llama desde la transacción de ventas).
 * Delega en `acumularPuntosPorCompraVenta` para evitar duplicación de lógica.
 * @param {object} input - Datos de la compra.
 * @param {string} input.clienteId - ID del cliente.
 * @param {string} input.ventaId - ID de la venta (clave de idempotencia).
 * @param {number} input.totalCompra - Total de la compra en centavos.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<object>} Puntos acumulados y motivo.
 */
export const acumularPuntosPorCompraAction = withAction(
  async (input: { clienteId: string; ventaId: string; totalCompra: number }, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    return acumularPuntosPorCompraVenta({ ...input, tenantId });
  },
);
