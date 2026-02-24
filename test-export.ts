import prisma from './src/lib/prisma'

async function main() {
  const factura = await prisma.factura.findFirst({
    include: {
      serie: true,
      venta: {
        include: {
          cliente: true,
          puntoDeVenta: true,
          producto: true,
          oferta: {
            include: {
              items: {
                include: {
                  producto: true,
                  servicio: true,
                }
              }
            }
          }
        }
      }
    }
  })
  
  if (factura) {
    console.log('Factura ID:', factura.idFactura)
    console.log('Número:', factura.numeroFactura)
    console.log('Cliente:', factura.venta?.cliente?.nombre)
    console.log('Total:', factura.total)
  } else {
    console.log('No hay facturas en la base de datos')
    const venta = await prisma.venta.findFirst({
      include: {
        cliente: true,
        producto: true,
        oferta: true
      }
    })
    if (venta) {
      console.log('Venta ID:', venta.ventaId)
      console.log('Cliente:', venta.cliente?.nombre)
      console.log('Total:', venta.total)
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})