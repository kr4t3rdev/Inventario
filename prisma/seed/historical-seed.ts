import { PrismaClient } from '../../src/generated/prisma'

const prisma = new PrismaClient()

export async function seedHistoricalData() {
  console.log('🌱 Seeding historical data from 2 years ago...')

  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  // Crear categorías históricas
  const categorias = [
    { catId: "cat_hist_1", nombre: "Electrónica Histórica", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { catId: "cat_hist_2", nombre: "Oficina Histórica", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { catId: "cat_hist_3", nombre: "Mercado Histórico", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { catId: "cat_hist_4", nombre: "Carnicería Histórica", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { catId: "cat_hist_5", nombre: "Higiene Histórica", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
  ]

  for (const categoria of categorias) {
    await prisma.categoria.upsert({
      where: { catId: categoria.catId },
      update: {},
      create: { ...categoria, tenantId: 'historical-tenant' }
    })
  }

  // Crear unidades históricas
  const unidades = [
    { unidadId: "unid_hist_1", nombre: "Unidad Histórica", simbolo: "u", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { unidadId: "unid_hist_2", nombre: "libras Históricas", simbolo: "lb", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { unidadId: "unid_hist_3", nombre: "cajas de cervezas Históricas", simbolo: "c/24", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
  ]

  for (const unidad of unidades) {
    await prisma.unidad.upsert({
      where: { unidadId: unidad.unidadId },
      update: {},
      create: { ...unidad, tenantId: 'historical-tenant' }
    })
  }

  // Crear vendors históricos
  const vendors = [
    { vendorId: "vend_hist_1", nombre: "HP Histórico", contacto: "hp@correo.com", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { vendorId: "vend_hist_2", nombre: "TRD Histórico", contacto: "trd@correo.com", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { vendorId: "vend_hist_3", nombre: "Mariel Histórico", contacto: "mariel@correo.com", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
  ]

  for (const vendor of vendors) {
    await prisma.vendor.upsert({
      where: { vendorId: vendor.vendorId },
      update: {},
      create: { ...vendor, tenantId: 'historical-tenant' }
    })
  }

  // Crear almacenes históricos
  const almacenes = [
    { almacenId: "alm_hist_1", nombre: "Central Histórico", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { almacenId: "alm_hist_2", nombre: "Sur Histórico", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
  ]

  for (const almacen of almacenes) {
    await prisma.almacen.upsert({
      where: { almacenId: almacen.almacenId },
      update: {},
      create: { ...almacen, tenantId: 'historical-tenant' }
    })
  }

  // Crear puntos de venta históricos
  const puntosDeVenta = [
    { pvId: "pv_hist_1", nombre: "Tienda Centro Histórico", ubicacion: "Centro", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { pvId: "pv_hist_2", nombre: "Tienda Sur Histórico", ubicacion: "Sur", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
    { pvId: "pv_hist_3", nombre: "Tienda Norte Histórico", ubicacion: "Norte", createdAt: twoYearsAgo, updatedAt: twoYearsAgo },
  ]

  for (const pv of puntosDeVenta) {
    await prisma.puntoDeVenta.upsert({
      where: { pvId: pv.pvId },
      update: {},
      create: { ...pv, tenantId: 'historical-tenant' }
    })
  }

  // Crear productos históricos
  const productos = [
    {
      id: "prod_hist_1",
      nombre: "Laptop HP Histórica",
      descripcion: "Laptop HP Pavilion Histórica",
      precioCosto: 700,
      precioVenta: 1000,
      stock: 15,
      categoriaId: "cat_hist_1",
      unidadId: "unid_hist_1",
      vendorId: "vend_hist_1",
      almacenId: "alm_hist_1",
      puntoDeVentaId: "pv_hist_1",
      createdAt: twoYearsAgo,
      updatedAt: twoYearsAgo,
    },
    {
      id: "prod_hist_2",
      nombre: "Carne de Res Histórica",
      descripcion: "Carne de res fresca histórica",
      precioCosto: 50,
      precioVenta: 80,
      stock: 20,
      categoriaId: "cat_hist_4",
      unidadId: "unid_hist_2",
      vendorId: "vend_hist_2",
      almacenId: "alm_hist_2",
      puntoDeVentaId: "pv_hist_2",
      createdAt: twoYearsAgo,
      updatedAt: twoYearsAgo,
    },
    {
      id: "prod_hist_3",
      nombre: "Cerveza Histórica",
      descripcion: "Caja de cervezas históricas",
      precioCosto: 25,
      precioVenta: 35,
      stock: 50,
      categoriaId: "cat_hist_3",
      unidadId: "unid_hist_3",
      vendorId: "vend_hist_3",
      almacenId: "alm_hist_1",
      puntoDeVentaId: "pv_hist_3",
      createdAt: twoYearsAgo,
      updatedAt: twoYearsAgo,
    },
  ]

  for (const producto of productos) {
    await prisma.producto.upsert({
      where: { id: producto.id },
      update: {},
      create: { ...producto, tenantId: 'historical-tenant' }
    })
  }

  // Crear empleados históricos
  const empleados = [
    {
      empleadoId: "emp_hist_1",
      nombre: "Juan Histórico",
      apellido: "Pérez",
      telefono: "555-1234",
      cargo: "Vendedor",
      salarioBases: 40000,
      fechaContratacion: twoYearsAgo,
      esTiempoCompleto: true,
      diasVacacionesAnuales: 15,
      createdAt: twoYearsAgo,
      updatedAt: twoYearsAgo,
    },
    {
      empleadoId: "emp_hist_2",
      nombre: "María Histórica",
      apellido: "González",
      telefono: "555-5678",
      cargo: "Cajera",
      salarioBases: 35000,
      fechaContratacion: twoYearsAgo,
      esTiempoCompleto: true,
      diasVacacionesAnuales: 15,
      createdAt: twoYearsAgo,
      updatedAt: twoYearsAgo,
    },
  ]

  for (const empleado of empleados) {
    await prisma.empleado.upsert({
      where: { empleadoId: empleado.empleadoId },
      update: {},
      create: { ...empleado, tenantId: 'historical-tenant' }
    })
  }

  // Crear ventas históricas (varias por mes durante 2 años)
  const ventas = []
  const startDate = new Date(twoYearsAgo)

  for (let i = 0; i < 24; i++) { // 24 meses
    const monthDate = new Date(startDate)
    monthDate.setMonth(startDate.getMonth() + i)

    // Crear varias ventas por mes
    for (let j = 1; j <= 10; j++) {
      const ventaDate = new Date(monthDate)
      ventaDate.setDate(Math.floor(Math.random() * 28) + 1) // Día aleatorio del mes

      ventas.push({
        ventaId: `v_hist_${i}_${j}`,
        productoId: productos[Math.floor(Math.random() * productos.length)].id,
        cantidad: Math.floor(Math.random() * 5) + 1,
        total: Math.floor(Math.random() * 500) + 100,
        descuento: Math.floor(Math.random() * 50),
        puntoDeVentaId: puntosDeVenta[Math.floor(Math.random() * puntosDeVenta.length)].pvId,
        empleadoId: empleados[Math.floor(Math.random() * empleados.length)].empleadoId,
        createdAt: ventaDate,
        updatedAt: ventaDate,
      })
    }
  }

  for (const venta of ventas) {
    await prisma.venta.upsert({
      where: { ventaId: venta.ventaId },
      update: {},
      create: { ...venta, tenantId: 'historical-tenant' }
    })
  }

  // Crear gastos de compra históricos
  const gastosCompra = []
  for (let i = 0; i < 24; i++) {
    const monthDate = new Date(startDate)
    monthDate.setMonth(startDate.getMonth() + i)

    for (let j = 1; j <= 5; j++) {
      const gastoDate = new Date(monthDate)
      gastoDate.setDate(Math.floor(Math.random() * 28) + 1)

      gastosCompra.push({
        gastoCompraId: `gc_hist_${i}_${j}`,
        productoId: productos[Math.floor(Math.random() * productos.length)].id,
        vendorId: vendors[Math.floor(Math.random() * vendors.length)].vendorId,
        cantidad: Math.floor(Math.random() * 10) + 1,
        precioUnitario: Math.floor(Math.random() * 100) + 50,
        total: Math.floor(Math.random() * 1000) + 200,
        fechaCompra: gastoDate,
        descripcion: `Compra histórica ${i}-${j}`,
        createdAt: gastoDate,
        updatedAt: gastoDate,
      })
    }
  }

  for (const gasto of gastosCompra) {
    await prisma.gastoCompra.upsert({
      where: { gastoCompraId: gasto.gastoCompraId },
      update: {},
      create: { ...gasto, tenantId: 'historical-tenant' }
    })
  }

  // Crear gastos DE históricos
  const gastosDE = []
  const tiposGasto = ["electricidad", "agua", "gas", "internet", "telefono", "alquiler", "limpieza", "seguridad"]

  for (let i = 0; i < 24; i++) {
    const monthDate = new Date(startDate)
    monthDate.setMonth(startDate.getMonth() + i)
    const periodo = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`

    for (let j = 0; j < tiposGasto.length; j++) {
      gastosDE.push({
        gastosDEId: `gde_hist_${i}_${j}`,
        tipo: tiposGasto[j],
        proveedor: `Proveedor ${tiposGasto[j]} Histórico`,
        monto: Math.floor(Math.random() * 5000) + 1000,
        periodo: periodo,
        descripcion: `Gasto ${tiposGasto[j]} histórico`,
        isPagado: Math.random() > 0.3 ? "sí" : "no",
        createdAt: monthDate,
        updatedAt: monthDate,
      })
    }
  }

  for (const gasto of gastosDE) {
    await prisma.gastosDE.upsert({
      where: { gastosDEId: gasto.gastosDEId },
      update: {},
      create: { ...gasto, tenantId: 'historical-tenant' }
    })
  }

  // Crear pagos de salario históricos
  const pagosSalario = []
  for (let i = 0; i < 24; i++) {
    const monthDate = new Date(startDate)
    monthDate.setMonth(startDate.getMonth() + i)
    const periodo = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`

    for (const empleado of empleados) {
      pagosSalario.push({
        pgId: `pg_hist_${i}_${empleado.empleadoId}`,
        empleadoId: empleado.empleadoId,
        salario: empleado.salarioBases,
        bonificaciones: Math.floor(Math.random() * 5000),
        deducciones: Math.floor(Math.random() * 2000),
        horasExtras: Math.floor(Math.random() * 20),
        observaciones: `Pago histórico ${periodo}`,
        periodo: periodo,
        createdAt: monthDate,
        updatedAt: monthDate,
      })
    }
  }

  for (const pago of pagosSalario) {
    await prisma.pagosalario.upsert({
      where: { pgId: pago.pgId },
      update: {},
      create: { ...pago, tenantId: 'historical-tenant' }
    })
  }

  // Crear mermas históricas
  const mermas = []
  for (let i = 0; i < 24; i++) {
    const monthDate = new Date(startDate)
    monthDate.setMonth(startDate.getMonth() + i)

    for (let j = 1; j <= 3; j++) {
      const mermaDate = new Date(monthDate)
      mermaDate.setDate(Math.floor(Math.random() * 28) + 1)

      mermas.push({
        mermaId: `m_hist_${i}_${j}`,
        productoId: productos[Math.floor(Math.random() * productos.length)].id,
        cantidad: Math.floor(Math.random() * 5) + 1,
        motivo: ["Defecto", "Vencimiento", "Robo", "Daño"][Math.floor(Math.random() * 4)],
        costoTotal: Math.floor(Math.random() * 500) + 50,
        createdAt: mermaDate,
        updatedAt: mermaDate,
      })
    }
  }

  for (const merma of mermas) {
    await prisma.merma.upsert({
      where: { mermaId: merma.mermaId },
      update: {},
      create: { ...merma, tenantId: 'historical-tenant' }
    })
  }

  // Crear transferencias históricas
  const transferencias = []
  for (let i = 0; i < 24; i++) {
    const monthDate = new Date(startDate)
    monthDate.setMonth(startDate.getMonth() + i)

    for (let j = 1; j <= 5; j++) {
      const transDate = new Date(monthDate)
      transDate.setDate(Math.floor(Math.random() * 28) + 1)

      transferencias.push({
        transferenciaId: `t_hist_${i}_${j}`,
        productoId: productos[Math.floor(Math.random() * productos.length)].id,
        cantidad: Math.floor(Math.random() * 10) + 1,
        descripcion: `Transferencia histórica ${i}-${j}`,
        origenId: almacenes[Math.floor(Math.random() * almacenes.length)].almacenId,
        destinoId: almacenes[Math.floor(Math.random() * almacenes.length)].almacenId,
        puntoDeVentaOrigenId: puntosDeVenta[Math.floor(Math.random() * puntosDeVenta.length)].pvId,
        puntoDeVentaDestinoId: puntosDeVenta[Math.floor(Math.random() * puntosDeVenta.length)].pvId,
        createdAt: transDate,
        updatedAt: transDate,
      })
    }
  }

  for (const transferencia of transferencias) {
    await prisma.transferencia.upsert({
      where: { transferenciaId: transferencia.transferenciaId },
      update: {},
      create: { ...transferencia, tenantId: 'historical-tenant' }
    })
  }

  console.log('✅ Historical data seeded successfully')
}

if (require.main === module) {
  seedHistoricalData()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}