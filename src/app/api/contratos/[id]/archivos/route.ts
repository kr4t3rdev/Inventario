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
    const archivos = await prisma.contratoArchivo.findMany({
      where: { contratoId: id },
      include: {
        version: true,
        generador: { select: { userId: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(archivos);
  } catch (error) {
    console.error('Error al obtener archivos:', error);
    return NextResponse.json({ error: 'Error al obtener archivos' }, { status: 500 });
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

    const archivo = await prisma.contratoArchivo.create({
      data: {
        contratoId: id,
        versionId: body.versionId || null,
        tipo: body.tipo,
        rutaArchivo: body.rutaArchivo,
        nombreArchivo: body.nombreArchivo,
        generadoPor: user.userId, // Use the actual user ID from the token
      },
      include: {
        generador: { select: { userId: true, name: true, email: true } },
      },
    });

    return NextResponse.json(archivo);
  } catch (error) {
    console.error('Error al crear archivo:', error);
    return NextResponse.json({ error: 'Error al crear archivo', details: String(error) }, { status: 500 });
  }
}
