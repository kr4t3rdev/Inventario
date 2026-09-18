/**
 * @description Server Action para consultar el historial de cuadres cerrados.
 */
'use server';

import { withAction } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import { z } from 'zod';

import type { AuthenticatedUser } from '@/lib/auth-middleware';

const getCuadresCerradosSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  puntoDeVentaId: z.string().optional(),
});

export interface CuadreCerradoListItem {
  turnoId: string;
  puntoDeVentaNombre: string;
  empleadoNombre: string | null;
  fechaApertura: Date;
  fechaCierre: Date | null;
  totalVentas: number;
  diferenciaCup: number | null;
  arqueado: boolean;
  totalTickets: number;
}

/**
 * @description Lista turnos cerrados con el resumen mínimo necesario para consultar su cuadre.
 * @param {{ limit?: number; puntoDeVentaId?: string }} input - Filtros opcionales del historial.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<CuadreCerradoListItem[]>} Historial de turnos cerrados consultables.
 */
export const getCuadresCerradosAction = withAction(
  async (
    input: z.infer<typeof getCuadresCerradosSchema> = { limit: 50 },
    user: AuthenticatedUser,
  ) => {
    requireFeature(user, 'turnos-pos', 'consultar historial de cuadres POS');
    const tenantId = requireTenant(user);
    const parsed = getCuadresCerradosSchema.parse(input);

    const turnos = await prisma.turnoPuntoVenta.findMany({
      where: {
        tenantId,
        estado: 'CERRADO',
        ...(parsed.puntoDeVentaId ? { puntoDeVentaId: parsed.puntoDeVentaId } : {}),
      },
      include: {
        puntoDeVenta: {
          select: {
            nombre: true,
          },
        },
        empleado: {
          select: {
            nombre: true,
            apellido: true,
          },
        },
        arqueos: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            diferenciaCup: true,
          },
        },
        ventas: {
          where: {
            deletedAt: null,
          },
          select: {
            total: true,
          },
        },
        _count: {
          select: {
            ventas: true,
          },
        },
      },
      orderBy: {
        fechaCierre: 'desc',
      },
      take: parsed.limit,
    });

    return turnos.map<CuadreCerradoListItem>((turno) => {
      const ultimoArqueo = turno.arqueos[0] ?? null;
      const empleadoNombre = turno.empleado
        ? `${turno.empleado.nombre} ${turno.empleado.apellido}`.trim()
        : null;

      return {
        turnoId: turno.id,
        puntoDeVentaNombre: turno.puntoDeVenta.nombre,
        empleadoNombre,
        fechaApertura: turno.fechaApertura,
        fechaCierre: turno.fechaCierre,
        totalVentas: turno.ventas.reduce((sum, venta) => sum + (venta.total ?? 0), 0),
        diferenciaCup:
          ultimoArqueo && typeof ultimoArqueo.diferenciaCup === 'number'
            ? ultimoArqueo.diferenciaCup / 100
            : null,
        arqueado: Boolean(ultimoArqueo),
        totalTickets: turno._count.ventas,
      };
    });
  },
);
