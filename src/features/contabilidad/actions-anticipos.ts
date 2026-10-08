/**
 * @description Server Actions para Anticipos.
 * Reemplazan el uso de contabilidadApi (RTK Query).
 *
 * @module features/contabilidad/actions-anticipos
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requirePermission, requireTenant } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { createAnticipo } from '@/lib/services/anticipos-workflow';

// ─── Schemas ───────────────────────────────────────────────

const createSchema = z.object({
  tipo: z.enum(['PAGO', 'COBRO']),
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  proveedorId: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  contratoId: z.string().min(1),
  concepto: z.string().optional(),
  observaciones: z.string().optional(),
  fechaAnticipo: z.string().optional(),
  vigenciaHasta: z.string().optional(),
  cuentaOrigenId: z.string().min(1),
  tipoPagoOrigenId: z.string().min(1),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

const executeSchema = z.object({
  anticipoId: z.string().min(1),
  montoEjecutar: z.coerce.number().positive(),
  documentoDestinoId: z.string().optional(),
  tipoDocumento: z.string().optional(),
  observaciones: z.string().optional(),
});

const reverseSchema = z.object({
  anticipoId: z.string().min(1),
  montoReverso: z.coerce.number().positive(),
  documentoDestinoId: z.string().optional(),
  observaciones: z.string().optional(),
});

// ─── Server Actions ────────────────────────────────────────

export const getAnticiposAction = withAction(async (params: {
  tipo?: string;
  estado?: string;
  proveedorId?: string;
  clienteId?: string;
  moneda?: string;
} = {}, user: AuthenticatedUser) => {
  requireFeature(user, 'anticipos', 'consultar anticipos');
  const tenantId = requireTenant(user);
  const where: any = { tenantId };
  if (params.tipo) where.tipo = params.tipo;
  if (params.estado) where.estado = params.estado;
  if (params.proveedorId) where.proveedorId = params.proveedorId;
  if (params.clienteId) where.clienteId = params.clienteId;
  if (params.moneda) where.moneda = params.moneda;

  const anticipos = await prisma.anticipo.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  return { anticipos };
});

export const getAnticipoByIdAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'anticipos', 'consultar anticipo');
  const tenantId = requireTenant(user);
  const anticipo = await prisma.anticipo.findFirst({
    where: { anticipoId: id, tenantId },
    include: {
      movimientos: { orderBy: { createdAt: 'desc' } },
      cliente: { select: { clienteId: true, nombre: true } },
      proveedor: { select: { vendorId: true, nombre: true } },
      contrato: { select: { contratoId: true, numeroContrato: true } },
    },
  });
  if (!anticipo) throw new ActionError('Anticipo no encontrado', 'NOT_FOUND');
  return { anticipo };
});

export const createAnticipoAction = withAction(withPeriodValidation(
  (input) => input.fechaAnticipo ? new Date(input.fechaAnticipo) : new Date(),
  async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
    requireFeature(user, 'anticipos', 'crear anticipos');
    requirePermission(user, 'financiero.contabilidad.acceder', 'crear anticipos');
    const parsed = createSchema.parse(input);
    const tenantId = requireTenant(user);

    const anticipo = await prisma.$transaction((tx) => createAnticipo(tx, {
      tipo: parsed.tipo,
      monto: parsed.monto,
      moneda: parsed.moneda,
      contratoId: parsed.contratoId,
      proveedorId: parsed.proveedorId ?? undefined,
      clienteId: parsed.clienteId ?? undefined,
      cuentaOrigenId: parsed.cuentaOrigenId,
      tipoPagoOrigenId: parsed.tipoPagoOrigenId,
      idempotencyKey: parsed.idempotencyKey,
      referenciaExterna: parsed.concepto ?? parsed.observaciones,
      vigenciaHasta: parsed.vigenciaHasta,
      tenantId,
      usuarioId: user.userId,
    }));

    revalidatePath('/busy/contabilidad/anticipos');
    return { anticipo };
  }
));

export const executeAnticipoAction = withAction(withPeriodValidation(
  () => new Date(),
  async (input: z.infer<typeof executeSchema>, user: AuthenticatedUser) => {
    requireFeature(user, 'anticipos', 'ejecutar anticipos');
    requirePermission(user, 'financiero.contabilidad.acceder', 'ejecutar anticipos');
    executeSchema.parse(input);
    requireTenant(user);
    throw new ActionError(
      'El anticipo se aplica automáticamente al crear el documento que lo consume. No se permite ejecución manual.',
      'DOCUMENT_WORKFLOW_REQUIRED',
    );
}));

export const reverseAnticipoAction = withAction(withPeriodValidation(
  () => new Date(),
  async (input: z.infer<typeof reverseSchema>, user: AuthenticatedUser) => {
    requireFeature(user, 'anticipos', 'anular anticipos');
    requirePermission(user, 'financiero.contabilidad.acceder', 'anular anticipos');
    reverseSchema.parse(input);
    requireTenant(user);
    throw new ActionError(
      'La reversión de un anticipo debe realizarse al revertir el documento que lo consumió.',
      'DOCUMENT_WORKFLOW_REQUIRED',
    );
}));

export const getResumenAnticiposAction = withAction(async (params: { fechaInicio?: string; fechaFin?: string; tipo?: string } = {}, user: AuthenticatedUser) => {
  requireFeature(user, 'anticipos', 'consultar resumen de anticipos');
  const where: any = {};
  if (params.tipo) where.tipo = params.tipo;
  if (params.fechaInicio || params.fechaFin) {
    where.fechaReserva = {};
    if (params.fechaInicio) where.fechaReserva.gte = new Date(params.fechaInicio);
    if (params.fechaFin) where.fechaReserva.lte = new Date(params.fechaFin);
  }

  const anticipos = await prisma.anticipo.findMany({
    where, select: { tipo: true, estado: true, moneda: true, montoOriginal: true, saldoDisponible: true }
  });

  const porTipo = anticipos.reduce((acc: Record<string, number>, a) => { const k = a.tipo || 'UNKNOWN'; acc[k] = (acc[k]||0) + Number(a.montoOriginal||0); return acc; }, {});
  const porEstado = anticipos.reduce((acc: Record<string, number>, a) => { const k = a.estado || 'UNKNOWN'; acc[k] = (acc[k]||0) + 1; return acc; }, {});
  const porMoneda = anticipos.reduce((acc: Record<string, { total: number; pendiente: number }>, a) => {
    const k = a.moneda || 'CUP';
    if (!acc[k]) acc[k] = { total: 0, pendiente: 0 };
    acc[k].total += Number(a.montoOriginal||0);
    acc[k].pendiente += Number(a.saldoDisponible||0);
    return acc;
  }, {});

  const totalAnticipos = anticipos.reduce((s, a) => s + Number(a.montoOriginal||0), 0);
  const totalPendiente = anticipos.reduce((s, a) => s + Number(a.saldoDisponible||0), 0);

  return {
    resumen: { porTipo, porEstado, porMoneda, totalesGenerales: { totalAnticipos, totalEjecutado: totalAnticipos - totalPendiente, totalPendiente } }
  };
});
