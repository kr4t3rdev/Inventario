import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verify_token } from '@/lib/auth-utils';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await verify_token(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const user = await verify_token(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
