import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type {
  VentaConPrecio,
  VentaServiciosConRelaciones,
  VentaServiciosTotal,
  GastoCompraConVendor,
  PagoSalarioConEmpleado,
  TipoPagoSeleccionado,
  OperacionFormateada,
  GastoFormateado,
} from "./types"
import type { GastosDE } from "@/generated/prisma"

export async function getCuadreDiarioHandler(request: NextRequest, _context: any, _user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const fechaParam = searchParams.get("fecha")

    const now = new Date()
    const fecha = fechaParam
      ? new Date(fechaParam + "T00:00:00")
      : new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const year = fecha.getFullYear()
    const month = String(fecha.getMonth() + 1).padStart(2, "0")
    const day = String(fecha.getDate()).padStart(2, "0")

    const formatoFecha = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    }

    const fechaInicio = new Date(`${year}-${month}-${day}T00:00:00`)
    const fechaFin = new Date(`${year}-${month}-${day}T23:59:59.999`)

    const [ventasDelDia, ventaServiciosDelDia, gastosDEdelDia, gastosCompraDelDia, gastosSalariosDia, todasLasVentas, tiposPago] =
      await Promise.all([
        prisma.venta.findMany({
          where: {
            createdAt: {
              gte: fechaInicio,
              lte: fechaFin,
            },
          },
          include: {
            producto: {
              select: { nombre: true, precioVenta: true },
            },
            puntoDeVenta: {
              select: { nombre: true },
            },
            cliente: {
              select: { nombre: true },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.ventaServicios.findMany({
          where: {
            createdAt: {
              gte: fechaInicio,
              lte: fechaFin,
            },
          },
          include: {
            servicio: {
              select: { nombre: true },
            },
            cliente: {
              select: { nombre: true },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.gastosDE.findMany({
          where: {
            createdAt: {
              gte: fechaInicio,
              lte: fechaFin,
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.gastoCompra.findMany({
          where: {
            createdAt: {
              gte: fechaInicio,
              lte: fechaFin,
            },
          },
          include: {
            vendor: {
              select: { nombre: true },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.pagosalario.findMany({
          where: {
            createdAt: {
              gte: fechaInicio,
              lte: fechaFin,
            },
          },
          include: {
            empleado: {
              select: { nombre: true, apellido: true, cargo: true },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.venta.findMany({
          select: {
            createdAt: true,
            cantidad: true,
            descuento: true,
            producto: { select: { precioVenta: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.tipoPago.findMany({
          select: { tipoId: true, nombre: true },
          orderBy: { nombre: "asc" },
        }),
      ])

    const calcularIngresosVentas = (ventas: VentaConPrecio[]) => {
      return ventas.reduce((sum: number, venta: VentaConPrecio) => {
        const precio = Number(venta.producto?.precioVenta || 0)
        return sum + (venta.cantidad * precio - (Number(venta.descuento) || 0))
      }, 0)
    }

    const calcularIngresosServicios = (
      servicios: (VentaServiciosConRelaciones | VentaServiciosTotal)[],
    ) => {
      return servicios.reduce(
        (sum: number, servicio: VentaServiciosConRelaciones | VentaServiciosTotal) =>
          sum + Number(servicio.total || 0),
        0,
      )
    }

    const calcularGastos = (gastos: GastosDE[]) => {
      return gastos.reduce((sum: number, gasto: GastosDE) => sum + Number(gasto.monto || 0), 0)
    }

    const calcularGastosSalarios = (pagos: PagoSalarioConEmpleado[]) => {
      return pagos.reduce(
        (sum: number, pago: PagoSalarioConEmpleado) =>
          sum +
          Number(pago.salario || 0) +
          Number(pago.bonificaciones || 0) -
          Number(pago.deducciones || 0),
        0,
      )
    }

    const totalVentas = calcularIngresosVentas(ventasDelDia)
    const totalServicios = calcularIngresosServicios(ventaServiciosDelDia)
    const totalIngresos = totalVentas + totalServicios
    const totalGastosDE = calcularGastos(gastosDEdelDia)
    const totalGastosCompra = gastosCompraDelDia.reduce(
      (sum: number, c: { total: number | null }) => sum + Number(c.total || 0),
      0,
    )
    const totalGastosSalarios = calcularGastosSalarios(gastosSalariosDia)
    const totalGastos = totalGastosDE + totalGastosCompra + totalGastosSalarios
    const diferencia = totalIngresos - totalGastos

    const formatearHora = (date: Date) => {
      return new Date(date).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    }

    const getMetodoPago = (
      tipoPagoId: string | null,
      tiposPagoList: TipoPagoSeleccionado[],
    ) => {
      if (!tipoPagoId) return "efectivo"
      const tipo = tiposPagoList.find(
        (t: TipoPagoSeleccionado) => t.tipoId === tipoPagoId,
      )
      return tipo?.nombre?.toLowerCase() || "efectivo"
    }

    const ventasFormateadas = ventasDelDia.map(
      (venta: {
        ventaId: string
        createdAt: Date
        cliente: { nombre: string | null } | null
        producto: { nombre: string | null } | null
        cantidad: number
        total: number | null
      }) => ({
        id: venta.ventaId,
        hora: venta.createdAt.toISOString(),
        horaFormateada: formatearHora(venta.createdAt),
        cliente: venta.cliente?.nombre || "Cliente General",
        producto: venta.producto?.nombre || "Producto",
        cantidad: venta.cantidad,
        productos: venta.cantidad,
        total: Number(venta.total || 0),
        metodoPago: getMetodoPago(null, tiposPago),
        metodoPagoRaw: null,
        estado: "completada",
      }),
    )

    const serviciosFormateados = ventaServiciosDelDia.map(
      (servicio: VentaServiciosConRelaciones) => ({
        id: servicio.ventaServicioId,
        hora: servicio.createdAt.toISOString(),
        horaFormateada: formatearHora(servicio.createdAt),
        cliente: servicio.cliente?.nombre || "Cliente General",
        producto: servicio.servicio?.nombre || "Servicio",
        cantidad: servicio.cantidad || 1,
        productos: servicio.cantidad || 1,
        total: Number(servicio.total || 0),
        metodoPago: getMetodoPago(null, tiposPago),
        metodoPagoRaw: null,
        estado: "completada",
        esServicio: true,
      }),
    )

    const todasLasOperaciones = [...ventasFormateadas, ...serviciosFormateados].sort(
      (a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime(),
    )

    const gastosFormateados = [
      ...ventasFormateadas.map((v: OperacionFormateada) => ({
        id: v.id,
        hora: v.hora,
        horaFormateada: v.horaFormateada,
        tipo: "venta",
        descripcion: `Venta a ${v.cliente}`,
        monto: v.total,
        referencia: v.id,
      })),
      ...serviciosFormateados.map((s: OperacionFormateada) => ({
        id: s.id,
        hora: s.hora,
        horaFormateada: s.horaFormateada,
        tipo: "servicio",
        descripcion: `Servicio a ${s.cliente}`,
        monto: s.total,
        referencia: s.id,
      })),
      ...gastosDEdelDia.map((g: GastosDE) => ({
        id: g.gastosDEId,
        hora: g.createdAt.toISOString(),
        horaFormateada: formatearHora(g.createdAt),
        tipo: "gasto_de",
        descripcion: g.descripcion || g.tipo || "Gasto de explotación",
        monto: Number(g.monto || 0),
        referencia: g.gastosDEId,
      })),
      ...gastosCompraDelDia.map((c: GastoCompraConVendor) => ({
        id: c.gastoCompraId,
        hora: c.createdAt.toISOString(),
        horaFormateada: formatearHora(c.createdAt),
        tipo: "compra",
        descripcion: c.descripcion || `Compra a ${c.vendor?.nombre || "proveedor"}`,
        monto: Number(c.total || 0),
        referencia: c.gastoCompraId || "",
      })),
      ...gastosSalariosDia.map((s: PagoSalarioConEmpleado) => ({
        id: s.pgId,
        hora: s.createdAt.toISOString(),
        horaFormateada: formatearHora(s.createdAt),
        tipo: "salario",
        monto: Number(s.salario || 0),
        bonificaciones: s.bonificaciones,
        deducciones: s.deducciones,
        descripcion: `Pago de salario a ${s.empleado?.nombre || "empleado"}`,
        observaciones: s.observaciones,
        horasExtras: s.horasExtras,
        referencia: s.pgId || "",
      })),
    ].sort(
      (a: GastoFormateado, b: GastoFormateado) =>
        new Date(a.hora).getTime() - new Date(b.hora).getTime(),
    )

    const calcularResumenPorMetodoPago = () => {
      const metodos: Record<
        string,
        { cantidad: number; total: number; nombre: string }
      > = {}

      todasLasOperaciones.forEach((op: OperacionFormateada) => {
        const metodo = op.metodoPago || "efectivo"
        if (!metodos[metodo]) {
          metodos[metodo] = { cantidad: 0, total: 0, nombre: op.metodoPago }
        }
        metodos[metodo].cantidad += 1
        metodos[metodo].total += op.total
      })

      const totalGeneral = Object.values(metodos).reduce(
        (sum: number, m: { cantidad: number; total: number; nombre: string }) =>
          sum + m.total,
        0,
      )

      return Object.entries(metodos).map(
        ([key, datos]: [
          string,
          { cantidad: number; total: number; nombre: string },
        ]) => ({
          metodo:
            datos.nombre || key.charAt(0).toUpperCase() + key.slice(1),
          cantidad: datos.cantidad,
          total: datos.total,
          porcentaje: totalGeneral > 0 ? (datos.total / totalGeneral) * 100 : 0,
        }),
      )
    }

    const calcularVentasAyer = async () => {
      const ayer = new Date(fecha)
      ayer.setDate(ayer.getDate() - 1)
      const ayerInicio = new Date(ayer)
      ayerInicio.setHours(0, 0, 0, 0)
      const ayerFin = new Date(ayer)
      ayerFin.setHours(23, 59, 59, 999)

      const [ventasAyer, serviciosAyer] = await Promise.all([
        prisma.venta.findMany({
          where: {
            createdAt: { gte: ayerInicio, lte: ayerFin },
          },
          include: {
            producto: { select: { precioVenta: true } },
          },
        }),
        prisma.ventaServicios.findMany({
          where: {
            createdAt: { gte: ayerInicio, lte: ayerFin },
          },
          select: { total: true },
        }),
      ])

      const ingresosVentas = calcularIngresosVentas(ventasAyer)
      const ingresosServicios = calcularIngresosServicios(serviciosAyer)
      return ingresosVentas + ingresosServicios
    }

    const ingresosAyer = await calcularVentasAyer()

    const calcularVariacionPorcentual = (actual: number, anterior: number) => {
      if (anterior === 0) return actual > 0 ? 100 : 0
      return ((actual - anterior) / anterior) * 100
    }

    const variacionVentas = calcularVariacionPorcentual(totalIngresos, ingresosAyer)

    const resumenMetodosPago = calcularResumenPorMetodoPago()

    const resumenDiario = {
      fecha: formatoFecha(fecha),
      totalVentas,
      totalServicios,
      totalIngresos,
      totalGastosDE,
      totalGastosSalarios,
      totalGastosCompra,
      totalGastos,
      diferencia,
      variacionPorcentual: variacionVentas,
      ingresosAyer,
    }

    return NextResponse.json({
      resumen: resumenDiario,
      ventas: todasLasOperaciones,
      gastos: gastosFormateados,
      resumenMetodosPago,
      totales: {
        efectivoInicial: 0,
        efectivoFinal: 0,
      },
    })
  } catch (error) {
    console.error("Error al obtener cuadre diario:", error)
    return NextResponse.json(
      { error: "Error al obtener cuadre diario" },
      { status: 500 },
    )
  }
}
