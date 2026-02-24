import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { verify_token } from '@/lib/auth-utils';

const configSchema = z.object({
  diasAvisoVencimientoContrato: z.number().min(1).max(365),
});

export async function GET(request: NextRequest) {
  try {
    const user = await verify_token(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let config = await prisma.configuracionSistema.findFirst();

    if (!config) {
      config = await prisma.configuracionSistema.create({
        data: {},
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verify_token(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = configSchema.parse(body);

    let config = await prisma.configuracionSistema.findFirst();

    if (config) {
      config = await prisma.configuracionSistema.update({
        where: { configId: config.configId },
        data: {
          diasAvisoVencimientoContrato: data.diasAvisoVencimientoContrato,
        },
      });
    } else {
      config = await prisma.configuracionSistema.create({
        data: {
          diasAvisoVencimientoContrato: data.diasAvisoVencimientoContrato,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
