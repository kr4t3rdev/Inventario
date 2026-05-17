import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await authenticateUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const factura = await prisma.factura.findFirst({
    where: {
      OR: [
        { idFactura: id },
        { ventaId: id },
      ],
      tenantId: user.tenantId!,
    },
    include: {
      cliente: true,
      venta: {
        include: {
          cliente: true,
          puntoDeVenta: { select: { pvId: true, nombre: true } },
          items: {
            include: {
              producto: {
                select: { id: true, nombre: true, precioVenta: true, unidad: { select: { simbolo: true } } },
              },
            },
          },
          oferta: {
            include: {
              items: {
                include: {
                  producto: { select: { id: true, nombre: true } },
                  servicio: { select: { id: true, nombre: true } },
                },
              },
            },
          },
          producto: { select: { id: true, nombre: true, precioVenta: true } },
          ordenReparacion: {
            include: {
              equipoTipo: { select: { nombre: true } },
            },
          },
        },
      },
    },
  });

  if (!factura) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
  }

  return NextResponse.json(factura);
}
