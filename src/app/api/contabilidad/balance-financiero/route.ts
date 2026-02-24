import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get("year")
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

    // 1. BALANCE DE COMPROBACIÓN (Snapshot actual / Acumulado)
    // Activos
    const cuentasBancarias = await prisma.cuentaBancaria.findMany({
      select: { nombreBanco: true, saldo: true, moneda: true },
    })
    
    // Calcular total en moneda principal (asumiendo 1:1 o que el frontend maneja monedas, 
    // por simplicidad sumaremos nominalmente o separaremos por moneda si es crítico, 
    // aquí sumaremos todo asumiendo CUP por defecto o conversión simple)
    // Para una implementación robusta, se debería usar la tabla de tasas de cambio.
    // Por ahora sumamos los saldos.
    const totalEfectivo = cuentasBancarias.reduce((acc: number, c: { saldo: number }) => acc + c.saldo, 0)

    const productos = await prisma.producto.findMany({
      select: { stock: true, precioCosto: true },
    })
    const totalInventario = productos.reduce((acc: number, p: { stock: number; precioCosto: number }) => acc + (p.stock * p.precioCosto), 0)

    const cuentasPorCobrar = await prisma.cuentaPorCobrar.findMany({
      select: { montoDeuda: true, montoPagado: true },
    })
    const totalCuentasPorCobrar = cuentasPorCobrar.reduce((acc: number, c: { montoDeuda: unknown; montoPagado: unknown }) => acc + (Number(c.montoDeuda) - Number(c.montoPagado)), 0)

    // Pasivos
    const deudasExternas = await prisma.inyeccionCapital.findMany({
      where: { tipo: "DEUDA_EXTERNA" },
      select: { saldoPendiente: true, montoTotalDeuda: true },
    })
    const totalPasivos = deudasExternas.reduce((acc: number, d: { saldoPendiente: unknown; montoTotalDeuda: unknown }) => acc + (d.saldoPendiente ? Number(d.saldoPendiente) : Number(d.montoTotalDeuda)), 0)

    // Patrimonio
    const capitalSocial = await prisma.inyeccionCapital.findMany({
      where: { tipo: "CAPITAL_SOCIAL" },
      select: { montoRecibido: true },
    })
    const totalCapital = capitalSocial.reduce((acc: number, c: { montoRecibido: unknown }) => acc + Number(c.montoRecibido), 0)

    // 2. ESTADO DE RESULTADOS (Desglose Mensual para el año seleccionado)
    const months = Array.from({ length: 12 }, (_, i) => i) // 0..11
    
    const monthlyData = await Promise.all(months.map(async (monthIndex) => {
      const startDate = new Date(year, monthIndex, 1)
      const endDate = new Date(year, monthIndex + 1, 0) // Último día del mes

      // Ingresos
      const ventas = await prisma.venta.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        include: { producto: true }
      })
      const ingresosVentas = ventas.reduce((acc: number, v: { total: number | null; cantidad: number; producto: { precioVenta: number | null; precioCosto: number | null } | null }) => acc + (v.total ?? ((v.producto?.precioVenta ?? 0) * v.cantidad)), 0)

      const ventasServicios = await prisma.ventaServicios.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
      })
      const ingresosServicios = ventasServicios.reduce((acc: number, v: { total: number }) => acc + v.total, 0)

      // Gastos
      const compras = await prisma.gastoCompra.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
      })
      const gastosCompras = compras.reduce((acc: number, c: { total: number }) => acc + c.total, 0)

      const ventasCosto = ventas.reduce((acc: number, v: { cantidad: number; producto: { precioCosto: number | null } | null }) => acc + (((v.producto?.precioCosto ?? 0) * v.cantidad)), 0)

      const salarios = await prisma.pagosalario.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
      })
      // Ajuste según esquema: salario + bonificaciones + horasExtras
      const gastosSalarios = salarios.reduce((acc: number, s: { salario: number; bonificaciones: number | null; horasExtras: number | null }) => acc + s.salario + (s.bonificaciones ?? 0) + (s.horasExtras ?? 0), 0)

      const gastosOperativos = await prisma.gastosDE.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
      })
      const gastosGenerales = gastosOperativos.reduce((acc: number, g: { monto: number }) => acc + g.monto, 0)

      console.log('vc:', ventasCosto)
      //console.log('ventas:', ventas)

      const mermas = await prisma.merma.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
      })
      const gastosMermas = mermas.reduce((acc: number, m: { costoTotal: number | null }) => acc + (m.costoTotal ?? 0), 0)

      const totalIngresos = ingresosVentas + ingresosServicios 
      const totalGastos = ventasCosto + gastosSalarios + gastosGenerales + gastosMermas
      const utilidadNeta = totalIngresos - totalGastos 

      return {
        month: monthIndex + 1,
        monthName: startDate.toLocaleString('es-ES', { month: 'long' }),
        ingresosVentas,
        ingresosServicios,
        totalIngresos,
        ventasCosto,
        gastosCompras,
        gastosSalarios,
        gastosGenerales,
        gastosMermas,
        totalGastos,
        utilidadNeta
      }
    }))

    // Totales Anuales
    const anual = monthlyData.reduce((acc, curr) => ({
      ingresosVentas: acc.ingresosVentas + curr.ingresosVentas,
      ingresosServicios: acc.ingresosServicios + curr.ingresosServicios,
      totalIngresos: acc.totalIngresos + curr.totalIngresos,
      gastosCompras: acc.gastosCompras + curr.gastosCompras,
      gastosSalarios: acc.gastosSalarios + curr.gastosSalarios,
      gastosGenerales: acc.gastosGenerales + curr.gastosGenerales,
      gastosMermas: acc.gastosMermas + curr.gastosMermas,
      totalGastos: acc.totalGastos + curr.totalGastos,
      utilidadNeta: acc.utilidadNeta + curr.utilidadNeta
    }), {
      ingresosVentas: 0, ingresosServicios: 0, totalIngresos: 0,
      gastosCompras: 0, gastosSalarios: 0, gastosGenerales: 0, gastosMermas: 0,
      totalGastos: 0, utilidadNeta: 0
    })

    return NextResponse.json({
      balance: {
        activos: {
          efectivo: totalEfectivo,
          inventario: totalInventario,
          cuentasPorCobrar: totalCuentasPorCobrar,
          total: totalEfectivo + totalInventario + totalCuentasPorCobrar
        },
        pasivos: {
          deudaExterna: totalPasivos,
          total: totalPasivos
        },
        patrimonio: {
          capitalSocial: totalCapital,
          utilidadAcumulada: anual.utilidadNeta, // Simplificación: Usamos la utilidad del año actual como parte del patrimonio
          total: totalCapital + anual.utilidadNeta
        }
      },
      estadoResultados: {
        mensual: monthlyData,
        anual: anual
      }
    })

  } catch (error) {
    console.error("Error al obtener balance financiero:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
})
