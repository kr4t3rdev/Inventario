import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { ActionError } from '@/lib/server-actions'
import { requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import { canAccessAccountingItem } from '@/lib/plan-access'
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service'

// Schema for creating a bank transfer
const createTransferenciaSchema = z.object({
  cuentaOrigenId: z.string().min(1, 'Cuenta origen es requerida'),
  cuentaDestinoId: z.string().min(1, 'Cuenta destino es requerida'),
  montoOrigen: z.number().positive('El monto debe ser positivo'),
  motivo: z.string().min(1, 'El motivo es requerido'),
  descripcion: z.string().optional(),
  tasaCambio: z.number().positive().optional(),
  numeroComprobante: z.string().min(1).max(64).optional(),
})

// GET /api/contabilidad/transferencias - List bank transfers
export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    if (user.role !== 'admin' && !canAccessAccountingItem(user, 'Transferencias Bancarias')) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
    const tenantId = requireTenant(user)

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const cuentaId = searchParams.get('cuentaId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { tenantId }
    
    if (cuentaId) {
      where.OR = [
        { cuentaOrigenId: cuentaId },
        { cuentaDestinoId: cuentaId }
      ]
    }

    if (fechaDesde || fechaHasta) {
      where.fechaTransferencia = {}
      if (fechaDesde) {
        where.fechaTransferencia.gte = new Date(fechaDesde)
      }
      if (fechaHasta) {
        where.fechaTransferencia.lte = new Date(fechaHasta)
      }
    }

    const [transferencias, total] = await Promise.all([
      prisma.transferenciaBancaria.findMany({
        where,
        select: {
          transferenciaId: true,
          numeroComprobante: true,
          cuentaOrigenId: true,
          cuentaDestinoId: true,
          montoOrigen: true,
          monedaOrigen: true,
          montoDestino: true,
          monedaDestino: true,
          tasaCambio: true,
          motivo: true,
          descripcion: true,
          fechaTransferencia: true,
          comprobanteGenerado: true,
          rutaComprobante: true,
          createdAt: true,
          updatedAt: true,
          cuentaOrigen: {
            select: {
              cuentaId: true,
              nombreBanco: true,
              numeroCuenta: true,
              moneda: true
            }
          },
          cuentaDestino: {
            select: {
              cuentaId: true,
              nombreBanco: true,
              numeroCuenta: true,
              moneda: true
            }
          }
        },
        orderBy: {
          fechaTransferencia: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.transferenciaBancaria.count({ where })
    ])

    // Convert Decimal amounts to numbers for proper JSON serialization
    const transferenciasFormateadas = transferencias.map((trans: any) => ({
      ...trans,
      montoOrigen: Number(trans.montoOrigen),
      montoDestino: Number(trans.montoDestino),
      tasaCambio: trans.tasaCambio ? Number(trans.tasaCambio) : null
    }))

    return NextResponse.json({
      transferencias: transferenciasFormateadas,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching transferencias:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/contabilidad/transferencias - Execute bank transfer
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    if (user.role !== 'admin' && !canAccessAccountingItem(user, 'Transferencias Bancarias')) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
    const tenantId = requireTenant(user)

    const body = await request.json()
    const validatedData = createTransferenciaSchema.parse(body)

    // Validar período contable antes de ejecutar la transferencia
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId,
      tipoOperacion: 'transferencia',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    const result = await AccountingOperationsMutationService.createBankTransfer({
      input: validatedData,
      user,
    })
    return NextResponse.json({
      message: 'Transferencia ejecutada exitosamente',
      ...result,
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof ActionError) {
      const status = error.code === 'NOT_FOUND' ? 404
        : error.code === 'FORBIDDEN' || error.code === 'TENANT_REQUIRED' ? 403
          : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }

    // Idempotencia (C3/G2): numeroComprobante es único por tenant.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Ya existe una transferencia con ese número de comprobante', code: 'TRANSFERENCIA_DUPLICADA' },
        { status: 409 },
      )
    }

    console.error('Error creating transferencia:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
