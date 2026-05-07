import { PrismaClient } from '../../src/generated/prisma'
import { seedImplementationData } from './implementation-seed'

const prisma = new PrismaClient()

/**
 * @description Retorna un objeto con fechas utilitarias para escenarios QA.
 * @returns {{hoy: Date, vencida: Date, proxima: Date}} Fechas para cuentas vencidas y proximas
 */
function buildQaDates(): { hoy: Date; vencida: Date; proxima: Date } {
  const hoy = new Date()
  const vencida = new Date(hoy)
  const proxima = new Date(hoy)

  vencida.setDate(hoy.getDate() - 20)
  proxima.setDate(hoy.getDate() + 15)

  return { hoy, vencida, proxima }
}

/**
 * @description Crea productos QA con stock critico, quiebre y margen negativo.
 * @returns {Promise<void>} Promesa resuelta al crear escenarios de inventario
 */
async function seedQaProductos(): Promise<void> {
  const productosQa = [
    {
      id: 'prod_qa_stock_critico',
      nombre: 'QA Stock Critico',
      descripcion: 'Producto para validar alertas de stock critico',
      precioCosto: 120,
      precioVenta: 180,
      stock: 3,
      stockMinimo: 15,
      categoriaId: 'cat_impl_hogar',
      subcategoriaId: 'cat_impl_limpieza',
      unidadId: 'und_impl_unidad',
      vendorId: 'vendor_impl_002',
      almacenId: 'alm_impl_secundario',
      puntoDeVentaId: 'pv_impl_centro'
    },
    {
      id: 'prod_qa_sin_stock',
      nombre: 'QA Sin Stock',
      descripcion: 'Producto agotado para escenarios de quiebre de inventario',
      precioCosto: 340,
      precioVenta: 470,
      stock: 0,
      stockMinimo: 12,
      categoriaId: 'cat_impl_alimentos',
      subcategoriaId: 'cat_impl_bebidas',
      unidadId: 'und_impl_litro',
      vendorId: 'vendor_impl_001',
      almacenId: 'alm_impl_central',
      puntoDeVentaId: 'pv_impl_oeste'
    },
    {
      id: 'prod_qa_margen_negativo',
      nombre: 'QA Margen Negativo',
      descripcion: 'Producto para validar deteccion de precios por debajo del costo',
      precioCosto: 500,
      precioVenta: 450,
      stock: 22,
      stockMinimo: 8,
      categoriaId: 'cat_impl_tecnologia',
      unidadId: 'und_impl_unidad',
      vendorId: 'vendor_impl_003',
      almacenId: 'alm_impl_central',
      puntoDeVentaId: 'pv_impl_centro'
    }
  ]

  for (const producto of productosQa) {
    await prisma.producto.upsert({
      where: { id: producto.id },
      update: {
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        precioCosto: producto.precioCosto,
        precioVenta: producto.precioVenta,
        stock: producto.stock,
        stockMinimo: producto.stockMinimo,
        categoriaId: producto.categoriaId,
        subcategoriaId: producto.subcategoriaId,
        unidadId: producto.unidadId,
        vendorId: producto.vendorId,
        almacenId: producto.almacenId,
        puntoDeVentaId: producto.puntoDeVentaId
      },
      create: { ...producto, tenantId: 'demo-tenant' }
    })
  }

  const preciosQa = [
    {
      id: 'pp_qa_minorista_stock_critico',
      listaPrecioId: 'lp_impl_minorista',
      productoId: 'prod_qa_stock_critico',
      precio: 175
    },
    {
      id: 'pp_qa_mayorista_stock_critico',
      listaPrecioId: 'lp_impl_mayorista',
      productoId: 'prod_qa_stock_critico',
      precio: 160
    },
    {
      id: 'pp_qa_minorista_sin_stock',
      listaPrecioId: 'lp_impl_minorista',
      productoId: 'prod_qa_sin_stock',
      precio: 480
    },
    {
      id: 'pp_qa_mayorista_sin_stock',
      listaPrecioId: 'lp_impl_mayorista',
      productoId: 'prod_qa_sin_stock',
      precio: 510
    },
    {
      id: 'pp_qa_minorista_margen_negativo',
      listaPrecioId: 'lp_impl_minorista',
      productoId: 'prod_qa_margen_negativo',
      precio: 440
    },
    {
      id: 'pp_qa_mayorista_margen_negativo',
      listaPrecioId: 'lp_impl_mayorista',
      productoId: 'prod_qa_margen_negativo',
      precio: 430
    }
  ]

  for (const precio of preciosQa) {
    await prisma.precioProducto.upsert({
      where: { id: precio.id },
      update: {
        listaPrecioId: precio.listaPrecioId,
        productoId: precio.productoId,
        precio: precio.precio
      },
      create: precio
    })
  }
}

/**
 * @description Crea cuentas por pagar QA en estados pendiente, parcial y pagada.
 * @returns {Promise<void>} Promesa resuelta al crear escenarios de CxP
 */
async function seedQaCuentasPorPagar(): Promise<void> {
  const { hoy, vencida, proxima } = buildQaDates()

  const cuentasPorPagar = [
    {
      cuentaPorPagarId: 'cxp_qa_pendiente_vencida',
      numeroFactura: 'FAC-QA-CXP-001',
      proveedorNombre: 'Proveedor Caribe Alimentos',
      montoDeuda: 12450,
      montoPagado: 0,
      saldoPendiente: 12450,
      moneda: 'CUP',
      fechaEmision: vencida,
      fechaVencimiento: vencida,
      estado: 'PENDIENTE' as const,
      proveedorId: 'vendor_impl_001',
      tipo: 'compra' as const,
      tipoDeuda: 'COMPRA_MERCANCIA'
    },
    {
      cuentaPorPagarId: 'cxp_qa_parcial_vigente',
      numeroFactura: 'FAC-QA-CXP-002',
      proveedorNombre: 'Proveedor Atlantico Hogar',
      montoDeuda: 8600,
      montoPagado: 2600,
      saldoPendiente: 6000,
      moneda: 'USD',
      fechaEmision: hoy,
      fechaVencimiento: proxima,
      estado: 'PARCIAL' as const,
      proveedorId: 'vendor_impl_002',
      tipo: 'compra' as const,
      tipoDeuda: 'COMPRA_INSUMOS'
    },
    {
      cuentaPorPagarId: 'cxp_qa_pagada',
      numeroFactura: 'FAC-QA-CXP-003',
      proveedorNombre: 'Proveedor Tecno Norte',
      montoDeuda: 4200,
      montoPagado: 4200,
      saldoPendiente: 0,
      moneda: 'EUR',
      fechaEmision: hoy,
      fechaVencimiento: proxima,
      estado: 'PAGADA' as const,
      proveedorId: 'vendor_impl_003',
      tipo: 'compra' as const,
      tipoDeuda: 'COMPRA_EQUIPO'
    }
  ]

  for (const cuenta of cuentasPorPagar) {
    await prisma.cuentaPorPagar.upsert({
      where: { cuentaPorPagarId: cuenta.cuentaPorPagarId },
      update: {
        numeroFactura: cuenta.numeroFactura,
        proveedorNombre: cuenta.proveedorNombre,
        montoDeuda: cuenta.montoDeuda,
        montoPagado: cuenta.montoPagado,
        saldoPendiente: cuenta.saldoPendiente,
        moneda: cuenta.moneda,
        fechaEmision: cuenta.fechaEmision,
        fechaVencimiento: cuenta.fechaVencimiento,
        estado: cuenta.estado,
        proveedorId: cuenta.proveedorId,
        tipo: cuenta.tipo,
        tipoDeuda: cuenta.tipoDeuda
      },
      create: { ...cuenta, tenantId: 'demo-tenant' }
    })
  }
}

/**
 * @description Crea cuentas por cobrar QA en estados pendiente, parcial y pagada.
 * @returns {Promise<void>} Promesa resuelta al crear escenarios de CxC
 */
async function seedQaCuentasPorCobrar(): Promise<void> {
  const { hoy, vencida, proxima } = buildQaDates()

  const cuentasPorCobrar = [
    {
      id: 'cxc_qa_pendiente_vencida',
      numeroFactura: 'FAC-QA-CXC-001',
      clienteId: 'cliente_impl_001',
      montoDeuda: 9800,
      montoPagado: 0,
      estado: 'PENDIENTE' as const,
      fechaVencimiento: vencida,
      tipoCuenta: 'VENTA_CREDITO'
    },
    {
      id: 'cxc_qa_parcial_vigente',
      numeroFactura: 'FAC-QA-CXC-002',
      clienteId: 'cliente_impl_002',
      montoDeuda: 7300,
      montoPagado: 3100,
      estado: 'PARCIAL' as const,
      fechaVencimiento: proxima,
      tipoCuenta: 'VENTA_PLAZO'
    },
    {
      id: 'cxc_qa_pagada',
      numeroFactura: 'FAC-QA-CXC-003',
      clienteId: 'cliente_impl_003',
      montoDeuda: 4500,
      montoPagado: 4500,
      estado: 'PAGADA' as const,
      fechaVencimiento: hoy,
      tipoCuenta: 'VENTA_CONTADO'
    }
  ]

  for (const cuenta of cuentasPorCobrar) {
    await prisma.cuentaPorCobrar.upsert({
      where: { id: cuenta.id },
      update: {
        numeroFactura: cuenta.numeroFactura,
        clienteId: cuenta.clienteId,
        montoDeuda: cuenta.montoDeuda,
        montoPagado: cuenta.montoPagado,
        estado: cuenta.estado,
        fechaVencimiento: cuenta.fechaVencimiento,
        tipoCuenta: cuenta.tipoCuenta
      },
      create: { ...cuenta, tenantId: 'demo-tenant' }
    })
  }
}

/**
 * @description Ejecuta seed base y agrega escenarios de QA para pruebas funcionales.
 * @returns {Promise<void>} Promesa resuelta al completar seed QA
 */
export async function seedQaScenarios(): Promise<void> {
  console.log('Iniciando seed QA...')

  await seedImplementationData()
  await seedQaProductos()
  await seedQaCuentasPorPagar()
  await seedQaCuentasPorCobrar()

  console.log('Seed QA completado')
}

const isDirectExecution = process.argv.some((arg) => arg.includes('qa-scenarios-seed.ts'))

if (isDirectExecution) {
  seedQaScenarios()
    .catch((error) => {
      console.error('Error en seed QA:', error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
