import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticateUser } from '@/lib/auth-middleware';
import { z } from 'zod';

// Schema para validar actualización de contratos
const contratoUpdateSchema = z
  .object({
    tipo: z.enum(['COMPRA_VENTA', 'SERVICIO', 'SUMINISTROS']).optional(),
    fechaInicio: z.string().datetime().optional(),
    fechaFin: z.string().datetime().nullable().optional(),
    monto: z.string().nullable().optional(),
    moneda: z.string().optional(),
    esMultiMoneda: z.boolean().optional(),
    condiciones: z.any().nullable().optional(),
    observaciones: z.string().nullable().optional(),
    clienteId: z.string().nullable().optional(),
    vendorId: z.string().nullable().optional(),
    estado: z.enum(['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'ACTIVO', 'FINALIZADO', 'ANULADO']).optional(),
    numeroContrato: z.string().optional(),
    fechaAprobacion: z.string().datetime().nullable().optional(),
    aprobadoPor: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      // Si se está actualizando el tipo, validar la lógica de cliente/vendor
      if (data.tipo) {
        if ((data.tipo === 'COMPRA_VENTA' || data.tipo === 'SERVICIO') && data.clienteId === null && data.clienteId !== undefined) {
          return false;
        }
        if (data.tipo === 'SUMINISTROS' && data.vendorId === null && data.vendorId !== undefined) {
          return false;
        }
      }
      return true;
    },
    (data) => {
      if (data.tipo === 'SUMINISTROS') {
        return {
          message: 'El campo Proveedor es requerido para contratos de tipo SUMINISTROS',
          path: ['vendorId'],
        };
      }
      return {
        message: 'El campo Cliente es requerido para contratos de tipo COMPRA_VENTA o SERVICIO',
        path: ['clienteId'],
      };
    }
  );

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
    
    // Validar con el schema
    const validatedBody = contratoUpdateSchema.parse(body);

    // Si estamos cambiando el tipo, verificar que tenga el cliente o vendor correspondiente
    const existingContrato = await prisma.contrato.findUnique({
      where: { contratoId: id },
    });

    if (!existingContrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    const tipoActual = validatedBody.tipo || existingContrato.tipo;
    
    // Validar lógica de negocio: si es COMPRA_VENTA/SERVICIO debe tener cliente
    if ((tipoActual === 'COMPRA_VENTA' || tipoActual === 'SERVICIO')) {
      const clienteId = validatedBody.clienteId !== undefined ? validatedBody.clienteId : existingContrato.clienteId;
      if (!clienteId) {
        return NextResponse.json(
          { error: 'El campo Cliente es requerido para contratos de tipo COMPRA_VENTA o SERVICIO' },
          { status: 400 }
        );
      }
    }
    
    // Validar lógica de negocio: si es SUMINISTROS debe tener vendor
    if (tipoActual === 'SUMINISTROS') {
      const vendorId = validatedBody.vendorId !== undefined ? validatedBody.vendorId : existingContrato.vendorId;
      if (!vendorId) {
        return NextResponse.json(
          { error: 'El campo Proveedor es requerido para contratos de tipo SUMINISTROS' },
          { status: 400 }
        );
      }
    }

    // Construir objeto data explícitamente para evitar campos inválidos
    const data: any = {};
    
    if (validatedBody.numeroContrato !== undefined) data.numeroContrato = validatedBody.numeroContrato;
    if (validatedBody.tipo !== undefined) data.tipo = validatedBody.tipo;
    if (validatedBody.estado !== undefined) data.estado = validatedBody.estado;
    if (validatedBody.monto !== undefined) data.monto = validatedBody.monto;
    if (validatedBody.moneda !== undefined) data.moneda = validatedBody.moneda;
    if (validatedBody.esMultiMoneda !== undefined) data.esMultiMoneda = validatedBody.esMultiMoneda;
    if (validatedBody.condiciones !== undefined) data.condiciones = validatedBody.condiciones;
    if (validatedBody.observaciones !== undefined) data.observaciones = validatedBody.observaciones;
    if (validatedBody.fechaInicio !== undefined) data.fechaInicio = new Date(validatedBody.fechaInicio);
    if (validatedBody.fechaFin !== undefined) data.fechaFin = validatedBody.fechaFin ? new Date(validatedBody.fechaFin) : null;
    if (validatedBody.fechaAprobacion !== undefined) data.fechaAprobacion = validatedBody.fechaAprobacion ? new Date(validatedBody.fechaAprobacion) : null;

    // Manejo de relaciones (usando connect/disconnect para asegurar compatibilidad)
    if (validatedBody.clienteId !== undefined) {
      data.cliente = validatedBody.clienteId ? { connect: { clienteId: validatedBody.clienteId } } : { disconnect: true };
    }
    if (validatedBody.vendorId !== undefined) {
      data.vendor = validatedBody.vendorId ? { connect: { vendorId: validatedBody.vendorId } } : { disconnect: true };
    }
    if (validatedBody.aprobadoPor !== undefined) {
      data.aprobador = validatedBody.aprobadoPor ? { connect: { userId: validatedBody.aprobadoPor } } : { disconnect: true };
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

    if (validatedBody.clienteId && contrato.numeroContrato) {
      await prisma.cliente.update({
        where: { clienteId: validatedBody.clienteId },
        data: { numeroContrato: contrato.numeroContrato },
      });
    }

    return NextResponse.json(contrato);
  } catch (error) {
    console.error('Error al actualizar contrato:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
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
