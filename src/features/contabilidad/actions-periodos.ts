/**
 * @description Server Actions para gestión de períodos contables.
 *
 * Proporciona queries y mutations para apertura, cierre, reapertura
 * y aprobación de períodos contables. Usa el patrón withAction + requireTenant
 * para autenticación y aislamiento multi-tenant.
 *
 * @module actions-periodos
 */

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { PeriodoContableService } from '@/lib/services/periodo-contable-service';
import { SnapshotService } from '@/lib/services/periodo-snapshot-service';
import { invalidateCache } from '@/lib/services/periodo-contable-guard';
import { TipoPeriodo, EstadoPeriodo } from '@/lib/services/periodo-contable-types';
import { prisma } from '@/lib/prisma';

// ── Schemas de validación ─────────────────────────────────────────────────

/**
 * Schema para abrir un nuevo período contable.
 * Valida tipo, fechas ISO y observaciones opcionales.
 */
const abrirPeriodoSchema = z.object({
  tipo: z.nativeEnum(TipoPeriodo),
  fechaInicio: z.string().datetime({ message: 'La fecha de inicio debe ser una fecha válida' }),
  fechaFin: z.string().datetime({ message: 'La fecha de fin debe ser una fecha válida' }),
  observaciones: z.string().max(500).optional(),
});

/**
 * Schema para cerrar un período existente.
 */
const cerrarPeriodoSchema = z.object({
  periodoId: z.string().min(1, 'El ID del período es obligatorio'),
});

/**
 * Schema para reaperturar un período aprobado.
 * El motivo es obligatorio con mínimo 10 caracteres.
 */
const reabrirPeriodoSchema = z.object({
  periodoId: z.string().min(1, 'El ID del período es obligatorio'),
  motivo: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
});

/**
 * Schema para aprobar un período cerrado.
 */
const aprobarPeriodoSchema = z.object({
  periodoId: z.string().min(1, 'El ID del período es obligatorio'),
});

// ── Queries ───────────────────────────────────────────────────────────────

/**
 * @description Lista los períodos contables del tenant con filtros opcionales.
 *
 * @param {Object} input - Parámetros de filtrado y paginación.
 * @param {TipoPeriodo} [input.tipo] - Filtrar por tipo de período.
 * @param {EstadoPeriodo} [input.estado] - Filtrar por estado.
 * @param {number} [input.page=1] - Página actual.
 * @param {number} [input.limit=50] - Items por página.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} Lista de períodos con paginación.
 */
export const listarPeriodosAction = withAction(async (
  input: {
    tipo?: TipoPeriodo;
    estado?: EstadoPeriodo;
    page?: number;
    limit?: number;
  } = {},
  user: AuthenticatedUser,
) => {
  const tenantId = requireTenant(user);
  const { tipo, estado, page = 1, limit = 50 } = input;

  const where: Record<string, unknown> = { tenantId };
  if (tipo) where.tipo = tipo;
  if (estado) where.estado = estado;

  const [periodos, total] = await Promise.all([
    prisma.periodoContable.findMany({
      where,
      orderBy: [{ fechaInicio: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.periodoContable.count({ where }),
  ]);

  return {
    periodos: periodos.map((p) => ({
      ...p,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});

/**
 * @description Obtiene el detalle de un período con su timeline de auditoría.
 *
 * @param {string} periodoId - ID del período a consultar.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} Detalle del período con auditoría.
 */
export const obtenerPeriodoAction = withAction(async (
  periodoId: string,
  user: AuthenticatedUser,
) => {
  const tenantId = requireTenant(user);

  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId, tenantId },
    include: {
      snapshots: { orderBy: { createdAt: 'desc' } },
      auditoria: { orderBy: { timestamp: 'desc' } },
    },
  });

  if (!periodo) {
    throw new ActionError('Período no encontrado', 'NOT_FOUND');
  }

  const timeline = await PeriodoContableService.obtenerTimeline(periodoId);

  return {
    periodo,
    timeline,
  };
});

/**
 * @description Obtiene el timeline de eventos de auditoría de un período.
 *
 * @param {string} periodoId - ID del período.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Array} Timeline de eventos de auditoría ordenado cronológicamente.
 */
export const obtenerTimelineAction = withAction(async (
  periodoId: string,
  user: AuthenticatedUser,
) => {
  const tenantId = requireTenant(user);

  // Verificar que el período pertenece al tenant
  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId, tenantId },
    select: { periodoId: true },
  });

  if (!periodo) {
    throw new ActionError('Período no encontrado', 'NOT_FOUND');
  }

  const timeline = await PeriodoContableService.obtenerTimeline(periodoId);

  return { timeline };
});

// ── Mutations ─────────────────────────────────────────────────────────────

/**
 * @description Abre un nuevo período contable con validación de solapamiento.
 *
 * El período se crea directamente en estado ABIERTO.
 * Valida que no exista otro período del mismo tipo con fechas solapadas.
 *
 * @param {Object} input - Datos del período a crear.
 * @param {TipoPeriodo} input.tipo - Tipo de período (DIARIO, MENSUAL, ANUAL).
 * @param {string} input.fechaInicio - Fecha de inicio (ISO string).
 * @param {string} input.fechaFin - Fecha de fin (ISO string).
 * @param {string} [input.observaciones] - Observaciones opcionales.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período creado.
 */
export const abrirPeriodoAction = withAction(async (
  input: z.infer<typeof abrirPeriodoSchema>,
  user: AuthenticatedUser,
) => {
  const tenantId = requireTenant(user);
  const parsed = abrirPeriodoSchema.parse(input);

  const fechaInicio = new Date(parsed.fechaInicio);
  const fechaFin = new Date(parsed.fechaFin);

  // Validar que fechaInicio <= fechaFin
  if (fechaInicio > fechaFin) {
    throw new ActionError('La fecha de inicio no puede ser posterior a la fecha de fin', 'FECHAS_INVALIDAS');
  }

  const periodo = await PeriodoContableService.abrirPeriodo(
    {
      tenantId,
      tipo: parsed.tipo,
      fechaInicio,
      fechaFin,
      observaciones: parsed.observaciones,
    },
    user.userId,
  );

  // Invalidar caché del guard para este tenant
  invalidateCache(tenantId);

  revalidatePath('/busy/contabilidad/periodos');

  return { periodo };
});

/**
 * @description Cierra un período contable generando un snapshot automático.
 *
 * Flujo: valida transición → valida hijos → cierra período → genera snapshot.
 * Para períodos mensuales o anuales, verifica que no haya hijos abiertos.
 *
 * @param {Object} input - ID del período a cerrar.
 * @param {string} input.periodoId - ID del período.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período cerrado con snapshot generado.
 */
export const cerrarPeriodoAction = withAction(async (
  input: z.infer<typeof cerrarPeriodoSchema>,
  user: AuthenticatedUser,
) => {
  const tenantId = requireTenant(user);
  const parsed = cerrarPeriodoSchema.parse(input);

  // Verificar ownership del tenant
  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId: parsed.periodoId, tenantId },
  });

  if (!periodo) {
    throw new ActionError('Período no encontrado', 'NOT_FOUND');
  }

  // Cerrar período (incluye validación de transición e hijos)
  const cerrado = await PeriodoContableService.cerrarPeriodo(
    parsed.periodoId,
    user.userId,
  );

  // Generar snapshot automático del período cerrado
  const snapshotService = new SnapshotService();
  const snapshots = await snapshotService.generarSnapshot(
    parsed.periodoId,
    'caja',
    user.userId,
  );

  // Invalidar caché del guard
  invalidateCache(tenantId);

  revalidatePath('/busy/contabilidad/periodos');

  return {
    periodo: cerrado,
    snapshots: snapshots.length,
  };
});

/**
 * @description Reabre un período APROBADO con motivo obligatorio.
 *
 * Requiere un motivo de al menos 10 caracteres para trazabilidad.
 * Transición: APROBADO → REABIERTO.
 *
 * @param {Object} input - ID del período y motivo de reapertura.
 * @param {string} input.periodoId - ID del período.
 * @param {string} input.motivo - Motivo de reapertura (mínimo 10 caracteres).
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período reabierto.
 */
export const reabrirPeriodoAction = withAction(async (
  input: z.infer<typeof reabrirPeriodoSchema>,
  user: AuthenticatedUser,
) => {
  const tenantId = requireTenant(user);
  const parsed = reabrirPeriodoSchema.parse(input);

  // Verificar ownership del tenant
  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId: parsed.periodoId, tenantId },
  });

  if (!periodo) {
    throw new ActionError('Período no encontrado', 'NOT_FOUND');
  }

  const reabierto = await PeriodoContableService.reabrirPeriodo(
    parsed.periodoId,
    user.userId,
    parsed.motivo,
  );

  // Invalidar caché del guard
  invalidateCache(tenantId);

  revalidatePath('/busy/contabilidad/periodos');

  return { periodo: reabierto };
});

/**
 * @description Aprueba un período CERRADO.
 *
 * Transición: CERRADO → APROBADO.
 * Esta acción es irreversible excepto vía reapertura con motivo.
 *
 * @param {Object} input - ID del período a aprobar.
 * @param {string} input.periodoId - ID del período.
 * @param {AuthenticatedUser} user - Usuario autenticado (inyectado por withAction).
 * @returns {Object} El período aprobado.
 */
export const aprobarPeriodoAction = withAction(async (
  input: z.infer<typeof aprobarPeriodoSchema>,
  user: AuthenticatedUser,
) => {
  const tenantId = requireTenant(user);
  const parsed = aprobarPeriodoSchema.parse(input);

  // Verificar ownership del tenant
  const periodo = await prisma.periodoContable.findFirst({
    where: { periodoId: parsed.periodoId, tenantId },
  });

  if (!periodo) {
    throw new ActionError('Período no encontrado', 'NOT_FOUND');
  }

  const aprobado = await PeriodoContableService.aprobarPeriodo(
    parsed.periodoId,
    user.userId,
  );

  revalidatePath('/busy/contabilidad/periodos');

  return { periodo: aprobado };
});
