import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authResultReq1 = await authenticateUser(req);
    if ('status' in authResultReq1) return authResultReq1 as Response;
    const user = authResultReq1.user;

    const { id } = await context.params;
    const contrato = await prisma.contrato.findUnique({
      where: { contratoId: id },
      include: {
        cliente: true,
        vendor: true,
        creador: { select: { userId: true, name: true, email: true } },
        aprobador: { select: { userId: true, name: true, email: true } },
        versiones: { orderBy: { numeroVersion: 'desc' } },
        firmas: { include: { firmante: { select: { userId: true, name: true, email: true } } } },
        aprobaciones: { include: { aprobador: { select: { userId: true, name: true, email: true } } } },
        archivos: { include: { version: true, generador: { select: { userId: true, name: true, email: true } } } },
        alertas: { orderBy: { fechaAlerta: 'desc' } },
      },
    });

    if (!contrato) {
      return NextResponse.json({ error: 'contrato no encontrado' }, { status: 404 });
    }

    return NextResponse.json(contrato);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    return NextResponse.json({ error: 'Error al obtener contrato' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await params;
    const body = await request.json();

    // Construir objeto data explícitamente para evitar campos inválidos
    const data: any = {
      numeroContrato: body.numeroContrato,
      tipo: body.tipo,
      estado: body.estado,
      monto: body.monto,
      moneda: body.moneda,
      esMultiMoneda: body.esMultiMoneda,
      condiciones: body.condiciones,
      observaciones: body.observaciones,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : undefined,
      fechaFin: body.fechaFin ? new Date(body.fechaFin) : undefined,
      fechaAprobacion: body.fechaAprobacion ? new Date(body.fechaAprobacion) : undefined,
    };

    // Eliminar claves undefined
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

    // Manejo de relaciones (usando connect/disconnect para asegurar compatibilidad)
    if (body.clienteId !== undefined) {
      data.cliente = body.clienteId ? { connect: { clienteId: body.clienteId } } : { disconnect: true };
    }
    if (body.vendorId !== undefined) {
      data.vendor = body.vendorId ? { connect: { vendorId: body.vendorId } } : { disconnect: true };
    }
    if (body.aprobadoPor !== undefined) {
      data.aprobador = body.aprobadoPor ? { connect: { userId: body.aprobadoPor } } : { disconnect: true };
    }

    const contrato = await prisma.contrato.update({
      where: { contratoId: id },
      data,
      include: {
        cliente: true,
        vendor: true,
        creador: { select: { userId: true, name: true, email: true } },
        aprobador: { select: { userId: true, name: true, email: true } },
      },
    });

    if (body.clienteId && contrato.numeroContrato) {
      await prisma.cliente.update({
        where: { clienteId: body.clienteId },
        data: { numeroContrato: contrato.numeroContrato },
      });
    }

    return NextResponse.json(contrato);
  } catch (error) {
    console.error('Error al actualizar contrato:', error);
    return NextResponse.json({ error: 'Error al actualizar contrato' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { id } = await params;

    const contrato = await prisma.contrato.findUnique({
      where: { contratoId: id },
      select: { clienteId: true, numeroContrato: true },
    });

    if (contrato?.clienteId) {
      await prisma.cliente.update({
        where: { clienteId: contrato.clienteId },
        data: { numeroContrato: null },
      });
    }

    await prisma.contrato.delete({
      where: { contratoId: id },
    });

    return NextResponse.json({ success: true, id: id });
  } catch (error) {
    console.error('Error al eliminar contrato:', error);
    return NextResponse.json({ error: 'Error al eliminar contrato' }, { status: 500 });
  }
}
