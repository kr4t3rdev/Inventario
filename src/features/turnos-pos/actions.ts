/**
 * @description Server Actions para la feature de Turnos de Punto de Venta.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { abrirTurnoSchema, cerrarTurnoSchema, listarTurnosSchema, turnoAutomaticoSchema } from './schemas';
import type { AbrirTurnoInput, CerrarTurnoInput, ListarTurnosInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Constantes ───────────────────────────────────────────

const TURNOS_INCLUDE = {
  puntoDeVenta: { select: { pvId: true, nombre: true, tipoCaja: true } },
  empleado: { select: { empleadoId: true, nombre: true, apellido: true } },
  arqueo: true,
  ventas: { select: { total: true } },
  _count: { select: { ventas: true } },
} as const;

// ─── Server Actions ───────────────────────────────────────

/**
 * @description Abre un turno en un punto de venta.
 * Verifica que no exista otro turno ABIERTO en el mismo POS.
 *
 * @param {AbrirTurnoInput} input - Datos de apertura
 * @returns {Promise<TurnoPuntoVenta>} Turno creado
 * @throws {ActionError} Si ya hay un turno abierto
 */
export const abrirTurnoAction = withAction(async (input: AbrirTurnoInput, user: AuthenticatedUser) => {
  const parsed = abrirTurnoSchema.parse(input);
  const tenantId = requireTenant(user);

  // Validar que el punto de venta existe y pertenece al tenant
  const pv = await prisma.puntoDeVenta.findFirst({
    where: { pvId: parsed.puntoDeVentaId, tenantId },
  });
  if (!pv) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');

  // Validar que no exista otro turno ABIERTO en el mismo POS
  const turnoActivo = await prisma.turnoPuntoVenta.findFirst({
    where: {
      puntoDeVentaId: parsed.puntoDeVentaId,
      estado: 'ABIERTO',
    },
  });
  if (turnoActivo) {
    throw new ActionError(
      'Ya existe un turno abierto en este punto de venta',
      'CONFLICT',
    );
  }

  // Crear el turno
  const turno = await prisma.turnoPuntoVenta.create({
    data: {
      tenantId,
      puntoDeVentaId: parsed.puntoDeVentaId,
      empleadoId: parsed.empleadoId ?? null,
      fondoInicialCup: parsed.fondoInicialCup ?? 0,
      fondoInicialUsd: parsed.fondoInicialUsd ?? 0,
      observaciones: parsed.observaciones ?? null,
      estado: 'ABIERTO',
      tipo: 'NORMAL',
    },
    include: TURNOS_INCLUDE,
  });

  revalidatePath('/busy/puntosDeVenta');
  revalidatePath('/busy/sales');
  return turno;
});

/**
 * @description Lista turnos con filtros opcionales por POS, fecha o estado.
 *
 * @param {ListarTurnosInput} input - Filtros
 * @returns {Promise<TurnoPuntoVenta[]>} Lista de turnos
 */
export const getTurnosAction = withAction(async (input: ListarTurnosInput, user: AuthenticatedUser) => {
  const parsed = listarTurnosSchema.parse(input);
  const tenantId = requireTenant(user);

  const where: Record<string, unknown> = { tenantId };

  if (parsed.puntoDeVentaId) {
    where.puntoDeVentaId = parsed.puntoDeVentaId;
  }
  if (parsed.estado) {
    where.estado = parsed.estado;
  }
  if (parsed.fecha) {
    const fechaInicio = new Date(`${parsed.fecha}T00:00:00`);
    const fechaFin = new Date(`${parsed.fecha}T23:59:59.999`);
    where.fechaApertura = { gte: fechaInicio, lte: fechaFin };
  }

  return prisma.turnoPuntoVenta.findMany({
    where,
    include: TURNOS_INCLUDE,
    orderBy: { fechaApertura: 'desc' },
    take: parsed.limit ?? 50,
  });
});

/**
 * @description Obtiene el turno activo de un punto de venta, o null si no existe.
 *
 * @param {string} puntoDeVentaId - ID del punto de venta
 * @param {AuthenticatedUser} user - Usuario autenticado
 * @returns {Promise<TurnoPuntoVenta | null>} Turno activo o null
 */
export const getTurnoActivoAction = withAction(async (puntoDeVentaId: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);

  const turno = await prisma.turnoPuntoVenta.findFirst({
    where: {
      puntoDeVentaId,
      tenantId,
      estado: 'ABIERTO',
    },
    include: TURNOS_INCLUDE,
  });

  return turno;
});

/**
 * @description Cierra un turno. Si forzar=false y no hay arqueo, devuelve advertencia.
 *
 * @param {CerrarTurnoInput} input - Datos de cierre
 * @returns {Promise<{ turno: TurnoPuntoVenta, warning?: string }>}
 * @throws {ActionError} Si el turno no existe, no está abierto o no pertenece al tenant
 */
export const cerrarTurnoAction = withAction(async (input: CerrarTurnoInput, user: AuthenticatedUser) => {
  const parsed = cerrarTurnoSchema.parse(input);
  const tenantId = requireTenant(user);

  const turno = await prisma.turnoPuntoVenta.findFirst({
    where: { id: parsed.turnoId, tenantId },
    include: { arqueo: true },
  });
  if (!turno) throw new ActionError('Turno no encontrado', 'NOT_FOUND');
  if (turno.estado !== 'ABIERTO') {
    throw new ActionError('El turno ya está cerrado', 'CONFLICT');
  }

  // Si no hay arqueo y no se fuerza, advertir
  if (!turno.arqueo && !parsed.forzar) {
    return {
      turno,
      warning: 'No se ha realizado arqueo de caja. Use forzar=true para cerrar sin arqueo.',
    };
  }

  const turnoActualizado = await prisma.turnoPuntoVenta.update({
    where: { id: parsed.turnoId },
    data: {
      estado: 'CERRADO',
      fechaCierre: new Date(),
      observaciones: turno.arqueo
        ? turno.observaciones
        : (turno.observaciones
          ? `${turno.observaciones} | Cerrado sin arqueo`
          : 'Cerrado sin arqueo'),
    },
    include: TURNOS_INCLUDE,
  });

  revalidatePath('/busy/puntosDeVenta');
  revalidatePath('/busy/sales');
  return { turno: turnoActualizado };
});

/**
 * @description Obtiene o crea un turno activo para un punto de venta.
 * Usado internamente por createVentaAction.
 * - POS tipo PRINCIPAL: requiere turno existente, no lo crea automáticamente.
 * - POS tipo MOVIL/SECUNDARIA: crea turno automático si no hay uno activo.
 *
 * @param {Object} params - Parámetros
 * @param {string} params.puntoDeVentaId - ID del punto de venta
 * @param {AuthenticatedUser} params.user - Usuario autenticado
 * @returns {Promise<{ turnoId: string, created: boolean }>}
 * @throws {ActionError} Si POS es PRINCIPAL y no hay turno activo
 */
export const getOrCreateTurnoActivo = withAction(async (
  params: { puntoDeVentaId: string; empleadoId?: string | null },
  user: AuthenticatedUser,
) => {
  const parsed = turnoAutomaticoSchema.parse(params);
  const tenantId = requireTenant(user);

  // Buscar turno activo existente
  const turnoActivo = await prisma.turnoPuntoVenta.findFirst({
    where: {
      puntoDeVentaId: parsed.puntoDeVentaId,
      estado: 'ABIERTO',
    },
  });
  if (turnoActivo) return { turnoId: turnoActivo.id, created: false };

  // Obtener el tipo de caja del POS
  const pv = await prisma.puntoDeVenta.findFirst({
    where: { pvId: parsed.puntoDeVentaId, tenantId },
    select: { tipoCaja: true },
  });
  if (!pv) throw new ActionError('Punto de venta no encontrado', 'NOT_FOUND');

  // PRINCIPAL: no crear turno automático
  if (pv.tipoCaja === 'PRINCIPAL' || !pv.tipoCaja) {
    throw new ActionError(
      'Debe abrir un turno antes de vender. Use la opción "Abrir Turno" en el POS.',
      'NO_TURNO_ACTIVO',
    );
  }

  // MOVIL / SECUNDARIA: crear turno automático
  const turno = await prisma.turnoPuntoVenta.create({
    data: {
      tenantId,
      puntoDeVentaId: parsed.puntoDeVentaId,
      empleadoId: parsed.empleadoId ?? null,
      fondoInicialCup: 0,
      fondoInicialUsd: 0,
      estado: 'ABIERTO',
      tipo: 'AUTO',
    },
  });

  return { turnoId: turno.id, created: true };
});
