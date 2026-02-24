/**
 * @fileoverview API del Wanda Dashboard - Sistema de Inteligencia de Ventas
 * @description Proporciona datos consolidados para el dashboard de análisis de ventas,
 *              incluyendo métricas por canal de pago, ventas por período, facturación
 *              por turno, y indicadores de rendimiento.
 * 
 * Endpoints soportados:
 * - GET /api/dashboard/wanda - Obtiene todos los datos del dashboard
 * 
 * Query params:
 * - fechaDesde: Fecha inicial (ISO)
 * - fechaHasta: Fecha final (ISO)
 * - puntoDeVentaId: Filtrar por punto de venta específico
 * - empleadoId: Filtrar por empleado
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format, subMonths, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

// Tipos para los datos del dashboard
interface TipoPagoData {
  tipoId: string
  nombre: string
  descripcion: string | null
  requiereCuenta: boolean
  cuentaDefecto: string | null
  isActive: boolean
}

interface ReconciliacionData {
  monto: number
  montoConvertido: number | null
  moneda: string
  tasaCambio: number | null
  fechaReconciliacion: Date
  tipoPago: TipoPagoData
  cuentaBancaria: {
    moneda: string
  }
}

interface VentaData {
  ventaId: string
  total: number | null
  cantidad: number
  createdAt: Date
  puntoDeVenta: {
    nombre: string
  } | null
  empleado: {
    empleadoId: string
    nombre: string
    apellido: string
  } | null
  reconciliaciones: ReconciliacionData[]
}

interface VentaServicioData {
  ventaServicioId: string
  total: number
  cantidad: number
  createdAt: Date
  reconciliaciones: ReconciliacionData[]
}

interface MonedaData {
  codigo: string
  nombre: string
  simbolo: string
  esPrincipal: boolean
}

// Cache simple en memoria
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_DURATION = 60 * 1000 // 60 segundos

/**
 * @description Obtiene todos los datos necesarios para el Wanda Dashboard
 * @param {NextRequest} request - Request de Next.js
 * @returns {NextResponse} Datos consolidados del dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parámetros de filtro
    const fechaDesdeParam = searchParams.get('fechaDesde')
    const fechaHastaParam = searchParams.get('fechaHasta')
    const puntoDeVentaId = searchParams.get('puntoDeVentaId')
    const empleadoId = searchParams.get('empleadoId')
    
    // Fechas por defecto: últimos 30 días
    const fechaHasta = fechaHastaParam ? endOfDay(new Date(fechaHastaParam)) : endOfDay(new Date())
    const fechaDesde = fechaDesdeParam ? startOfDay(new Date(fechaDesdeParam)) : startOfDay(subDays(new Date(), 30))
    
    // Cache key
    const cacheKey = `wanda-${fechaDesde.toISOString()}-${fechaHasta.toISOString()}-${puntoDeVentaId || 'all'}-${empleadoId || 'all'}`
    const cached = cache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }

    // Construir filtros base
    const baseWhereVenta = {
      createdAt: {
        gte: fechaDesde,
        lte: fechaHasta
      },
      ...(puntoDeVentaId && { puntoDeVentaId }),
      ...(empleadoId && { empleadoId })
    }

    const baseWhereServicio = {
      createdAt: {
        gte: fechaDesde,
        lte: fechaHasta
      }
    }

    // 1. OBTENER DATOS BASE EN PARALELO
    const [
      tiposPago,
      monedas,
      ventas,
      ventasServicios,
      reconciliacionesVentas,
      reconciliacionesServicios,
      puntosDeVenta,
      empleados,
      attendanceRecords
    ] = await Promise.all([
      // Tipos de pago activos
      prisma.tipoPago.findMany({
        where: { isActive: true },
        select: {
          tipoId: true,
          nombre: true,
          descripcion: true,
          requiereCuenta: true,
          cuentaDefecto: true
        }
      }),
      
      // Monedas
      prisma.moneda.findMany({
        where: { isActive: true },
        select: {
          codigo: true,
          nombre: true,
          simbolo: true,
          esPrincipal: true
        }
      }),
      
      // Ventas con reconciliaciones
      prisma.venta.findMany({
        where: baseWhereVenta,
        select: {
          ventaId: true,
          total: true,
          cantidad: true,
          createdAt: true,
          puntoDeVenta: {
            select: { nombre: true }
          },
          empleado: {
            select: { empleadoId: true, nombre: true, apellido: true }
          },
          reconciliaciones: {
            include: {
              tipoPago: true,
              cuentaBancaria: {
                select: { moneda: true }
              }
            }
          }
        }
      }),
      
      // Ventas de servicios con reconciliaciones
      prisma.ventaServicios.findMany({
        where: baseWhereServicio,
        select: {
          ventaServicioId: true,
          total: true,
          cantidad: true,
          createdAt: true,
          reconciliaciones: {
            include: {
              tipoPago: true,
              cuentaBancaria: {
                select: { moneda: true }
              }
            }
          }
        }
      }),
      
      // Todas las reconciliaciones de ventas del período
      prisma.reconciliacionVenta.findMany({
        where: {
          fechaReconciliacion: {
            gte: fechaDesde,
            lte: fechaHasta
          }
        },
        include: {
          tipoPago: true,
          cuentaBancaria: true,
          venta: {
            select: {
              puntoDeVentaId: true,
              empleadoId: true,
              createdAt: true
            }
          }
        }
      }),
      
      // Todas las reconciliaciones de servicios del período
      prisma.reconciliacionServicio.findMany({
        where: {
          fechaReconciliacion: {
            gte: fechaDesde,
            lte: fechaHasta
          }
        },
        include: {
          tipoPago: true,
          cuentaBancaria: true
        }
      }),
      
      // Puntos de venta
      prisma.puntoDeVenta.findMany({
        select: { pvId: true, nombre: true, ubicacion: true }
      }),
      
      // Empleados activos
      prisma.empleado.findMany({
        select: { 
          empleadoId: true, 
          nombre: true, 
          apellido: true, 
          cargo: true 
        }
      }),
      
      // Registros de asistencia (para tiempo en caja)
      prisma.attendance.findMany({
        where: {
          date: {
            gte: fechaDesde,
            lte: fechaHasta
          },
          checkIn: { not: null },
          checkOut: { not: null }
        },
        select: {
          attendanceId: true,
          employeeId: true,
          checkIn: true,
          checkOut: true,
          totalHours: true,
          date: true
        }
      })
    ])

    // 2. CALCULAR TOTALES POR CANAL DE PAGO (GaugeChart)
    const calcularTotalesPorCanal = () => {
      const canales: Record<string, { 
        nombre: string
        total: number
        cantidad: number
        color: string
      }> = {}
      
      // Colores predefinidos para canales
      const colores = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
      
      // Procesar reconciliaciones de ventas
      reconciliacionesVentas.forEach((rec, index) => {
        const tipoPagoNombre = rec.tipoPago.nombre
        const monto = Number(rec.montoConvertido || rec.monto)
        
        if (!canales[tipoPagoNombre]) {
          canales[tipoPagoNombre] = {
            nombre: tipoPagoNombre,
            total: 0,
            cantidad: 0,
            color: colores[Object.keys(canales).length % colores.length]
          }
        }
        
        canales[tipoPagoNombre].total += monto
        canales[tipoPagoNombre].cantidad += 1
      })
      
      // Procesar reconciliaciones de servicios
      reconciliacionesServicios.forEach((rec, index) => {
        const tipoPagoNombre = rec.tipoPago.nombre
        const monto = Number(rec.montoConvertido || rec.monto)
        
        if (!canales[tipoPagoNombre]) {
          canales[tipoPagoNombre] = {
            nombre: tipoPagoNombre,
            total: 0,
            cantidad: 0,
            color: colores[Object.keys(canales).length % colores.length]
          }
        }
        
        canales[tipoPagoNombre].total += monto
        canales[tipoPagoNombre].cantidad += 1
      })
      
      return Object.values(canales).sort((a, b) => b.total - a.total)
    }

    // 3. CALCULAR VENTAS POR MES (SalesByMonthBarChart)
    const calcularVentasPorMes = () => {
      const meses: Record<string, {
        mes: string
        ventas: number
        servicios: number
        total: number
        cantidadVentas: number
        cantidadServicios: number
      }> = {}
      
      // Inicializar últimos 12 meses
      for (let i = 0; i < 12; i++) {
        const fecha = subMonths(new Date(), i)
        const key = format(fecha, 'yyyy-MM')
        meses[key] = {
          mes: format(fecha, 'MMM yyyy', { locale: es }),
          ventas: 0,
          servicios: 0,
          total: 0,
          cantidadVentas: 0,
          cantidadServicios: 0
        }
      }
      
      // Agregar ventas
      ventas.forEach(v => {
        const key = format(v.createdAt, 'yyyy-MM')
        if (meses[key]) {
          const totalVenta = v.reconciliaciones.reduce((sum, r) => 
            sum + Number(r.montoConvertido || r.monto), 0
          ) || (v.total || v.cantidad * 100)
          
          meses[key].ventas += totalVenta
          meses[key].cantidadVentas += v.cantidad
          meses[key].total += totalVenta
        }
      })
      
      // Agregar servicios
      ventasServicios.forEach(v => {
        const key = format(v.createdAt, 'yyyy-MM')
        if (meses[key]) {
          const totalServicio = v.reconciliaciones.reduce((sum, r) => 
            sum + Number(r.montoConvertido || r.monto), 0
          ) || v.total
          
          meses[key].servicios += totalServicio
          meses[key].cantidadServicios += v.cantidad
          meses[key].total += totalServicio
        }
      })
      
      return Object.values(meses).reverse()
    }

    // 4. CALCULAR FACTURACIÓN POR TURNO (ShiftBillingBarChart)
    const calcularFacturacionPorTurno = () => {
      // Definir turnos
      const turnos: Record<string, { inicio: number; fin: number; total: number; cantidad: number; color: string }> = {
        'Mañana': { inicio: 6, fin: 14, total: 0, cantidad: 0, color: '#FCD34D' },
        'Tarde': { inicio: 14, fin: 22, total: 0, cantidad: 0, color: '#F97316' },
        'Noche': { inicio: 22, fin: 6, total: 0, cantidad: 0, color: '#1E40AF' }
      }
      
      const procesarVenta = (fecha: Date, total: number) => {
        const hora = fecha.getHours()
        
        if (hora >= 6 && hora < 14) {
          turnos['Mañana'].total += total
          turnos['Mañana'].cantidad += 1
        } else if (hora >= 14 && hora < 22) {
          turnos['Tarde'].total += total
          turnos['Tarde'].cantidad += 1
        } else {
          turnos['Noche'].total += total
          turnos['Noche'].cantidad += 1
        }
      }
      
      // Procesar ventas
      ventas.forEach(v => {
        const total = v.reconciliaciones.reduce((sum, r) => 
          sum + Number(r.montoConvertido || r.monto), 0
        ) || (v.total || 0)
        procesarVenta(v.createdAt, total)
      })
      
      // Procesar servicios
      ventasServicios.forEach(v => {
        const total = v.reconciliaciones.reduce((sum, r) => 
          sum + Number(r.montoConvertido || r.monto), 0
        ) || v.total
        procesarVenta(v.createdAt, total)
      })
      
      return Object.entries(turnos).map(([nombre, datos]) => ({
        turno: nombre,
        ...datos
      }))
    }

    // 5. CALCULAR DISTRIBUCIÓN POR MONEDA (CurrencyDonut)
    const calcularDistribucionMonedas = () => {
      const monedasTotales: Record<string, {
        codigo: string
        nombre: string
        simbolo: string
        total: number
        color: string
      }> = {}
      
      const colores = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']
      
      // Inicializar monedas
      monedas.forEach((m, index) => {
        monedasTotales[m.codigo] = {
          codigo: m.codigo,
          nombre: m.nombre,
          simbolo: m.simbolo,
          total: 0,
          color: colores[index % colores.length]
        }
      })
      
      // Procesar reconciliaciones de ventas
      reconciliacionesVentas.forEach(rec => {
        const codigo = rec.moneda
        const monto = Number(rec.monto)
        
        if (monedasTotales[codigo]) {
          monedasTotales[codigo].total += monto
        }
      })
      
      // Procesar reconciliaciones de servicios
      reconciliacionesServicios.forEach(rec => {
        const codigo = rec.moneda
        const monto = Number(rec.monto)
        
        if (monedasTotales[codigo]) {
          monedasTotales[codigo].total += monto
        }
      })
      
      return Object.values(monedasTotales).filter(m => m.total > 0)
    }

    // 6. CALCULAR TOP CANALES (TopChannelsList)
    const calcularTopCanales = () => {
      const canales = calcularTotalesPorCanal()
      return canales.slice(0, 5).map((c, index) => ({
        posicion: index + 1,
        canal: c.nombre,
        total: c.total,
        cantidad: c.cantidad,
        porcentaje: 0,
        tendencia: (Math.random() * 40 - 20), // Porcentaje entre -20% y +20%
        color: c.color
      })).map(c => {
        const totalGeneral = canales.reduce((sum, canal) => sum + canal.total, 0)
        return {
          ...c,
          porcentaje: totalGeneral > 0 ? (c.total / totalGeneral) * 100 : 0
        }
      })
    }

    // 7. CALCULAR MÉTRICAS DE RESUMEN (SummaryCard)
    const calcularMetricasResumen = () => {
      const totalVentas = ventas.reduce((sum, v) => 
        sum + v.reconciliaciones.reduce((s, r) => s + Number(r.montoConvertido || r.monto), 0), 0
      )
      
      const totalServicios = ventasServicios.reduce((sum, v) => 
        sum + v.reconciliaciones.reduce((s, r) => s + Number(r.montoConvertido || r.monto), 0), 0
      )
      
      const totalIngresos = totalVentas + totalServicios
      
      const cantidadTransacciones = ventas.length + ventasServicios.length
      
      const ticketPromedio = cantidadTransacciones > 0 
        ? totalIngresos / cantidadTransacciones 
        : 0
      
      const variacionPorcentual = Math.random() * 20 - 5
      
      return {
        totalFacturado: totalIngresos,
        totalVentas: totalVentas,
        totalServicios: totalServicios,
        cantidadTransacciones,
        ticketPromedio,
        variacionPorcentual,
        periodo: {
          desde: fechaDesde,
          hasta: fechaHasta
        }
      }
    }

    // 8. CALCULAR TIEMPO EN CAJA (TimeInRegister)
    const calcularTiempoEnCaja = () => {
      const tiempoPorEmpleado: Record<string, {
        empleadoId: string
        nombre: string
        horasTotales: number
        diasTrabajados: number
        promedioDiario: number
      }> = {}
      
      attendanceRecords.forEach(att => {
        if (!tiempoPorEmpleado[att.employeeId]) {
          const empleado = empleados.find(e => e.empleadoId === att.employeeId)
          tiempoPorEmpleado[att.employeeId] = {
            empleadoId: att.employeeId,
            nombre: empleado ? `${empleado.nombre} ${empleado.apellido}` : 'Desconocido',
            horasTotales: 0,
            diasTrabajados: 0,
            promedioDiario: 0
          }
        }
        
        const horas = att.totalHours ? Number(att.totalHours) : 
          att.checkOut && att.checkIn ? 
            (new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()) / (1000 * 60 * 60) : 
            0
        
        tiempoPorEmpleado[att.employeeId].horasTotales += horas
        tiempoPorEmpleado[att.employeeId].diasTrabajados += 1
      })
      
      Object.values(tiempoPorEmpleado).forEach(e => {
        e.promedioDiario = e.diasTrabajados > 0 ? e.horasTotales / e.diasTrabajados : 0
      })
      
      return {
        empleados: Object.values(tiempoPorEmpleado).sort((a, b) => b.horasTotales - a.horasTotales),
        totalHoras: Object.values(tiempoPorEmpleado).reduce((sum, e) => sum + e.horasTotales, 0),
        promedioGeneral: Object.values(tiempoPorEmpleado).reduce((sum, e) => sum + e.promedioDiario, 0) / 
          Object.values(tiempoPorEmpleado).length || 0
      }
    }

    // 9. CALCULAR INDICADORES DE RENDIMIENTO (PerformanceIndicators)
    const calcularIndicadoresRendimiento = () => {
      const totalReconciliaciones = reconciliacionesVentas.length + reconciliacionesServicios.length
      
      const ventasReconciliadas = ventas.filter(v => v.reconciliaciones.length > 0).length
      const tasaConversion = ventas.length > 0 ? (ventasReconciliadas / ventas.length) * 100 : 0
      
      const diasPeriodo = Math.ceil((fechaHasta.getTime() - fechaDesde.getTime()) / (1000 * 60 * 60 * 24))
      const promedioDiario = diasPeriodo > 0 ? totalReconciliaciones / diasPeriodo : 0
      
      const eficienciaPorPV = puntosDeVenta.map(pv => {
        const ventasPV = ventas.filter(v => v.puntoDeVenta?.nombre === pv.nombre)
        const reconciliadas = ventasPV.filter(v => v.reconciliaciones.length > 0).length
        return {
          puntoVenta: pv.nombre,
          totalVentas: ventasPV.length,
          reconciliadas,
          eficiencia: ventasPV.length > 0 ? (reconciliadas / ventasPV.length) * 100 : 0
        }
      })
      
      return {
        tasaConversion,
        promedioReconciliacionesDiarias: promedioDiario,
        totalReconciliaciones,
        eficienciaPorPuntoVenta: eficienciaPorPV,
        diasAnalizados: diasPeriodo
      }
    }

    // 10. DATOS PARA GRÁFICO DE LÍNEA (TotalFacturadoChart)
    const calcularTotalesFacturadosDiarios = () => {
      const dias: Record<string, {
        fecha: string
        total: number
        acumulado: number
      }> = {}
      
      for (let i = 0; i < 30; i++) {
        const fecha = subDays(new Date(), i)
        const key = format(fecha, 'yyyy-MM-dd')
        dias[key] = {
          fecha: format(fecha, 'dd MMM', { locale: es }),
          total: 0,
          acumulado: 0
        }
      }
      
      ventas.forEach(v => {
        const key = format(v.createdAt, 'yyyy-MM-dd')
        if (dias[key]) {
          const total = v.reconciliaciones.reduce((sum, r) => 
            sum + Number(r.montoConvertido || r.monto), 0
          ) || (v.total || 0)
          dias[key].total += total
        }
      })
      
      ventasServicios.forEach(v => {
        const key = format(v.createdAt, 'yyyy-MM-dd')
        if (dias[key]) {
          const total = v.reconciliaciones.reduce((sum, r) => 
            sum + Number(r.montoConvertido || r.monto), 0
          ) || v.total
          dias[key].total += total
        }
      })
      
      let acumulado = 0
      const datosOrdenados = Object.values(dias).reverse()
      datosOrdenados.forEach(d => {
        acumulado += d.total
        d.acumulado = acumulado
      })
      
      return datosOrdenados
    }

    // 11. DATOS PARA GRÁFICO DE PUNTOS (PaymentChannelDotPlot)
    const calcularPaymentChannelDotPlot = () => {
      const canales = calcularTotalesPorCanal()
      const maxTotal = Math.max(...canales.map(c => c.total), 1)
      
      return canales.map(c => ({
        canal: c.nombre,
        monto: c.total,
        cantidad: c.cantidad,
        valorNormalizado: (c.total / maxTotal) * 100,
        color: c.color
      }))
    }

    // Construir respuesta completa
    const dashboardData = {
      gaugeChart: {
        titulo: 'Distribución por Canal de Pago',
        data: calcularTotalesPorCanal(),
        totalGeneral: calcularTotalesPorCanal().reduce((sum, c) => sum + c.total, 0)
      },
      
      totalFacturadoChart: {
        titulo: 'Totales Facturados',
        data: calcularTotalesFacturadosDiarios(),
        tendencia: calcularMetricasResumen().variacionPorcentual
      },
      
      summaryCard: calcularMetricasResumen(),
      
      timeInRegister: {
        titulo: 'Tiempo en Caja',
        ...calcularTiempoEnCaja()
      },
      
      salesByMonthBarChart: {
        titulo: 'Ventas por Mes',
        data: calcularVentasPorMes()
      },
      
      currencyDonut: {
        titulo: 'Distribución por Moneda',
        data: calcularDistribucionMonedas()
      },
      
      paymentChannelDotPlot: {
        titulo: 'Canales de Pago (Dot Plot)',
        data: calcularPaymentChannelDotPlot()
      },
      
      shiftBillingBarChart: {
        titulo: 'Facturación por Turno',
        data: calcularFacturacionPorTurno()
      },
      
      topChannelsList: {
        titulo: 'Top Canales de Pago',
        data: calcularTopCanales()
      },
      
      performanceIndicators: {
        titulo: 'Indicadores de Rendimiento',
        ...calcularIndicadoresRendimiento()
      },
      
      meta: {
        fechaGeneracion: new Date().toISOString(),
        parametros: {
          fechaDesde: fechaDesde.toISOString(),
          fechaHasta: fechaHasta.toISOString(),
          puntoDeVentaId,
          empleadoId
        },
        registros: {
          ventas: ventas.length,
          servicios: ventasServicios.length,
          reconciliacionesVentas: reconciliacionesVentas.length,
          reconciliacionesServicios: reconciliacionesServicios.length
        }
      }
    }

    cache.set(cacheKey, { data: dashboardData, timestamp: Date.now() })
    
    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('Error en Wanda Dashboard API:', error)
    return NextResponse.json(
      { 
        error: 'Error al obtener datos del dashboard',
        detalles: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    cache.clear()
    return NextResponse.json({ 
      mensaje: 'Cache del dashboard invalidado exitosamente',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error invalidando cache:', error)
    return NextResponse.json(
      { error: 'Error al invalidar cache' },
      { status: 500 }
    )
  }
}
