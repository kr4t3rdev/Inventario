import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuthGet, type AuthenticatedUser } from '@/lib/auth-middleware';

export const GET = withAuthGet(async (_request: NextRequest, _context: unknown, user: AuthenticatedUser) => {
  try {
    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Sin contexto de tenant', code: 'NO_TENANT' },
        { status: 403 },
      );
    }

    const cuentas = await prisma.cuentaBancaria.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        cuentaId: true,
        nombreBanco: true,
        numeroCuenta: true,
        moneda: true,
        tipoCuenta: true,
        saldo: true,
        isActive: true,
      },
      orderBy: {
        nombreBanco: 'asc',
      },
    });

    return NextResponse.json({
      cuentas: cuentas.map((cuenta) => ({
        ...cuenta,
        saldo: Number(cuenta.saldo),
      })),
    });
  } catch (error) {
    console.error('Error al obtener cuentas bancarias:', error);
    return NextResponse.json(
      { error: 'Error al obtener cuentas bancarias' },
      { status: 500 },
    );
  }
});
