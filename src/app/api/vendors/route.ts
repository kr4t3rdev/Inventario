import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";

/**
 * @description Deriva el código de proveedor desde los productos ya asociados al vendor.
 * @param {Array<{ proveedorCodigo?: string | null }>} productos - Productos históricos del vendor.
 * @returns {string | null} Código consistente o null si no existe todavía.
 */
function deriveProveedorCodigo(productos: Array<{ proveedorCodigo?: string | null }>): string | null {
  const codigos = Array.from(
    new Set(
      productos
        .map((producto) => producto.proveedorCodigo?.trim())
        .filter((codigo): codigo is string => Boolean(codigo))
    )
  )

  if (codigos.length !== 1) {
    return null
  }

  return codigos[0]
}

export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        productos: {
          select: {
            id: true,
            nombre: true,
            proveedorCodigo: true,
          },
        },
        contratos: true,
      },
    })

    return NextResponse.json(
      vendors.map((vendor) => ({
        ...vendor,
        proveedorCodigo: deriveProveedorCodigo(vendor.productos),
      }))
    )
  } catch (error) {
    console.log(error)
    return NextResponse.json({ error: 'Error al obtener vendors' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, direccion, telefono, contacto, cuentaCUP, cuentaUSD, logo, contrato } = body
    const vendor = await prisma.vendor.create({
      data: {
        nombre,
        direccion,
        telefono,
        contacto,
        cuentaCUP,
        cuentaUSD,
        logo,
        contrato,
      },
    })
    return NextResponse.json(vendor)
  } catch (error) {
    console.log(error)
    return NextResponse.json({ error: 'Error al crear vendors' }, { status: 500 })
  }
}
