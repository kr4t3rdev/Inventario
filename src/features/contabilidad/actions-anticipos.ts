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
import { requireTenant } from '@/lib/services/tenant-scope';
import { withPeriodValidation } from '@/lib/services/with-period-validation';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── Schemas ───────────────────────────────────────────────

const createSchema = z.object({
  tipo: z.enum(['PAGO', 'COBRO']),
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  moneda: z.string().optional().default('CUP'),
  proveedorId: z.string().optional().nullable(),
  clienteId: z.string().optional().nullable(),
  contratoId: z.string().optional().nullable(),
  concepto: z.string().optional(),
  observaciones: z.string().optional(),
  fechaAnticipo: z.string().optional(),
  cuentaOrigenId: z.string().optional().nullable(),
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
    const parsed = createSchema.parse(input);
    const tenantId = requireTenant(user);

    const anticipo = await prisma.anticipo.create({
      data: {
        tipo: parsed.tipo,
        montoOriginal: parsed.monto,
        saldoDisponible: parsed.monto,
        moneda: parsed.moneda,
        proveedor: parsed.proveedorId ? { connect: { vendorId: parsed.proveedorId } } : undefined,
        cliente: parsed.clienteId ? { connect: { clienteId: parsed.clienteId } } : undefined,
        contrato: { connect: { contratoId: parsed.contratoId! } },
        cuentaOrigenId: parsed.cuentaOrigenId,
        tenant: { connect: { tenantId } },
        creador: { connect: { userId: user.userId } },
        estado: 'RESERVADO',
      },
    });

    revalidatePath('/busy/contabilidad/anticipos');
    return { anticipo };
  }
));

export const executeAnticipoAction = withAction(async (input: z.infer<typeof executeSchema>, user: AuthenticatedUser) => {
  const parsed = executeSchema.parse(input);
  const tenantId = requireTenant(user);

  const anticipo = await prisma.anticipo.findFirst({
    where: { anticipoId: parsed.anticipoId, tenantId },
  });
  if (!anticipo) throw new ActionError('Anticipo no encontrado', 'NOT_FOUND');

  const updated = await prisma.anticipo.update({
    where: { anticipoId: parsed.anticipoId },
    data: { estado: 'EJECUTADO' },
  });

  revalidatePath('/busy/contabilidad/anticipos');
  return { anticipo: updated };
});

export const reverseAnticipoAction = withAction(async (input: z.infer<typeof reverseSchema>, user: AuthenticatedUser) => {
  const parsed = reverseSchema.parse(input);
  const tenantId = requireTenant(user);

  const anticipo = await prisma.anticipo.findFirst({
    where: { anticipoId: parsed.anticipoId, tenantId },
  });
  if (!anticipo) throw new ActionError('Anticipo no encontrado', 'NOT_FOUND');

  const updated = await prisma.anticipo.update({
    where: { anticipoId: parsed.anticipoId },
    data: { estado: 'ANULADO' },
  });

  revalidatePath('/busy/contabilidad/anticipos');
  return { anticipo: updated };
});

export const getResumenAnticiposAction = withAction(async (params: { fechaInicio?: string; fechaFin?: string; tipo?: string } = {}, _user: AuthenticatedUser) => {
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
