import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth-middleware';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

async function handler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user: AuthenticatedUser,
) {
  const { id } = await params;

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
                  servicio: { select: { servicioId: true, nombre: true, precio: true, moneda: true, descripcion: true } },
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

  const serialized = {
    ...factura,
    subtotal: Number(factura.subtotal),
    total: Number(factura.total),
    descuento: Number(factura.descuento ?? 0),
    impuestos: Number(factura.impuestos ?? 0),
    cargoTransporte: Number(factura.cargoTransporte ?? 0),
    tasaCambio: factura.tasaCambio ? Number(factura.tasaCambio) : null,
  };

  return NextResponse.json(serialized);
}

export const GET = withAuth(handler);
