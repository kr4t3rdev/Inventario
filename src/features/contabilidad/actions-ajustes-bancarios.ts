/**
 * @description Server Actions para Ajustes Bancarios.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const createSchema = z.object({
  cuentaId: z.string().min(1, 'ID de cuenta es requerido'),
  tipo: z.enum(['ingreso', 'egreso']),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  moneda: z.string().min(1, 'Moneda es requerida').default('CUP'),
  descripcion: z.string().min(1, 'Descripción es obligatoria'),
  motivo: z.string().min(1, 'Motivo es obligatorio')
});

export const getAjustesByCuentaAction = withAction(async (params: { cuentaId: string; page?: number; limit?: number; fechaInicio?: string; fechaFin?: string; tipo?: string }, user: AuthenticatedUser) => {
  const { cuentaId, page = 1, limit = 50, fechaInicio, fechaFin, tipo } = params;
  const where: any = {};

  if (cuentaId !== 'all') where.cuentaId = cuentaId;
  if (tipo) where.tipo = tipo;
  if (fechaInicio || fechaFin) {
    where.createdAt = {};
    if (fechaInicio) where.createdAt.gte = new Date(fechaInicio);
    if (fechaFin) {
      const f = new Date(fechaFin);
      f.setHours(23, 59, 59, 999);
      where.createdAt.lte = f;
    }
  }

  const offset = (page - 1) * limit;

  const [ajustes, totalCount] = await Promise.all([
    prisma.ajusteBancario.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: { cuentaBancaria: { select: { nombreBanco: true, numeroCuenta: true, moneda: true } } }
    }),
    prisma.ajusteBancario.count({ where })
  ]);

  const ajustesConUsuario = ajustes.map((a: any) => ({
    ...a,
    realizadoPorInfo: { userId: a.realizadoPor }
  }));

  let cuentaBancariaInfo = null;
  if (cuentaId !== 'all') {
    const cb = await prisma.cuentaBancaria.findUnique({ where: { cuentaId }, select: { cuentaId: true, nombreBanco: true, numeroCuenta: true, saldo: true, moneda: true } });
    if (cb) cuentaBancariaInfo = cb;
  }

  return {
    ajustes: ajustesConUsuario,
    cuentaBancaria: cuentaBancariaInfo,
    pagination: { currentPage: page, totalPages: Math.ceil(totalCount / limit), totalCount, limit, hasNextPage: page < Math.ceil(totalCount / limit), hasPrevPage: page > 1 },
  };
});

export const createAjusteBancarioAction = withAction(async (input: z.infer<typeof createSchema>, user: AuthenticatedUser) => {
  const parsed = createSchema.parse(input);

  const cuenta = await prisma.cuentaBancaria.findUnique({ where: { cuentaId: parsed.cuentaId } });
  if (!cuenta) throw new ActionError('Cuenta bancaria no encontrada', 'CUENTA_NO_ENCONTRADA');
  if (!cuenta.isActive) throw new ActionError('La cuenta bancaria está inactiva', 'CUENTA_INACTIVA');

  const montoAjuste = parsed.tipo === 'ingreso' ? parsed.monto : -parsed.monto;
  const nuevoSaldo = Number(cuenta.saldo) + montoAjuste;
  const saldoNegativo = nuevoSaldo < 0;

  const resultado = await prisma.$transaction(async (tx: any) => {
    const ajuste = await tx.ajusteBancario.create({
      data: {
        cuentaId: parsed.cuentaId,
        tipo: parsed.tipo,
        monto: parsed.monto,
        moneda: parsed.moneda,
        descripcion: parsed.descripcion,
        motivo: parsed.motivo,
        realizadoPor: user.userId
      }
    });

    await tx.cuentaBancaria.update({
      where: { cuentaId: parsed.cuentaId },
      data: { saldo: nuevoSaldo }
    });

    return ajuste;
  });

  await AuditLogService.log({
    accion: 'CREATE', entidad: 'AJUSTE_BANCARIO', entidadId: resultado.ajusteId, usuarioId: user.userId,
    detalles: { tipo: parsed.tipo, monto: parsed.monto, moneda: parsed.moneda, cuenta: cuenta.nombreBanco, motivo: parsed.motivo, saldoAnterior: Number(cuenta.saldo), saldoNuevo: nuevoSaldo }
  });

  revalidatePath('/busy/contabilidad/ajustes');
  return { ajuste: resultado, saldoAnterior: Number(cuenta.saldo), saldoNuevo: nuevoSaldo, advertenciaSaldoNegativo: saldoNegativo, message: saldoNegativo ? 'Ajuste creado exitosamente. ADVERTENCIA: El saldo de la cuenta es negativo.' : 'Ajuste bancario creado exitosamente' };
});
