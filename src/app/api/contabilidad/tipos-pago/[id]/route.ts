import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser, type AuthenticatedUser } from "@/lib/auth-middleware"
import { ActionError } from '@/lib/server-actions'
import { requirePermission, requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { AuditLogService } from "@/lib/services/audit-log-service"

// Schema para actualizar tipo de pago
const UpdateTipoPagoSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  requiereCuenta: z.boolean().optional(),
  cuentaDefecto: z.string().nullable().optional(),
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

// GET /api/contabilidad/tipos-pago/[id] - Obtener tipo de pago específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user as AuthenticatedUser
    const tenantId = requireTenant(user)
    const { id } = await params

    const tipoPago = await prisma.tipoPago.findFirst({
      where: { tipoId: id, tenantId },
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

    if (!tipoPago) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de pago no encontrado',
          code: 'PAYMENT_TYPE_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Obtener información de la cuenta por defecto si existe
    let cuentaDefectoInfo = null
    if (tipoPago.cuentaDefecto) {
      cuentaDefectoInfo = await prisma.cuentaBancaria.findFirst({
        where: { cuentaId: tipoPago.cuentaDefecto, tenantId },
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

    return NextResponse.json({
      success: true,
      data: {
        ...tipoPago,
        cuentaDefectoInfo
      }
    })

  } catch (error) {
    console.error('Error fetching payment type:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener el tipo de pago',
        code: 'FETCH_PAYMENT_TYPE_ERROR'
      },
      { status: 500 }
    )
  }
}

// PUT /api/contabilidad/tipos-pago/[id] - Actualizar tipo de pago
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user as AuthenticatedUser
    const tenantId = requireTenant(user)
    requirePermission(user, 'financiero.tipos-pago.editar', 'actualizar tipos de pago')

    const { id } = await params
    const body = await request.json()
    const validatedData = UpdateTipoPagoSchema.parse(body)

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

    // Verificar que el tipo de pago existe
    const tipoPagoExistente = await prisma.tipoPago.findFirst({
      where: { tipoId: id, tenantId },
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

    if (!tipoPagoExistente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de pago no encontrado',
          code: 'PAYMENT_TYPE_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Verificar si se puede desactivar (no debe tener reconciliaciones activas)
    if (validatedData.isActive === false) {
      const totalReconciliaciones = tipoPagoExistente._count.reconciliacionesVenta +
                                   tipoPagoExistente._count.reconciliacionesServicio +
                                   tipoPagoExistente._count.reconciliacionesGasto

      if (totalReconciliaciones > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No se puede desactivar un tipo de pago que tiene reconciliaciones asociadas',
            code: 'PAYMENT_TYPE_HAS_RECONCILIATIONS'
          },
          { status: 400 }
        )
      }
    }

    // Verificar que no existe otro tipo de pago con el mismo nombre (si se está cambiando el nombre)
    if (validatedData.nombre && validatedData.nombre !== tipoPagoExistente.nombre) {
      const existingTipo = await prisma.tipoPago.findFirst({
        where: { 
          nombre: {
            equals: validatedData.nombre
          },
          tenantId,
          tipoId: { not: id }
        }
      })

      if (existingTipo) {
        return NextResponse.json(
          {
            success: false,
            error: 'Ya existe otro tipo de pago con ese nombre',
            code: 'PAYMENT_TYPE_NAME_EXISTS'
          },
          { status: 400 }
        )
      }
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

    // Validación especial: si se cambia requiereCuenta a true, debe tener cuenta por defecto
    const requiereCuentaFinal = validatedData.requiereCuenta ?? tipoPagoExistente.requiereCuenta
    const cuentaDefectoFinal = Object.prototype.hasOwnProperty.call(validatedData, 'cuentaDefecto')
      ? validatedData.cuentaDefecto
      : tipoPagoExistente.cuentaDefecto

    if (requiereCuentaFinal && !cuentaDefectoFinal) {
      return NextResponse.json(
        {
          success: false,
          error: 'Si el tipo de pago requiere cuenta, debe especificar una cuenta por defecto',
          code: 'ACCOUNT_REQUIRED_BUT_NOT_PROVIDED'
        },
        { status: 400 }
      )
    }

    // Si se cambia requiereCuenta a false, limpiar cuenta por defecto
    const dataToUpdate = { ...validatedData }
    if (validatedData.requiereCuenta === false) {
      dataToUpdate.cuentaDefecto = null
    }

    const updateResult = await prisma.tipoPago.updateMany({
      where: { tipoId: id, tenantId },
      data: dataToUpdate,
    })
    if (updateResult.count !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de pago no encontrado',
          code: 'PAYMENT_TYPE_NOT_FOUND',
        },
        { status: 404 },
      )
    }

    const tipoPagoActualizado = await prisma.tipoPago.findFirst({
      where: { tipoId: id, tenantId },
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
    if (!tipoPagoActualizado) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de pago no encontrado',
          code: 'PAYMENT_TYPE_NOT_FOUND',
        },
        { status: 404 },
      )
    }

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "UPDATE",
      entidad: "TIPO_PAGO",
      entidadId: id,
      usuarioId: user.userId,
      detalles: {
        cambios: validatedData,
        nombreAnterior: tipoPagoExistente.nombre,
        nombreNuevo: tipoPagoActualizado.nombre,
        tenantId
      }
    });

    // Obtener información de la cuenta por defecto actualizada
    let cuentaDefectoInfo = null
    if (tipoPagoActualizado.cuentaDefecto) {
      cuentaDefectoInfo = await prisma.cuentaBancaria.findFirst({
        where: { cuentaId: tipoPagoActualizado.cuentaDefecto, tenantId },
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

    return NextResponse.json({
      success: true,
      data: {
        ...tipoPagoActualizado,
        cuentaDefectoInfo
      },
      message: 'Tipo de pago actualizado exitosamente'
    })

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

    console.error('Error updating payment type:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al actualizar el tipo de pago',
        code: 'UPDATE_PAYMENT_TYPE_ERROR'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/contabilidad/tipos-pago/[id] - Eliminar tipo de pago
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user as AuthenticatedUser
    const tenantId = requireTenant(user)
    requirePermission(user, 'financiero.tipos-pago.eliminar', 'eliminar tipos de pago')

    const { id } = await params

    // Validar período contable
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: new Date(),
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

    // Verificar que el tipo de pago existe
    const tipoPagoExistente = await prisma.tipoPago.findFirst({
      where: { tipoId: id, tenantId },
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

    if (!tipoPagoExistente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de pago no encontrado',
          code: 'PAYMENT_TYPE_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    // Verificar que no tiene reconciliaciones asociadas
    const totalReconciliaciones = tipoPagoExistente._count.reconciliacionesVenta +
                                 tipoPagoExistente._count.reconciliacionesServicio +
                                 tipoPagoExistente._count.reconciliacionesGasto

    if (totalReconciliaciones > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede eliminar un tipo de pago que tiene reconciliaciones asociadas',
          code: 'PAYMENT_TYPE_HAS_RECONCILIATIONS',
          details: {
            reconciliacionesVenta: tipoPagoExistente._count.reconciliacionesVenta,
            reconciliacionesServicio: tipoPagoExistente._count.reconciliacionesServicio,
            reconciliacionesGasto: tipoPagoExistente._count.reconciliacionesGasto
          }
        },
        { status: 400 }
      )
    }

    const deleteResult = await prisma.tipoPago.deleteMany({
      where: { tipoId: id, tenantId }
    })
    if (deleteResult.count !== 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de pago no encontrado',
          code: 'PAYMENT_TYPE_NOT_FOUND',
        },
        { status: 404 },
      )
    }

    // Registrar en auditoría
    await AuditLogService.log({
      accion: "DELETE",
      entidad: "TIPO_PAGO",
      entidadId: id,
      usuarioId: user.userId,
      detalles: {
        nombre: tipoPagoExistente.nombre,
        requiereCuenta: tipoPagoExistente.requiereCuenta,
        cuentaDefecto: tipoPagoExistente.cuentaDefecto,
        tenantId
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Tipo de pago eliminado exitosamente'
    })

  } catch (error) {
    if (error instanceof ActionError && error.code === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: 403 },
      )
    }

    console.error('Error deleting payment type:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al eliminar el tipo de pago',
        code: 'DELETE_PAYMENT_TYPE_ERROR'
      },
      { status: 500 }
    )
  }
}
