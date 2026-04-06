import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import type { Prisma } from '@/generated/prisma'
import { authenticateUser } from "@/lib/auth-middleware"
import { AuditLogService } from "@/lib/services/audit-log-service"
import {
  applyPagoGastoWorkflow,
  isGastoWorkflowError
} from '@/lib/services/pago-gastos-workflow'

// Schema para validar la reconciliación de gastos
const reconciliacionGastoSchema = z.object({
  tipoGasto: z.enum(['salario', 'gastoDE', 'compra'], {
    errorMap: () => ({ message: 'Tipo de gasto debe ser: salario, gastoDE o compra' })
  }),
  pgId: z.string().optional(),
  gastosDEId: z.string().optional(),
  gastoCompraId: z.string().optional(),
  referenciaId: z.string().optional(), // Campo genérico aceptado como alias de los IDs específicos
  // Para modo de una sola cuenta, se requiere cuentaId; para distribución multi-cuenta, no.
  cuentaId: z.string().min(1, 'ID de cuenta bancaria es requerido').optional(),
  tipoPagoId: z.string().min(1, 'Tipo de pago es requerido').optional(),
  monto: z.number().positive('El monto debe ser positivo'),
  moneda: z.string().default('CUP'),
  tasaCambio: z.number().positive().optional(),
  descripcion: z.string().min(1, 'Descripción es requerida'),
  periodo: z.string().optional(),
  observaciones: z.string().optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']).default('PAGADA'),
  cuentaPorPagarId: z.string().optional(),
  numeroTransaccion: z.string().optional(),
  // Para distribución multi-cuenta en salarios
  distribucion: z.array(z.object({
    cuentaId: z.string(),
    monto: z.number().positive(),
    porcentaje: z.number().min(0).max(100).optional()
  })).optional()
}).refine((data) => {
  // Validar que se proporcione exactamente uno de los IDs según el tipo de gasto
  const { tipoGasto, pgId, gastosDEId, gastoCompraId, referenciaId } = data

  if (tipoGasto === 'salario' && !(pgId || referenciaId)) {
    return false
  }
  if (tipoGasto === 'gastoDE' && !(gastosDEId || referenciaId)) {
    return false
  }
  if (tipoGasto === 'compra' && !(gastoCompraId || referenciaId)) {
    return false
  }

  return true
}, {
  message: "Debe proporcionar el ID correspondiente al tipo de gasto"
}).refine((data) => {
  // Si es PAGADA, debe tener cuentaId o distribucion
  if (data.estado === 'PAGADA') {
    const hasDistribucion = Array.isArray(data.distribucion) && data.distribucion.length > 0
    const hasCuenta = !!data.cuentaId
    return hasDistribucion || hasCuenta
  }
  return true
}, {
  message: 'Debe indicar una cuenta bancaria o una distribución multi-cuenta para pagar',
  path: ['cuentaId']
})

// GET - Obtener gastos pendientes de reconciliar
export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { searchParams } = new URL(request.url)
    const tipoGasto = searchParams.get('tipoGasto') // 'salario', 'gastoDE', 'compra'
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    // Normalize dates to inclusive day ranges to avoid timezone/off-by-one issues
    const fechaDesdeDate = fechaDesde ? new Date(fechaDesde) : undefined
    const fechaHastaDate = fechaHasta ? new Date(fechaHasta) : undefined
    if (fechaDesdeDate) fechaDesdeDate.setHours(0, 0, 0, 0)
    if (fechaHastaDate) fechaHastaDate.setHours(23, 59, 59, 999)

    const periodo = searchParams.get('periodo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const gastosPendientes: any[] = []

    // Obtener salarios pendientes
    if (!tipoGasto || tipoGasto === 'salario') {
      const whereClauseSalarios: {
        ReconciliacionGasto?: { none: object }
        createdAt?: { gte?: Date; lte?: Date }
        periodo?: string
      } = {
        ReconciliacionGasto: { none: {} }
      }

      if (fechaDesdeDate || fechaHastaDate) {
        whereClauseSalarios.createdAt = {}
        if (fechaDesdeDate) whereClauseSalarios.createdAt.gte = fechaDesdeDate
        if (fechaHastaDate) whereClauseSalarios.createdAt.lte = fechaHastaDate
      }

      if (periodo) {
        whereClauseSalarios.periodo = periodo
      }

      const empleadosConSalarios = await prisma.pagosalario.findMany({
        where: whereClauseSalarios,
        select: {
          pgId: true,
          salario: true,
          bonificaciones: true,
          deducciones: true,
          horasExtras: true,
          periodo: true,
          createdAt: true,
          updatedAt: true,
          empleado: {
            select: {
              nombre: true,
              apellido: true,
              cargo: true
            }
          },
          ReconciliacionGasto: true
        }
      })

      // Agregar información de reconciliación para salarios
      for (const pagoSalario of empleadosConSalarios) {
        const salarioTotal = pagoSalario.salario + (pagoSalario.bonificaciones || 0) + (pagoSalario.horasExtras || 0) - (pagoSalario.deducciones || 0)

        gastosPendientes.push({
          tipo: 'salario',
          referenciaId: pagoSalario.pgId,
          descripcion: `Salario - ${pagoSalario.empleado.nombre} ${pagoSalario.empleado.apellido}`,
          monto: salarioTotal,
          periodo: pagoSalario.periodo,
          reconciliado: false, // Los salarios aquí son siempre no reconciliados por el filtro
          detalles: {
            empleado: {
              nombre: pagoSalario.empleado.nombre,
              apellido: pagoSalario.empleado.apellido,
              cargo: pagoSalario.empleado.cargo
            },
            salarioBases: pagoSalario.salario,
            bonificaciones: pagoSalario.bonificaciones,
            deducciones: pagoSalario.deducciones,
            horasExtras: pagoSalario.horasExtras
          },
          createdAt: pagoSalario.createdAt,
          updatedAt: pagoSalario.updatedAt
        })
      }
    }

    // Obtener gastos DE pendientes
    if (!tipoGasto || tipoGasto === 'gastoDE') {
      const whereClauseGastosDE: {
        reconciliaciones?: { none: object }
        createdAt?: { gte?: Date; lte?: Date }
        periodo?: string
       // isPagado?: string | null | { not: string }
      } = {
        reconciliaciones: { none: {} }
       // isPagado: { not: 'pagado' }
      }

      if (fechaDesdeDate || fechaHastaDate) {
        whereClauseGastosDE.createdAt = {}
        if (fechaDesdeDate) whereClauseGastosDE.createdAt.gte = fechaDesdeDate
        if (fechaHastaDate) whereClauseGastosDE.createdAt.lte = fechaHastaDate
      }

      if (periodo) {
        whereClauseGastosDE.periodo = periodo
      }

      const gastosDE = await prisma.gastosDE.findMany({
        where: whereClauseGastosDE,
        select: {
          gastosDEId: true,
          tipo: true,
          proveedor: true,
          monto: true,
          periodo: true,
          descripcion: true,
          isPagado: true,
          createdAt: true,
          updatedAt: true,
          reconciliaciones: true
        }
      })

      for (const gasto of gastosDE) {
        // Verificar que realmente no tenga reconciliaciones
        if (gasto.reconciliaciones.length === 0) {
          gastosPendientes.push({
            tipo: 'gastoDE',
            referenciaId: gasto.gastosDEId,
            descripcion: `${gasto.tipo} - ${gasto.proveedor}`,
            monto: gasto.monto,
            periodo: gasto.periodo,
            reconciliado: false, // Los gastos DE aquí son siempre no reconciliados por el filtro
            detalles: {
              tipo: gasto.tipo,
              proveedor: gasto.proveedor,
              descripcionOriginal: gasto.descripcion,
              isPagado: gasto.isPagado
            },
            createdAt: gasto.createdAt,
            updatedAt: gasto.updatedAt
          })
        }
      }
    }

    // Obtener compras pendientes
    if (!tipoGasto || tipoGasto === 'compra') {
      const whereClauseCompras: any = {
        reconciliaciones: { none: {} }
      }

      if (fechaDesdeDate || fechaHastaDate) {
        whereClauseCompras.createdAt = {}
        if (fechaDesdeDate) whereClauseCompras.createdAt.gte = fechaDesdeDate
        if (fechaHastaDate) whereClauseCompras.createdAt.lte = fechaHastaDate
      }

      const compras = await prisma.gastoCompra.findMany({
        where: whereClauseCompras,
        include: {
          producto: {
            select: {
              nombre: true
            }
          },
          vendor: {
            select: {
              nombre: true
            }
          },
          reconciliaciones: true,
          cuentaPorPagar: true
        }
      })

      for (const compra of compras) {
        // Verificar que realmente no tenga reconciliaciones ni cuenta por pagar
        // Los restocks con PAGO_PARCIAL tienen cuentaPorPagar, los de PAGO_COMPLETO tienen reconciliacionGasto
        const tieneReconciliacion = compra.reconciliaciones && compra.reconciliaciones.length > 0
        const tieneCuentaPorPagar = !!compra.cuentaPorPagar && !!compra.cuentaPorPagar.cuentaPorPagarId
        
        if (!tieneReconciliacion && !tieneCuentaPorPagar) {
          gastosPendientes.push({
            tipo: 'compra',
            referenciaId: compra.gastoCompraId,
            descripcion: `Compra - ${compra.producto.nombre} (${compra.vendor.nombre})`,
            monto: compra.total,
            periodo: null,
            reconciliado: false,
            detalles: {
              producto: compra.producto.nombre,
              vendor: compra.vendor.nombre,
              cantidad: compra.cantidad,
              precioUnitario: compra.precioUnitario,
              fechaCompra: compra.fechaCompra,
              descripcionOriginal: compra.descripcion
            },
            createdAt: compra.createdAt,
            updatedAt: compra.updatedAt
          })
        }
      }
    }

    // Ordenar por fecha de creación descendente
    gastosPendientes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Aplicar paginación
    const total = gastosPendientes.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = skip
    const endIndex = startIndex + limit
    const gastosPaginados = gastosPendientes.slice(startIndex, endIndex)

    return NextResponse.json({
      gastos: gastosPaginados,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })

  } catch (error) {
    console.error('Error fetching pending expenses:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// POST - Reconciliar gasto con cuenta(s) bancaria(s)
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const validatedData = reconciliacionGastoSchema.parse(body)

    // Verificar que la referencia existe según el tipo de gasto
    let referenciaExiste = false
    let referenciaId: string = ''
    let pgIdResolved: string | undefined
    let gastosDEIdResolved: string | undefined
    let gastoCompraIdResolved: string | undefined

    switch (validatedData.tipoGasto) {
      case 'salario': {
        // aceptar empleadoId o referenciaId
        const empleadoIdToUse = validatedData.pgId ?? validatedData.referenciaId
        if (!empleadoIdToUse) {
          return NextResponse.json(
            { error: 'Id de pago salario es requerido para gastos de salario', code: 'EMPLEADO_ID_REQUERIDO' },
            { status: 400 }
          )
        }
        const pagoSalario = await prisma.pagosalario.findUnique({
          where: { pgId: empleadoIdToUse }
        })
        if (pagoSalario) {
          referenciaExiste = true
          referenciaId = empleadoIdToUse
          pgIdResolved = empleadoIdToUse
        }
        break
      }

      case 'gastoDE': {
        // aceptar gastosDEId o referenciaId
        const gastosDEIdToUse = validatedData.gastosDEId ?? validatedData.referenciaId
        if (!gastosDEIdToUse) {
          return NextResponse.json(
            { error: 'gastosDEId es requerido para gastos DE', code: 'GASTO_DE_ID_REQUERIDO' },
            { status: 400 }
          )
        }
        const gastoDE = await prisma.gastosDE.findUnique({
          where: { gastosDEId: gastosDEIdToUse }
        })
        if (gastoDE) {
          referenciaExiste = true
          referenciaId = gastosDEIdToUse
          gastosDEIdResolved = gastosDEIdToUse
        }
        break
      }

      case 'compra': {
        // aceptar gastoCompraId o referenciaId
        const gastoCompraIdToUse = validatedData.gastoCompraId ?? validatedData.referenciaId
        if (!gastoCompraIdToUse) {
          return NextResponse.json(
            { error: 'gastoCompraId es requerido para gastos de compra', code: 'GASTO_COMPRA_ID_REQUERIDO' },
            { status: 400 }
          )
        }
        const compra = await prisma.gastoCompra.findUnique({
          where: { gastoCompraId: gastoCompraIdToUse }
        })
        if (compra) {
          referenciaExiste = true
          referenciaId = gastoCompraIdToUse
          gastoCompraIdResolved = gastoCompraIdToUse
        }
        break
      }
    }

    if (!referenciaExiste) {
      return NextResponse.json(
        { error: `${validatedData.tipoGasto} no encontrado`, code: 'REFERENCIA_NO_ENCONTRADA' },
        { status: 404 }
      )
    }

    // Verificar si ya está reconciliado (solo para gastos que NO son cuentas por pagar)
    // Las cuentas por pagar permiten pagos parciales, por lo que pueden tener múltiples reconciliaciones
    if (!validatedData.cuentaPorPagarId) {
      const whereReconciliacion: any = {
        tipoGasto: validatedData.tipoGasto,
        ...(validatedData.periodo && { periodo: validatedData.periodo })
      }

      // Usar referenciaId como campo principal de búsqueda
      whereReconciliacion.referenciaId = referenciaId

      const reconciliacionExistente = await prisma.reconciliacionGasto.findFirst({
        where: whereReconciliacion
      })

      if (reconciliacionExistente) {
        return NextResponse.json(
          { error: 'Este gasto ya ha sido reconciliado', code: 'GASTO_YA_RECONCILIADO' },
          { status: 400 }
        )
      }
    }

    // Validación de tasa de cambio: realizarla antes de la transacción
    if (validatedData.distribucion && validatedData.distribucion.length > 0) {
      const cuentaIds = Array.from(new Set(validatedData.distribucion.map(d => d.cuentaId)))
      if (cuentaIds.length > 0) {
        const cuentas = await prisma.cuentaBancaria.findMany({
          where: { cuentaId: { in: cuentaIds } },
          select: { cuentaId: true, moneda: true }
        })
        const monedasDifieren = cuentas.some((c: { moneda: string }) => c.moneda !== validatedData.moneda)
        if (monedasDifieren && !validatedData.tasaCambio) {
          return NextResponse.json(
            { error: 'Tasa de cambio requerida por desajuste de moneda', code: 'TASA_CAMBIO_REQUERIDA' },
            { status: 400 }
          )
        }
      }
    } else if (validatedData.cuentaId) {
      const cuenta = await prisma.cuentaBancaria.findUnique({
        where: { cuentaId: validatedData.cuentaId },
        select: { moneda: true }
      })
      if (cuenta && cuenta.moneda !== validatedData.moneda && !validatedData.tasaCambio) {
        return NextResponse.json(
          { error: 'Tasa de cambio requerida por desajuste de moneda', code: 'TASA_CAMBIO_REQUERIDA' },
          { status: 400 }
        )
      }
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return applyPagoGastoWorkflow(tx, {
        tipoGasto: validatedData.tipoGasto,
        referenciaId,
        reconciliadoPor: user.userId,
        descripcion: validatedData.descripcion,
        monto: Number(validatedData.monto),
        moneda: validatedData.moneda,
        tasaCambio: validatedData.tasaCambio,
        periodo: validatedData.periodo,
        observaciones: validatedData.observaciones,
        estado: validatedData.estado,
        cuentaPorPagarId: validatedData.cuentaPorPagarId,
        numeroTransaccion: validatedData.numeroTransaccion,
        pgId: pgIdResolved,
        gastosDEId: gastosDEIdResolved,
        gastoCompraId: gastoCompraIdResolved,
        cuentaId: validatedData.cuentaId,
        tipoPagoId: validatedData.tipoPagoId,
        distribucion: validatedData.distribucion
      })
    })

    for (const rec of result.reconciliaciones) {
      try {
        await AuditLogService.log({
          accion: "CREATE",
          entidad: "RECONCILIACION",
          entidadId: rec.reconciliacionId,
          usuarioId: user.userId,
          detalles: {
            tipo: "GASTO",
            tipoGasto: validatedData.tipoGasto,
            referenciaId,
            cuentaId: rec.cuentaId,
            monto: rec.monto,
            moneda: rec.moneda,
            montoConvertido: rec.montoConvertido,
            descripcion: rec.descripcion
          }
        });
      } catch (auditError) {
        console.error('Error registrando auditoría de reconciliación de gasto:', auditError)
      }
    }

    return NextResponse.json(
      {
        message: 'Gasto reconciliado exitosamente',
        reconciliaciones: result.reconciliaciones,
        cuentaPorPagar: result.cuentaPorPagar,
        pagoCuentaPorPagar: result.pagoCuentaPorPagar,
        distribucionMultiCuenta: Boolean(validatedData.distribucion?.length)
      },
      { status: 201 }
    )

  } catch (error:unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      )
    }

    if (isGastoWorkflowError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      )
    }

    console.error('Error reconciling expense:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
