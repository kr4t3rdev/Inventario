import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { authenticateUser, withAuth } from '@/lib/auth-middleware';

// CTF-5: la configuración de contratos vive por tenant (ConfiguracionContratos).
// El campo global ConfiguracionSistema.diasAvisoVencimientoContrato quedó
// deprecado y ya no se lee ni se escribe.
const configSchema = z.object({
  diasAvisoVencimiento: z.number().int().min(1).max(365),
});

export const GET = withAuth(async (request: NextRequest) => {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    if (!user.tenantId) {
      return NextResponse.json({ error: 'Se requiere una membresía de empresa activa' }, { status: 403 });
    }

    // Upsert perezoso: la primera consulta crea la fila default del tenant
    // (update vacío: solo la crea si falta).
    const config = await prisma.configuracionContratos.upsert({
      where: { tenantId: user.tenantId },
      update: {},
      create: { tenantId: user.tenantId },
    });

    return NextResponse.json({ diasAvisoVencimiento: config.diasAvisoVencimiento });
  } catch (error) {
    console.error('Error al obtener configuración de contratos:', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    if (!user.tenantId) {
      return NextResponse.json({ error: 'Se requiere una membresía de empresa activa' }, { status: 403 });
    }

    const body = await request.json();
    const data = configSchema.parse(body);

    const config = await prisma.configuracionContratos.upsert({
      where: { tenantId: user.tenantId },
      update: { diasAvisoVencimiento: data.diasAvisoVencimiento },
      create: { tenantId: user.tenantId, diasAvisoVencimiento: data.diasAvisoVencimiento },
    });

    return NextResponse.json({ diasAvisoVencimiento: config.diasAvisoVencimiento });
  } catch (error) {
    console.error('Error al actualizar configuración de contratos:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
});
