import { NextRequest, NextResponse } from 'next/server';
import { withAuthGet } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

/**
 * @description Lista cierres de caja del POS restaurante.
 * @param {NextRequest} request - Request HTTP con paginación opcional.
 * @returns {Promise<NextResponse>} Lista de cierres.
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitRaw = searchParams.get('limit');
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 20)));

    const cierres = await prisma.cierreContable.findMany({
      where: { tipo: 'RESTAURANTE_POS' },
      orderBy: { createdAt: 'desc' },
      take: Number.isNaN(limit) ? 20 : limit,
    });

    return NextResponse.json(cierres);
  } catch (error) {
    console.error('Error al listar cierres POS restaurante:', error);
    return NextResponse.json(
      { error: 'Error al listar cierres POS restaurante.' },
      { status: 500 }
    );
  }
});
