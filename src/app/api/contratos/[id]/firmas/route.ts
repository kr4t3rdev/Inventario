import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResultReq1 = await authenticateUser(req);
    if ('status' in authResultReq1) return authResultReq1 as Response;
    const user = authResultReq1.user;

    const { id } = await context.params;
    const firmas = await prisma.contratoFirma.findMany({
      where: { contratoId: id },
      include: {
        firmante: { select: { userId: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(firmas);
  } catch (error) {
    console.error('Error al obtener firmas:', error);
    return NextResponse.json({ error: 'Error al obtener firmas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await params;
    const body = await request.json();

    const firma = await prisma.contratoFirma.create({
      data: {
        contratoId: id,
        firmanteId: body.firmanteId,
        tipoFirma: body.tipoFirma,
        estado: body.estado || 'PENDIENTE',
        firmaDigital: body.firmaDigital,
        fechaFirma: body.fechaFirma ? new Date(body.fechaFirma) : null,
        comentarios: body.comentarios,
      },
      include: {
        firmante: { select: { userId: true, name: true, email: true } },
      },
    });

    return NextResponse.json(firma);
  } catch (error) {
    console.error('Error al crear firma:', error);
    return NextResponse.json({ error: 'Error al crear firma' }, { status: 500 });
  }
}
