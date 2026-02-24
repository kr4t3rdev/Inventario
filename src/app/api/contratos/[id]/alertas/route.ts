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
    const searchParams = req.nextUrl.searchParams;
    const noLeidas = searchParams.get('noLeidas');

    const where: any = { contratoId: id };

    if (noLeidas === 'true') {
      where.leida = false;
    }

    const alertas = await prisma.contratoAlerta.findMany({
      where,
      orderBy: { fechaAlerta: 'desc' },
    });

    return NextResponse.json(alertas);
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    return NextResponse.json({ error: 'Error al obtener alertas' }, { status: 500 });
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

    const alerta = await prisma.contratoAlerta.create({
      data: {
        contratoId: id,
        tipo: body.tipo,
        fechaAlerta: new Date(body.fechaAlerta),
        mensaje: body.mensaje,
        accionRequerida: body.accionRequerida || false,
      },
    });

    return NextResponse.json(alerta);
  } catch (error) {
    console.error('Error al crear alerta:', error);
    return NextResponse.json({ error: 'Error al crear alerta' }, { status: 500 });
  }
}
