'use server';

/**
 * @description Server Action de alertas de vencimiento de lotes (fase 5.4).
 * La ventana de aviso es configurable por tenant (Mi Empresa) y está acotada
 * a 30 días por defecto; cada llamada puede ajustarla dentro del rango.
 */

import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { withAction } from '@/lib/server-actions';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  calcularAlertasVencimientoLotes,
  resolverDiasAlertaVencimiento,
  type LoteParaAlerta,
} from './lib/alertas-vencimiento';

const MS_POR_DIA = 86_400_000;

const alertasVencimientoInputSchema = z
  .object({
    diasAlerta: z.coerce.number().int().optional(),
  })
  .optional();

export type AlertasVencimientoInput = z.infer<typeof alertasVencimientoInputSchema>;

/**
 * @description Trunca una fecha al inicio de su día UTC.
 * @param {Date} fecha - Fecha a truncar.
 * @returns {Date} Misma fecha a las 00:00 UTC.
 */
function truncarAlDiaUTC(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

/**
 * @description Obtiene las alertas de vencimiento de lotes del tenant autenticado.
 * Requiere el feature `lotes-series` (plan Profesional o superior).
 * @param {AlertasVencimientoInput} input - Ventana opcional en días (1..30).
 * @param {AuthenticatedUser} user - Usuario autenticado con tenant activo.
 * @returns {Promise<Object>} Alertas, totales por estado y ventana aplicada.
 */
export const getAlertasVencimientoAction = withAction(
  async (input: AlertasVencimientoInput, user: AuthenticatedUser) => {
    requireFeature(user, 'lotes-series', 'gestionar lotes y series');
    const tenantId = requireTenant(user);
    const parsed = alertasVencimientoInputSchema.parse(input ?? {});

    const empresa = await prisma.miEmpresa.findFirst({
      where: { tenantId },
      select: { diasAlertaVencimientoLotes: true },
    });

    const diasAlerta = resolverDiasAlertaVencimiento(
      parsed?.diasAlerta ?? empresa?.diasAlertaVencimientoLotes,
    );

    const hoy = new Date();
    const limite = new Date(
      truncarAlDiaUTC(hoy).getTime() + (diasAlerta + 1) * MS_POR_DIA - 1,
    );

    const lotes = await prisma.lote.findMany({
      where: {
        tenantId,
        cantidadDisponible: { gt: 0 },
        fechaVencimiento: { not: null, lte: limite },
      },
      select: {
        id: true,
        codigo: true,
        fechaVencimiento: true,
        cantidadDisponible: true,
        producto: { select: { id: true, nombre: true } },
      },
      orderBy: [{ fechaVencimiento: 'asc' }, { codigo: 'asc' }],
    });

    const alertas = calcularAlertasVencimientoLotes(lotes as LoteParaAlerta[], {
      hoy,
      diasAlerta,
    });

    const vencidos = alertas.filter((alerta) => alerta.estado === 'VENCIDO').length;

    return {
      alertas,
      total: alertas.length,
      vencidos,
      porVencer: alertas.length - vencidos,
      diasAlerta,
    };
  },
);
