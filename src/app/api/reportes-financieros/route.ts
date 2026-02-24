import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  try {
     const { searchParams } = new URL(request.url)
     const periodo = searchParams.get("periodo") || undefined
     const tipo = searchParams.get("tipo") || "mensual"

    

    // Verificar si ya existe el reporte
    // Note: ReporteFinanciero model may not exist in the schema, commenting out this logic
    // let reporte = await prisma.reporteFinanciero.findFirst({
    //   where: { },
    // })
    let reporte = null

    if (!reporte) {
      // Generar nuevo reporte
      reporte = await generarReporteFinanciero(periodo ?? '', tipo)
    }

    return NextResponse.json(reporte)
   } catch (error) {
     console.error("Error al obtener reporte financiero:", error)
     return NextResponse.json({ error: "Error al obtener reporte financiero" }, { status: 500 })
   }
})

async function generarReporteFinanciero(periodo: string, tipo: string) {
  const [year, month] = periodo.split("-")
  const startDate = new Date(Number.parseInt(year), Number.parseInt(month) - 1, 1)
  const endDate = new Date(Number.parseInt(year), Number.parseInt(month), 0)
  const productoId = "all" // Para incluir todos los productos en el reporte

  // Calcular ingresos por ventas
  const ventasData = await prisma.venta.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },    
    select: {
      cantidad: true,            
      producto:{
        select: {
          id: true,
          nombre: true,
          precioVenta: true,
          precioCosto: true, // Asegúrate de que este campo exista en tu modelo Producto
        },
      }
    },
    
  })  

  // Calcular gastos por compras
  const comprasData = await prisma.gastoCompra.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      total: true,
    }
  })

  // Calcular gastos por salarios
  const salariosData = await prisma.empleado.findMany({
    where: { 
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
     },
    select: {
      empleadoId: true,
      nombre: true,
      apellido: true,
      salarioBases: true,
    },
  })

  // Calcular gastos servicios
  const ServiciosData = await prisma.gastosDE.findMany({
    where: { 
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
     },
    select: {
      monto: true,
    },
  })

  // Calcular gastos por mermas
  const mermasData = await prisma.merma.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select:{
      cantidad:true,
      costoTotal: true
    }
  })

  const ingresosVentas = ventasData.reduce((acc: number, ventas: any) => acc + (ventas?.producto?.precioVenta ?? 0) * ventas.cantidad, 0) 
  const gastosCompras = comprasData.reduce((acc: number, productos: { total: number }) => acc + productos.total, 0) 
  const gastosSalarios = salariosData.reduce((acc: number, empleado: { salarioBases: number }) => acc + empleado.salarioBases, 0) 
  const gastosServicios = ServiciosData.reduce((acc: number, servicio: { monto: number }) => acc + servicio.monto, 0) 
  const gastosMermas = mermasData.reduce((acc: number, merma: { costoTotal: number | null; cantidad: number }) => acc + (merma.costoTotal ?? 0) * merma.cantidad, 0)

  const totalIngresos = ingresosVentas
  const totalGastos = gastosCompras + gastosSalarios + gastosServicios + gastosMermas
  const utilidadBruta = ingresosVentas - gastosCompras
  const utilidadNeta = totalIngresos - totalGastos
  const margenUtilidad = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0

  // Since ReporteFinanciero model doesn't exist, return the calculated data directly
  const reporte = {
    periodo,
    tipoReporte: tipo,
    ingresosVentas,
    cantidadVentas: ventasData.length,
    gastosCompras,
    gastosSalarios,
    gastosServicios,
    gastosMermas,
    totalIngresos,
    totalGastos,
    utilidadBruta,
    utilidadNeta,
    margenUtilidad,
  }


  return reporte
}

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const { periodo, tipo } = await request.json()

    const reporte = await generarReporteFinanciero(periodo, tipo)
    return NextResponse.json(reporte)
  } catch (error) {
    console.error("Error al generar reporte financiero:", error)
    return NextResponse.json({ error: "Error al generar reporte financiero" }, { status: 500 })
  }
})
