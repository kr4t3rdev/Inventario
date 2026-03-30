import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getNextVendorCode,
  generateVendorEan13,
  initializeVendorCodeSequence,
} from "@/lib/vendor-code-utils"

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
      vendors.map((vendor) => {
        const vendorCode = vendor.vendorCode
        const ean13Code = vendorCode ? generateVendorEan13(vendorCode) : null

        return {
          ...vendor,
          vendorCode,
          ean13Code,
          proveedorCodigo: vendorCode || deriveProveedorCodigo(vendor.productos),
        }
      })
    )
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return NextResponse.json({ error: 'Error al obtener vendors' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, direccion, telefono, contacto, cuentaCUP, cuentaUSD, logo, contrato, vendorCode } = body

    // Bloquear intentos de pasar vendorCode manualmente
    if (vendorCode) {
      return NextResponse.json(
        { error: 'El código del proveedor se asigna automáticamente' },
        { status: 400 }
      )
    }

    // Inicializar secuencia si no existe
    await initializeVendorCodeSequence(prisma)

    // Obtener siguiente código atomicamente
    const assignedVendorCode = await getNextVendorCode(prisma)

    // Crear vendor con código asignado
    const vendor = await prisma.vendor.create({
      data: {
        nombre,
        vendorCode: assignedVendorCode,
        direccion,
        telefono,
        contacto,
        cuentaCUP,
        cuentaUSD,
        logo,
        contrato,
      },
    })

    const ean13Code = generateVendorEan13(vendor.vendorCode!)

    return NextResponse.json(
      {
        ...vendor,
        ean13Code,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('Límite')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    console.error('Error creating vendor:', error)
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 })
  }
}

