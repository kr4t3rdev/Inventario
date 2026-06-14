/**
 * @description Server Actions para Tipos de Pago.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { AccountingConfigReadService } from '@/features/contabilidad/services/accounting-config-read-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const _countSelect = {
  select: { reconciliacionesVenta: true, reconciliacionesServicio: true, reconciliacionesGasto: true }
} as const;

const createSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  requiereCuenta: z.boolean().default(true),
  cuentaDefecto: z.string().optional(),
  isActive: z.boolean().default(true)
}).refine((data) => {
  if (data.requiereCuenta && !data.cuentaDefecto) return false;
  return true;
}, { message: 'Si el tipo de pago requiere cuenta, debe especificar una cuenta por defecto', path: ['cuentaDefecto'] });

const updateSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  requiereCuenta: z.boolean().optional(),
  cuentaDefecto: z.string().nullable().optional(),
  isActive: z.boolean().optional()
}).refine((data) => {
  if (data.requiereCuenta === true && !data.cuentaDefecto) return false;
  return true;
}, { message: 'Si el tipo de pago requiere cuenta, debe especificar una cuenta por defecto', path: ['cuentaDefecto'] });

async function enrichTiposPago(tipos: any[]) {
  return Promise.all(tipos.map(async (tipo: any) => {
    let cuentaDefectoInfo = null;
    if (tipo.cuentaDefecto) {
      cuentaDefectoInfo = await prisma.cuentaBancaria.findUnique({
        where: { cuentaId: tipo.cuentaDefecto },
        select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, tipoCuenta: true, moneda: true, isActive: true }
      });
    }
    return { ...tipo, cuentaDefectoInfo };
  }));
}

export const getTiposPagoAction = withAction(async (params: { includeInactive?: boolean; requiereCuenta?: boolean } = {}, _user: AuthenticatedUser) => {
  return AccountingConfigReadService.getPaymentTypes(params);
});

export const getTipoPagoAction = withAction(async (id: string, _user: AuthenticatedUser) => {
  const tipo = await prisma.tipoPago.findUnique({
    where: { tipoId: id },
    include: { _count: _countSelect }
  });
  if (!tipo) throw new ActionError('Tipo de pago no encontrado', 'PAYMENT_TYPE_NOT_FOUND');

  let cuentaDefectoInfo = null;
  if (tipo.cuentaDefecto) {
    cuentaDefectoInfo = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: tipo.cuentaDefecto },
      select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, tipoCuenta: true, moneda: true, isActive: true }
    });
  }

  return { ...tipo, cuentaDefectoInfo };
});

export const createTipoPagoAction = withAction(async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
  const parsed = createSchema.parse(input);

  const existing = await prisma.tipoPago.findFirst({ where: { nombre: { equals: parsed.nombre } } });
  if (existing) throw new ActionError('Ya existe un tipo de pago con ese nombre', 'PAYMENT_TYPE_NAME_EXISTS');

  if (parsed.cuentaDefecto) {
    const cuenta = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: parsed.cuentaDefecto } });
    if (!cuenta) throw new ActionError('La cuenta por defecto especificada no existe', 'DEFAULT_ACCOUNT_NOT_FOUND');
    if (!cuenta.isActive) throw new ActionError('La cuenta por defecto especificada no está activa', 'DEFAULT_ACCOUNT_INACTIVE');
  }

  const nuevo = await prisma.tipoPago.create({
    data: parsed,
    include: { _count: _countSelect }
  });

  await AuditLogService.log({
    accion: 'CREATE', entidad: 'TIPO_PAGO', entidadId: nuevo.tipoId, usuarioId: user.userId,
    detalles: { nombre: nuevo.nombre, requiereCuenta: nuevo.requiereCuenta, cuentaDefecto: nuevo.cuentaDefecto }
  });

  revalidatePath('/busy/contabilidad/configuracion');
  return { data: nuevo };
});

export const updateTipoPagoAction = withAction(async (input: z.infer<typeof updateSchema>, user: AuthenticatedUser) => {
  const parsed = updateSchema.parse(input);
  const { id, ...data } = parsed;

  const existing = await prisma.tipoPago.findUnique({ where: { tipoId: id }, include: { _count: _countSelect } });
  if (!existing) throw new ActionError('Tipo de pago no encontrado', 'PAYMENT_TYPE_NOT_FOUND');

  if (data.isActive === false) {
    const total = existing._count.reconciliacionesVenta + existing._count.reconciliacionesServicio + existing._count.reconciliacionesGasto;
    if (total > 0) throw new ActionError('No se puede desactivar un tipo de pago que tiene reconciliaciones asociadas', 'PAYMENT_TYPE_HAS_RECONCILIATIONS');
  }

  if (data.nombre && data.nombre !== existing.nombre) {
    const dup = await prisma.tipoPago.findFirst({ where: { nombre: { equals: data.nombre }, tipoId: { not: id } } });
    if (dup) throw new ActionError('Ya existe otro tipo de pago con ese nombre', 'PAYMENT_TYPE_NAME_EXISTS');
  }

  if (data.cuentaDefecto) {
    const cuenta = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: data.cuentaDefecto } });
    if (!cuenta) throw new ActionError('La cuenta por defecto especificada no existe', 'DEFAULT_ACCOUNT_NOT_FOUND');
    if (!cuenta.isActive) throw new ActionError('La cuenta por defecto especificada no está activa', 'DEFAULT_ACCOUNT_INACTIVE');
  }

  const requiereCuentaFinal = data.requiereCuenta ?? existing.requiereCuenta;
  const cuentaDefectoFinal = data.cuentaDefecto ?? existing.cuentaDefecto;
  if (requiereCuentaFinal && !cuentaDefectoFinal) {
    throw new ActionError('Si el tipo de pago requiere cuenta, debe especificar una cuenta por defecto', 'ACCOUNT_REQUIRED_BUT_NOT_PROVIDED');
  }

  const toUpdate: any = { ...data };
  if (data.requiereCuenta === false) toUpdate.cuentaDefecto = null;

  const updated = await prisma.tipoPago.update({
    where: { tipoId: id },
    data: toUpdate,
    include: { _count: _countSelect }
  });

  await AuditLogService.log({
    accion: 'UPDATE', entidad: 'TIPO_PAGO', entidadId: id, usuarioId: user.userId,
    detalles: { cambios: data, nombreAnterior: existing.nombre, nombreNuevo: updated.nombre }
  });

  let cuentaDefectoInfo = null;
  if (updated.cuentaDefecto) {
    cuentaDefectoInfo = await prisma.cuentaBancaria.findUnique({
      where: { cuentaId: updated.cuentaDefecto },
      select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, tipoCuenta: true, moneda: true, isActive: true }
    });
  }

  revalidatePath('/busy/contabilidad/configuracion');
  return { data: { ...updated, cuentaDefectoInfo } };
});

export const deleteTipoPagoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const existing = await prisma.tipoPago.findUnique({ where: { tipoId: id }, include: { _count: _countSelect } });
  if (!existing) throw new ActionError('Tipo de pago no encontrado', 'PAYMENT_TYPE_NOT_FOUND');

  const total = existing._count.reconciliacionesVenta + existing._count.reconciliacionesServicio + existing._count.reconciliacionesGasto;
  if (total > 0) throw new ActionError('No se puede eliminar un tipo de pago que tiene reconciliaciones asociadas', 'PAYMENT_TYPE_HAS_RECONCILIATIONS');

  await prisma.tipoPago.delete({ where: { tipoId: id } });

  await AuditLogService.log({
    accion: 'DELETE', entidad: 'TIPO_PAGO', entidadId: id, usuarioId: user.userId,
    detalles: { nombre: existing.nombre, requiereCuenta: existing.requiereCuenta, cuentaDefecto: existing.cuentaDefecto }
  });

  revalidatePath('/busy/contabilidad/configuracion');
  return { success: true };
});
