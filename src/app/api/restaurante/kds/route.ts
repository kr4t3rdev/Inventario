import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description Calcula minutos transcurridos desde una fecha.
 * @param {Date} date - Fecha base.
 * @returns {number} Minutos transcurridos.
 */
function getElapsedMinutes(date: Date): number {
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

/**
 * @description Obtiene cola KDS de comandas abiertas para cocina.
 * @param {NextRequest} _request - Request HTTP de consulta.
 * @returns {Promise<NextResponse>} Cola de cocina con prioridad por tiempo.
 */
export const GET = withAuthGet(async (_request: NextRequest) => {
  try {
    const comandas = await prisma.comanda.findMany({
      where: {
        estado: 'ABIERTA',
      },
      include: {
        mesa: {
          select: {
            mesaId: true,
            numero: true,
            estado: true,
          },
        },
        items: {
          include: {
            plato: {
              select: {
                platoId: true,
                nombre: true,
                tipoPlato: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        fechaApertura: 'asc',
      },
    });

    const queue = comandas
      .map((comanda) => {
        const elapsedMinutes = getElapsedMinutes(comanda.fechaApertura);
        const itemsPendientes = comanda.items.filter((item) => item.estado !== 'SERVIDO').length;

        return {
          ...comanda,
          elapsedMinutes,
          itemsPendientes,
          prioridad:
            elapsedMinutes >= 30
              ? 'ALTA'
              : elapsedMinutes >= 15
                ? 'MEDIA'
                : 'NORMAL',
        };
      })
      .filter((comanda) => comanda.itemsPendientes > 0)
      .sort((a, b) => b.elapsedMinutes - a.elapsedMinutes);

    return NextResponse.json(queue);
  } catch (error) {
    console.error('Error al obtener cola KDS:', error);
    return NextResponse.json({ error: 'Error al obtener cola KDS.' }, { status: 500 });
  }
});
