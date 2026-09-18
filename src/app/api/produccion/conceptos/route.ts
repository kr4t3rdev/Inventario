import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';

/**
 * @description Obtiene los tipos de GastosDE para usar como conceptos en vales de salida.
 * @param {NextRequest} request - Request HTTP.
 * @returns {Promise<NextResponse>} Lista de conceptos únicos.
 */
export const GET = withAuthGet(async (request: NextRequest, _context, user) => {
  try {
    const tenantId = requireTenant(user);

    // Obtener tipos únicos de GastosDE
    const tiposGastosDE = await prisma.gastosDE.findMany({
      where: { tenantId },
      select: {
        tipo: true,
      },
      distinct: ['tipo'],
    });

    const conceptos = tiposGastosDE
      .map(g => g.tipo)
      .filter(t => t) // Filtrar valores nulos o vacíos
      .sort();

    // Agregar opción de concepto libre
    const conceptosConLibre = [
      ...conceptos,
      'Otro', // Opción para concepto libre
    ];

    return NextResponse.json(conceptosConLibre);
  } catch (error) {
    console.error('Error al obtener conceptos:', error);
    return NextResponse.json({ error: 'Error al obtener conceptos.' }, { status: 500 });
  }
});
