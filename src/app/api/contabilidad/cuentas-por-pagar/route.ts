import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'
import { z } from 'zod'
import { AuditLogService } from '@/lib/services/audit-log-service'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from '@/lib/services/periodo-operacion-guard'
import { registrarEventoContable } from '@/lib/services/evento-contable-integration'

const querySchema = z.object({
  estado: z.enum(['PENDIENTE', 'PAGADA', 'PARCIAL']).optional(),
  tipo: z.enum(['compra', 'servicio']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(25)
})

const createSchema = z.object({
  numeroFactura: z.string().min(1),
  tipo: z.enum(['compra', 'servicio']),
  gastoCompraId: z.string().optional(),
  gastosDEId: z.string().optional(),
  proveedorId: z.string().optional(),
  proveedorNombre: z.string().optional(),
  montoDeuda: z.number().positive().optional(),
  moneda: z.string().optional(),
  fechaEmision: z.string().optional(),
  fechaVencimiento: z.string().optional()
})

/**
 * @description Obtiene el listado de cuentas por pagar con antigüedad y filtros.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Respuesta con cuentas por pagar y paginación
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const { searchParams } = new URL(request.url)
    const params = querySchema.parse({
      estado: searchParams.get('estado') || undefined,
      tipo: searchParams.get('tipo') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined
    })

    const cuentas = await prisma.cuentaPorPagar.findMany({
      where: {
        tipoDeuda: { not: 'DEUDA_CASH' }
      },
      include: {
        proveedor: {
          select: { vendorId: true, nombre: true, cuentaCUP: true, cuentaUSD: true }
        },
        pagos: {
          orderBy: { fechaPago: 'desc' }
        },
        gastosDE: {
          select: {
            gastosDEId: true,
            proveedor: true,
            monto: true,
            createdAt: true
          }
        },
        gastoCompra: {
          select: {
            gastoCompraId: true,
            numeroFactura: true,
            total: true,
            fechaCompra: true,
            vendor: {
              select: { vendorId: true, nombre: true, cuentaCUP: true, cuentaUSD: true }
            }
          }
        }
      }
    })

    const cuentasMap = new Map<string, typeof cuentas[number]>()
    cuentas.forEach((cuenta) => {
      cuentasMap.set(`${cuenta.tipo}|${cuenta.numeroFactura}`, cuenta)
    })

    const gastosCompra = await prisma.gastoCompra.findMany({
      where: {
        numeroFactura: { not: null },
        // Solo incluir gastos que tienen una cuentaPorPagar asociada pendiente de pago
        cuentaPorPagar: {
          estado: {
            in: ['PENDIENTE', 'PARCIAL']
          }
        }
      },
      include: {
        vendor: {
          select: { vendorId: true, nombre: true, cuentaCUP: true, cuentaUSD: true }
        },
        cuentaPorPagar: {
          select: { 
            cuentaPorPagarId: true,
            estado: true,
            montoDeuda: true,
            montoPagado: true,
            saldoPendiente: true
          }
        }
      }
    })

    const gastosDE = await prisma.gastosDE.findMany({
      where: {
        numeroFactura: { not: null },
        // Solo incluir gastos DE que no tienen reconciliación PAGADA
        reconciliaciones: {
          none: {
            estado: 'PAGADA'
          }
        }
      },
      include: {
        reconciliaciones: {
          select: { estado: true }
        }
      }
    })

    const now = new Date()
    const msPerDay = 1000 * 60 * 60 * 24

    const items = cuentas.map((cuenta) => {
      const fechaEmision = cuenta.fechaEmision ?? cuenta.createdAt
      const dias = Math.max(0, Math.floor((now.getTime() - fechaEmision.getTime()) / msPerDay))
      const rangoAntiguedad = dias <= 30 ? '0-30' : dias <= 60 ? '31-60' : dias <= 90 ? '61-90' : '90+'
      const montoDeuda = Number(cuenta.montoDeuda || 0)
      const montoPagado = Number(cuenta.montoPagado || 0)
      const saldoPendiente = Number(cuenta.saldoPendiente || (montoDeuda - montoPagado))
      const proveedorNombre =
        cuenta.proveedorNombre ||
        cuenta.proveedor?.nombre ||
        cuenta.gastosDE?.proveedor ||
        cuenta.gastoCompra?.vendor?.nombre ||
        null

      return {
        cuentaPorPagarId: cuenta.cuentaPorPagarId,
        numeroFactura: cuenta.numeroFactura,
        tipo: cuenta.tipo,
        gastoCompraId: cuenta.gastoCompraId,
        gastosDEId: cuenta.gastosDEId,
        proveedorId: cuenta.proveedorId,
        proveedorNombre,
        montoDeuda,
        montoPagado,
        saldoPendiente,
        moneda: cuenta.moneda,
        fechaEmision: fechaEmision.toISOString(),
        fechaVencimiento: cuenta.fechaVencimiento ? cuenta.fechaVencimiento.toISOString() : null,
        estado: cuenta.estado,
        diasTranscurridos: dias,
        rangoAntiguedad,
        proveedor: cuenta.proveedor || cuenta.gastoCompra?.vendor || null,
        cuentaCUP: cuenta.proveedor?.cuentaCUP || cuenta.gastoCompra?.vendor?.cuentaCUP || null,
        cuentaUSD: cuenta.proveedor?.cuentaUSD || cuenta.gastoCompra?.vendor?.cuentaUSD || null,
        pagos: cuenta.pagos || [],
        gastosDE: cuenta.gastosDE || null,
        gastoCompra: cuenta.gastoCompra || null,
        createdAt: cuenta.createdAt.toISOString(),
        updatedAt: cuenta.updatedAt.toISOString()
      }
    })

    const fromCompras = gastosCompra
      .filter((gasto) => !!gasto.numeroFactura)
      .filter((gasto) => !!gasto.cuentaPorPagar) // Solo incluir si tienen cuentaPorPagar
      .filter((gasto) => !cuentasMap.has(`compra|${gasto.numeroFactura}`))
      .map((gasto) => {
        const fechaEmision = gasto.fechaCompra ?? gasto.createdAt
        const dias = Math.max(0, Math.floor((now.getTime() - fechaEmision.getTime()) / msPerDay))
        const rangoAntiguedad = dias <= 30 ? '0-30' : dias <= 60 ? '31-60' : dias <= 90 ? '61-90' : '90+'
        const montoDeuda = Number(gasto.cuentaPorPagar?.montoDeuda || gasto.total || 0)
        const montoPagado = Number(gasto.cuentaPorPagar?.montoPagado || 0)
        const saldoPendiente = Number(gasto.cuentaPorPagar?.saldoPendiente || (montoDeuda - montoPagado))

        return {
          cuentaPorPagarId: gasto.cuentaPorPagar?.cuentaPorPagarId || null,
          numeroFactura: gasto.numeroFactura || 'S/N',
          tipo: 'compra' as const,
          gastoCompraId: gasto.gastoCompraId,
          gastosDEId: null,
          proveedorId: gasto.vendorId,
          proveedorNombre: gasto.vendor?.nombre || null,
          montoDeuda,
          montoPagado,
          saldoPendiente,
          moneda: 'CUP',
          fechaEmision: fechaEmision.toISOString(),
          fechaVencimiento: null,
          estado: gasto.cuentaPorPagar?.estado || 'PENDIENTE' as const,
          diasTranscurridos: dias,
          rangoAntiguedad,
          proveedor: gasto.vendor || null,
          cuentaCUP: gasto.vendor?.cuentaCUP || null,
          cuentaUSD: gasto.vendor?.cuentaUSD || null,
          gastosDE: null,
          gastoCompra: {
            gastoCompraId: gasto.gastoCompraId,
            numeroFactura: gasto.numeroFactura,
            total: gasto.total,
            fechaCompra: gasto.fechaCompra
          },
          createdAt: gasto.createdAt.toISOString(),
          updatedAt: gasto.updatedAt.toISOString()
        }
      })

    const fromServicios = gastosDE
      .filter((gasto) => !!gasto.numeroFactura)
      .filter((gasto) => !cuentasMap.has(`servicio|${gasto.numeroFactura}`))
      .map((gasto) => {
        const fechaEmision = gasto.createdAt
        const dias = Math.max(0, Math.floor((now.getTime() - fechaEmision.getTime()) / msPerDay))
        const rangoAntiguedad = dias <= 30 ? '0-30' : dias <= 60 ? '31-60' : dias <= 90 ? '61-90' : '90+'
        const montoDeuda = Number(gasto.monto || 0)

        return {
          cuentaPorPagarId: null,
          numeroFactura: gasto.numeroFactura || 'S/N',
          tipo: 'servicio' as const,
          gastoCompraId: null,
          gastosDEId: gasto.gastosDEId,
          vendorId: null,
          proveedorNombre: gasto.proveedor || null,
          montoDeuda,
          montoPagado: 0,
          saldoPendiente: montoDeuda,
          moneda: 'CUP',
          fechaEmision: fechaEmision.toISOString(),
          fechaVencimiento: null,
          estado: 'PENDIENTE' as const,
          diasTranscurridos: dias,
          rangoAntiguedad,
          vendor: null,
          gastosDE: {
            gastosDEId: gasto.gastosDEId,
            proveedor: gasto.proveedor,
            numeroFactura: gasto.numeroFactura,
            monto: gasto.monto,
            createdAt: gasto.createdAt
          },
          gastoCompra: null,
          createdAt: gasto.createdAt.toISOString(),
          updatedAt: gasto.updatedAt.toISOString()
        }
      })

    let data = [...items, ...fromCompras, ...fromServicios]

    if (params.tipo) {
      data = data.filter((item) => item.tipo === params.tipo)
    }

    if (params.estado) {
      data = data.filter((item) => item.estado === params.estado)
    }

    if (params.search) {
      const search = params.search.toLowerCase()
      data = data.filter((item) => {
        const proveedor = item.proveedorNombre?.toLowerCase() || ''
        const factura = item.numeroFactura?.toLowerCase() || ''
        return proveedor.includes(search) || factura.includes(search)
      })
    }

    data.sort((a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime())

    const total = data.length
    const totalPages = Math.ceil(total / params.limit)
    const start = (params.page - 1) * params.limit
    const end = start + params.limit

    return NextResponse.json({
      cuentas: data.slice(start, end),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages
      }
    })
  } catch (error) {
    console.error('Error al obtener cuentas por pagar:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al obtener cuentas por pagar' }, { status: 500 })
  }
}

/**
 * @description Crea un registro de cuenta por pagar manual o a partir de compras/servicios.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Cuenta por pagar creada
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    // Validar que el período permite operaciones
    await assertOperationAllowed(new Date(), 'CUENTA_POR_PAGAR')

    const body = createSchema.parse(await request.json())

    await assertOperationAllowed(new Date(), 'CUENTA_POR_PAGAR')

    const existing = await prisma.cuentaPorPagar.findFirst({
      where: {
        numeroFactura: body.numeroFactura,
        tipo: body.tipo
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'La cuenta por pagar ya existe' }, { status: 409 })
    }

    let montoDeuda = body.montoDeuda
    let proveedorId = body.proveedorId
    let proveedorNombre = body.proveedorNombre
    let gastoCompraId = body.gastoCompraId
    let gastosDEId = body.gastosDEId
    let fechaEmision = body.fechaEmision ? new Date(body.fechaEmision) : new Date()

    if (!montoDeuda) {
      if (body.tipo === 'compra') {
        const compra = await prisma.gastoCompra.findFirst({
          where: {
            OR: [
              body.gastoCompraId ? { gastoCompraId: body.gastoCompraId } : undefined,
              { numeroFactura: body.numeroFactura }
            ].filter(Boolean) as any
          },
          include: { vendor: true }
        })

        if (!compra) {
          return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
        }

        montoDeuda = Number(compra.total)
        proveedorId = compra.vendorId
        proveedorNombre = compra.vendor?.nombre || proveedorNombre
        gastoCompraId = compra.gastoCompraId
        fechaEmision = compra.fechaCompra ?? compra.createdAt
      }

      if (body.tipo === 'servicio') {
        const gasto = await prisma.gastosDE.findFirst({
          where: {
            OR: [
              body.gastosDEId ? { gastosDEId: body.gastosDEId } : undefined,
              { numeroFactura: body.numeroFactura }
            ].filter(Boolean) as any
          }
        })

        if (!gasto) {
          return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
        }

        montoDeuda = Number(gasto.monto)
        proveedorNombre = gasto.proveedor || proveedorNombre
        gastosDEId = gasto.gastosDEId
        fechaEmision = gasto.createdAt
      }
    }

    if (!montoDeuda) {
      return NextResponse.json({ error: 'Monto de deuda inválido' }, { status: 400 })
    }

    const cuenta = await prisma.cuentaPorPagar.create({
      data: {
        numeroFactura: body.numeroFactura,
        tipo: body.tipo,
        gastoCompraId,
        gastosDEId,
        proveedorId,
        proveedorNombre,
        montoDeuda,
        montoPagado: 0,
        saldoPendiente: montoDeuda,
        moneda: body.moneda || 'CUP',
        fechaEmision,
        fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : null
      }
    })

    // Registrar evento contable
    await registrarEventoContable({
      origenTipo: 'CUENTA_POR_PAGAR',
      origenId: cuenta.cuentaPorPagarId,
      monto: montoDeuda,
      fechaOperacion: new Date(),
      descripcion: `Creación de cuenta por pagar - ${body.tipo}`,
      usuarioId: user.userId
    })

    await registrarEventoContable({
      origenTipo: 'CUENTA_POR_PAGAR',
      origenId: cuenta.cuentaPorPagarId,
      monto: montoDeuda,
      fechaOperacion: new Date(),
      descripcion: `Cuenta por pagar - ${body.numeroFactura}`,
      moneda: body.moneda || 'CUP',
      usuarioId: user.userId,
    })

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'CUENTA_POR_PAGAR',
      entidadId: cuenta.cuentaPorPagarId,
      usuarioId: user.userId,
      detalles: {
        numeroFactura: body.numeroFactura,
        tipo: body.tipo,
        proveedorNombre,
        montoDeuda,
        moneda: body.moneda || 'CUP'
      }
    })

    return NextResponse.json({ cuenta })
  } catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('Error al crear cuenta por pagar:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al crear cuenta por pagar' }, { status: 500 })
  }
}
