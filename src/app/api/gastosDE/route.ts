import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get("periodo")
    //const tipo = searchParams.get("tipo")

    const whereClause: any = {}
    if (periodo) {
      whereClause.periodo = periodo
    }    

    const gastosUtilitarios = await prisma.gastosDE.findMany({
      where: whereClause,
      orderBy: { monto: "desc" },
    })

    return NextResponse.json(gastosUtilitarios)
  } catch (error) {
    console.error("Error al obtener Gasto Derivados Empresa:", error)
    return NextResponse.json({ error: "Error al obtener Gasto Derivados Empresa" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const periodo = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    const gastoServicio = await prisma.gastosDE.create({
      data: {
        gastosDEId: data.gastosDEId, // Fixed: use correct field name
        tipo: data.tipo,
        proveedor: data.proveedor,
        monto: data.monto,
        periodo: periodo,
        numeroFactura: data.numeroFactura || null, // Added: invoice number (optional)
        descripcion: data.descripcion,
        // Prisma handles createdAt/updatedAt automatically via @default(now()) in schema
      },
    })

    return NextResponse.json(gastoServicio)
  } catch (error) {
    console.error("Error al crear el Gasto Derivados Empresa:", error)
    return NextResponse.json({ error: "Error al crear el Gasto Derivados Empresa" }, { status: 500 })
  }
}
