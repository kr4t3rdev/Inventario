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
    const aprobaciones = await prisma.contratoAprobacion.findMany({
      where: { contratoId: id },
      include: {
        aprobador: { select: { userId: true, name: true, email: true } },
      },
      orderBy: [{ nivel: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(aprobaciones);
  } catch (error) {
    console.error('Error al obtener aprobaciones:', error);
    return NextResponse.json({ error: 'Error al obtener aprobaciones' }, { status: 500 });
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

    const aprobacion = await prisma.contratoAprobacion.create({
      data: {
        contratoId: id,
        nivel: body.nivel,
        aprobadorId: body.aprobadorId,
        estado: body.estado || 'PENDIENTE',
        comentarios: body.comentarios,
        fechaAprobacion: body.fechaAprobacion ? new Date(body.fechaAprobacion) : null,
      },
      include: {
        aprobador: { select: { userId: true, name: true, email: true } },
      },
    });

    if (body.estado === 'APROBADO' && body.fechaAprobacion) {
      await prisma.contrato.update({
        where: { contratoId: id },
        data: {
          aprobadoPor: body.aprobadorId,
          fechaAprobacion: new Date(body.fechaAprobacion),
          estado: 'APROBADO',
        },
      });
    }

    return NextResponse.json(aprobacion);
  } catch (error) {
    console.error('Error al crear aprobación:', error);
    return NextResponse.json({ error: 'Error al crear aprobación' }, { status: 500 });
  }
}
