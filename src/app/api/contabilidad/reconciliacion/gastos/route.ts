import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from "@/lib/auth-middleware"
import { requireTenant } from '@/lib/services/tenant-scope'
import { validarEscrituraPeriodo, extraerFechaDeBody } from '@/lib/services/validate-period-write'
import {
  reconciliarGastoAdapter,
} from '@/features/contabilidad/api/reconciliacion-gastos-adapter'
import { getPayrollPaymentAmount } from '@/features/pago-salario/payroll-amounts'
import { z } from 'zod'

// POST - Reconciliar gasto con cuenta(s) bancaria(s)
// Thin adapter: solo auth + period guard; la lógica de negocio está en reconciliarGastoAdapter
export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const tenantId = requireTenant(user)

    const body = await request.json()

    // Validar período contable antes de escribir
    const fechaOperacion = extraerFechaDeBody(body) ?? new Date()
    const validacionPeriodo = await validarEscrituraPeriodo({
      fecha: fechaOperacion,
      tenantId: user.tenantId ?? '',
      tipoOperacion: 'reconciliacion_gastos',
      actor: user.userId,
    })
    if (!validacionPeriodo.permitido) {
      return NextResponse.json(
        { error: validacionPeriodo.error?.message ?? 'Período contable cerrado', code: validacionPeriodo.error?.code ?? 'PERIODO_CERRADO' },
        { status: 400 }
      )
    }

    // Delegar toda la lógica de negocio al adapter
    const result = await reconciliarGastoAdapter(body, user)

    return NextResponse.json(
      {
        message: 'Gasto reconciliado exitosamente',
        reconciliaciones: result.reconciliaciones,
        cuentaPorPagar: result.cuentaPorPagar,
        pagoCuentaPorPagar: result.pagoCuentaPorPagar,
        distribucionMultiCuenta: result.distribucionMultiCuenta,
      },
      { status: 201 },
    )
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 },
      )
    }

    // Errores lanzados desde el adapter con status + code
    const err = error as { status?: number; code?: string; message?: string }
    if (err.status && err.code) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      )
    }

    console.error('Error reconciliando gasto:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

// GET - Obtener gastos pendientes de reconciliar
export async function GET(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user
    const tenantId = requireTenant(user)

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
        tenantId: string
        ReconciliacionGasto?: { none: object }
        createdAt?: { gte?: Date; lte?: Date }
        periodo?: string
      } = {
        tenantId,
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
          horasExtrasHoras: true,
          montoHorasExtras: true,
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
        const salarioTotal = getPayrollPaymentAmount(pagoSalario)

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
            horasExtras: pagoSalario.horasExtrasHoras,
            montoHorasExtras: pagoSalario.montoHorasExtras
          },
          createdAt: pagoSalario.createdAt,
          updatedAt: pagoSalario.updatedAt
        })
      }
    }

    // Obtener gastos DE pendientes
    if (!tipoGasto || tipoGasto === 'gastoDE') {
      const whereClauseGastosDE: {
        tenantId: string
        reconciliaciones?: { none: object }
        createdAt?: { gte?: Date; lte?: Date }
        periodo?: string
       // isPagado?: string | null | { not: string }
      } = {
        tenantId,
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
        tenantId,
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
