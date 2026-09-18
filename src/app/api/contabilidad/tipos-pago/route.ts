import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser, type AuthenticatedUser } from "@/lib/auth-middleware"
import { ActionError } from '@/lib/server-actions'
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
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
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user as AuthenticatedUser
    const tenantId = requireTenant(user)

    // Construir filtros
    const where = { tenantId }

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
          cuentaDefectoInfo = await prisma.cuentaBancaria.findFirst({
            where: { cuentaId: tipo.cuentaDefecto, tenantId },
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
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user as AuthenticatedUser
    const tenantId = requireTenant(user)
    requirePermission(user, 'financiero.tipos-pago.crear', 'crear tipos de pago')

    const body = await request.json()
    const validatedData = TipoPagoSchema.parse(body)

    // Validar período contable
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'tipo_pago',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    // Verificar que no existe un tipo de pago con el mismo nombre
    const existingTipo = await prisma.tipoPago.findFirst({
      where: { 
        nombre: {
          equals: validatedData.nombre,
        },
        tenantId
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
      const cuenta = await prisma.cuentaBancaria.findFirst({
        where: { cuentaId: validatedData.cuentaDefecto, tenantId }
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
      data: { ...validatedData, tenantId },
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
        cuentaDefecto: nuevoTipoPago.cuentaDefecto,
        tenantId
      }
    });

    return NextResponse.json({
      success: true,
      data: nuevoTipoPago,
      message: 'Tipo de pago creado exitosamente'
    }, { status: 201 })

  } catch (error) {
    if (error instanceof ActionError && error.code === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 403 },
      )
    }

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
