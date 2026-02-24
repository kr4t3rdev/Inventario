import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verify_token } from "@/lib/auth-utils"
import { AuditLogService } from "@/lib/services/audit-log-service"

// Schema para validar nuevo tipo de pago
const TipoPagoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  requiereCuenta: z.boolean().default(true),
  cuentaDefecto: z.string().optional(),
  isActive: z.boolean().default(true)
}).refine((data) => {
  // Si requiere cuenta, debe tener una cuenta por defecto
  if (data.requiereCuenta && !data.cuentaDefecto) {
    return false
  }
  return true
}, {
  message: 'Si el tipo de pago requiere cuenta, debe especificar una cuenta por defecto',
  path: ['cuentaDefecto']
})

// Schema para actualizar tipo de pago
const UpdateTipoPagoSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  requiereCuenta: z.boolean().optional(),
  cuentaDefecto: z.string().optional(),
  isActive: z.boolean().optional()
}).refine((data) => {
  // Si se especifica que requiere cuenta, debe tener cuenta por defecto
  if (data.requiereCuenta === true && !data.cuentaDefecto) {
    return false
  }
  return true
}, {
  message: 'Si el tipo de pago requiere cuenta, debe especificar una cuenta por defecto',
  path: ['cuentaDefecto']
})

// GET /api/contabilidad/tipos-pago - Listar tipos de pago
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    // const includeInactive = searchParams.get('includeInactive') === 'true'
    // const requiereCuenta = searchParams.get('requiereCuenta')

    // Construir filtros
    const where: any = {}
    
    // if (!includeInactive) {
    //   where.isActive = true
    // }

    // if (requiereCuenta !== null) {
    //   where.requiereCuenta = requiereCuenta === 'true'
    // }

    const tiposPago = await prisma.tipoPago.findMany({
      where,
      include: {
        _count: {
          select: {
            reconciliacionesVenta: true,
            reconciliacionesServicio: true,
            reconciliacionesGasto: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { nombre: 'asc' }
      ]
    })

    // Enriquecer con información de cuenta por defecto
    const tiposPagoEnriquecidos = await Promise.all(
      tiposPago.map(async (tipo: any) => {
        let cuentaDefectoInfo = null
        if (tipo.cuentaDefecto) {
          cuentaDefectoInfo = await prisma.cuentaBancaria.findUnique({
            where: { cuentaId: tipo.cuentaDefecto },
            select: {
              cuentaId: true,
              nombreBanco: true,
              numeroCuenta: true,
              tipoCuenta: true,
              moneda: true,
              isActive: true
            }
          })
        }

        return {
          ...tipo,
          cuentaDefectoInfo
        }
      })
    )

    return NextResponse.json({
      //success: true,
      data: tiposPagoEnriquecidos
    })

  } catch (error) {
    console.error('Error fetching payment types:', error)
    return NextResponse.json(
      {
        //success: false,
        error: 'Error al obtener los tipos de pago',
        code: 'FETCH_PAYMENT_TYPES_ERROR'
      },
      { status: 500 }
    )
  }
}

// POST /api/contabilidad/tipos-pago - Crear nuevo tipo de pago
export async function POST(request: NextRequest) {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = TipoPagoSchema.parse(body)

    // Verificar que no existe un tipo de pago con el mismo nombre
    const existingTipo = await prisma.tipoPago.findFirst({
      where: { 
        nombre: {
          equals: validatedData.nombre,
          
        }
      }
    })

    if (existingTipo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ya existe un tipo de pago con ese nombre',
          code: 'PAYMENT_TYPE_NAME_EXISTS'
        },
        { status: 400 }
      )
    }

    // Si se especifica cuenta por defecto, verificar que existe y está activa
    if (validatedData.cuentaDefecto) {
      const cuenta = await prisma.cuentaBancaria.findUnique({
        where: { cuentaId: validatedData.cuentaDefecto }
      })

      if (!cuenta) {
        return NextResponse.json(
          {
            success: false,
            error: 'La cuenta por defecto especificada no existe',
            code: 'DEFAULT_ACCOUNT_NOT_FOUND'
          },
          { status: 404 }
        )
      }

      if (!cuenta.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: 'La cuenta por defecto especificada no está activa',
            code: 'DEFAULT_ACCOUNT_INACTIVE'
          },
          { status: 400 }
        )
      }
    }

    const nuevoTipoPago = await prisma.tipoPago.create({
      data: validatedData,
      include: {
        _count: {
          select: {
            reconciliacionesVenta: true,
            reconciliacionesServicio: true,
            reconciliacionesGasto: true
          }
        }
      }
    })

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "CREATE",
      entidad: "TIPO_PAGO",
      entidadId: nuevoTipoPago.tipoId,
      usuarioId: user.userId,
      detalles: {
        nombre: nuevoTipoPago.nombre,
        requiereCuenta: nuevoTipoPago.requiereCuenta,
        cuentaDefecto: nuevoTipoPago.cuentaDefecto
      }
    });

    return NextResponse.json({
      success: true,
      data: nuevoTipoPago,
      message: 'Tipo de pago creado exitosamente'
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    console.error('Error creating payment type:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear el tipo de pago',
        code: 'CREATE_PAYMENT_TYPE_ERROR'
      },
      { status: 500 }
    )
  }
}