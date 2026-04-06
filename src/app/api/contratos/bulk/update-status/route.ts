import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { authenticateUser } from '@/lib/auth-middleware';

const bulkStatusSchema = z.object({
  ids: z.array(z.string()),
  estado: z.enum(['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'ACTIVO', 'FINALIZADO', 'ANULADO']),
});

export async function POST(req: NextRequest) {
  try {
    const authResultReq1 = await authenticateUser(req);
    if ('status' in authResultReq1) return authResultReq1 as Response;
    const user = authResultReq1.user;

    const body = await req.json();
    const { ids, estado } = bulkStatusSchema.parse(body);

    if (ids.length === 0) {
      return NextResponse.json({ message: 'No IDs provided' }, { status: 400 });
    }

    const result = await prisma.contrato.updateMany({
      where: {
        contratoId: {
          in: ids,
        },
      },
      data: {
        estado: estado,
      },
    });

    return NextResponse.json({ 
      success: true, 
      count: result.count, 
      message: `${result.count} contratos actualizados a ${estado}`
    });
  } catch (error) {
    console.error('Error in bulk status update:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
