import { PrismaClient } from '../src/generated/prisma'
import { calculateEan13CheckDigit } from '../src/lib/ean13-utils'

const prisma = new PrismaClient()

/**
 * @description Intenta extraer segmentos desde un código EAN13 ya existente.
 */
function splitFromEan13(codigo: string) {
  if (!/^\d{13}$/.test(codigo)) return null
  const base12 = codigo.slice(0, 12)
  const dc = codigo.slice(12)
  const calculated = calculateEan13CheckDigit(base12)
  if (dc !== calculated) return null

  return {
    proveedorCodigo: base12.slice(0, 2),
    idSeccionCodigo: base12.slice(2, 4),
    especificoCodigo: base12.slice(4, 8),
    surtidoCodigo: base12.slice(8, 12),
    dcCodigo: dc,
    codigoNegocio: codigo,
  }
}

async function main() {
  const productos = await prisma.producto.findMany({
    select: {
      id: true,
      codigoNegocio: true,
      proveedorCodigo: true,
      idSeccionCodigo: true,
      especificoCodigo: true,
      surtidoCodigo: true,
      dcCodigo: true,
    },
  })

  const pendientes: string[] = []
  let updated = 0

  for (const p of productos) {
    if (p.proveedorCodigo && p.idSeccionCodigo && p.especificoCodigo && p.surtidoCodigo && p.dcCodigo) {
      continue
    }

    if (!p.codigoNegocio) {
      pendientes.push(p.id)
      continue
    }

    const extracted = splitFromEan13(p.codigoNegocio)
    if (!extracted) {
      pendientes.push(p.id)
      continue
    }

    await prisma.producto.update({
      where: { id: p.id },
      data: extracted,
    })
    updated += 1
  }

  console.log(JSON.stringify({ total: productos.length, updated, pendientes: pendientes.length, pendientesIds: pendientes }, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
