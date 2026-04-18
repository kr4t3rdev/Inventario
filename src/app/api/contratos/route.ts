import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { authenticateUser } from "@/lib/auth-middleware";
import { generarProximoConsecutivo, formatearNumeroContrato } from './lib/numeroContratoGenerator';

const TIPOS_BASE = ['COMPRA_VENTA', 'SERVICIO', 'SUMINISTROS'] as const

const contratoSchema = z
  .object({
    tipo: z.string().min(1, 'El tipo de contrato es requerido'),
    fechaInicio: z.string().datetime(),
    fechaFin: z.string().datetime().nullable().optional(),
    monto: z.string().nullable().optional(),
    moneda: z.string().default('CUP'),
    esMultiMoneda: z.boolean().default(false).optional(),
    condiciones: z.any().nullable().optional(),
    observaciones: z.string().nullable().optional(),
    numeroContratoClienteProveedor: z.string().nullable().optional(),
    clienteId: z.string().nullable().optional(),
    vendorId: z.string().nullable().optional(),
  })
  .refine(
    (data) => Boolean(data.clienteId) !== Boolean(data.vendorId),
    {
      message: 'Debes seleccionar solo un cliente o un proveedor',
      path: ['clienteId'],
    }
  )

export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const searchParams = request.nextUrl.searchParams;
    
    // Pagination params
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Filter params
    const tipo = searchParams.get('tipo');
    const estado = searchParams.get('estado');
    const fechaInicioStr = searchParams.get('fechaInicio');
    const fechaFinStr = searchParams.get('fechaFin');

    const where: any = {};

    if (tipo && tipo !== 'ALL') {
      where.tipo = tipo;
    }

    if (estado && estado !== 'ALL') {
      where.estado = estado;
    }

    if (fechaInicioStr || fechaFinStr) {
      where.fechaInicio = {};
      if (fechaInicioStr) {
        where.fechaInicio.gte = new Date(fechaInicioStr);
      }
      if (fechaFinStr) {
        where.fechaInicio.lte = new Date(fechaFinStr);
      }
    }

    // Execute query
    const [contratos, total] = await Promise.all([
      prisma.contrato.findMany({
        where,
        include: {
          cliente: true,
          vendor: true,
          creador: { select: { userId: true, name: true, email: true } },
          aprobador: { select: { userId: true, name: true, email: true } },
          versiones: { orderBy: { numeroVersion: 'desc' }, take: 1 },
          firmas: true,
          aprobaciones: true,
          archivos: true,
          alertas: { orderBy: { fechaAlerta: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contrato.count({ where }),
    ]);

    // Check if pagination was requested (heuristic: if page param is explicitly provided in URL or implied)
    // Since we want to support the new frontend which will send page, we return the new structure.
    // However, to maintain backward compatibility with any potential simpler fetchers, 
    // we could check if 'page' was in searchParams. 
    // But for this task, I'll update the frontend to handle the new structure.
    // The previous frontend expected an array. I will return { data, meta } and update frontend.
    
    return NextResponse.json({
      data: contratos,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });

  } catch (error) {
    console.error('Error al obtener contratos:', error);
    return NextResponse.json({ error: 'Failed to fetch contratos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json();
    const data = contratoSchema.parse(body);

    // Generar próximo consecutivo para el tipo de contrato
    const numeroConsecutivo = await generarProximoConsecutivo(data.tipo);
    const numeroContrato = formatearNumeroContrato(data.tipo, numeroConsecutivo);

    const contrato = await prisma.contrato.create({
      data: {
        ...data,
        creadoPor: user.userId,
        numeroContrato,
        numeroConsecutivo,
        numeroContratoClienteProveedor: data.numeroContratoClienteProveedor || null,
        fechaInicio: new Date(data.fechaInicio),
        fechaFin: data.fechaFin ? new Date(data.fechaFin) : null,
      },
      include: {
        cliente: true,
        vendor: true,
        creador: { select: { userId: true, name: true, email: true } },
      },
    });

    const version = await prisma.contratoVersion.create({
      data: {
        contratoId: contrato.contratoId,
        numeroVersion: 1,
        contenido: { condiciones: data.condiciones },
        cambios: 'Versión inicial',
        creadoPor: user.userId,
      },
    });

    if (data.clienteId) {
      await prisma.cliente.update({
        where: { clienteId: data.clienteId },
        data: { numeroContrato: contrato.numeroContrato },
      });
    }

    return NextResponse.json({ ...contrato, versionActual: version });
  } catch (error) {
    console.error('Error al crear contrato:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create contrato' }, { status: 500 });
  }
}
