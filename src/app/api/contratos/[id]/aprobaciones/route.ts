import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResultReq1 = await authenticateUser(req);
    if ('status' in authResultReq1) return authResultReq1 as Response;
    const user = authResultReq1.user;

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
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

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
