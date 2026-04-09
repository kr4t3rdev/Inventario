import { PrismaClient } from '../../src/generated/prisma'

const prisma = new PrismaClient()

/**
 * @description Crea o actualiza monedas base para pruebas de implementacion.
 * @returns {Promise<void>} Promesa resuelta cuando termina el upsert de monedas
 */
async function seedMonedas(): Promise<void> {
  const monedas = [
    { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: 'CUP', esPrincipal: true, isActive: true },
    { codigo: 'USD', nombre: 'Dolar Estadounidense', simbolo: 'USD', esPrincipal: false, isActive: true },
    { codigo: 'EUR', nombre: 'EURO', simbolo: 'EUR', esPrincipal: false, isActive: true },
    { codigo: 'MXN', nombre: 'Peso Mexicano', simbolo: 'MXN', esPrincipal: false, isActive: true }
  ]

  for (const moneda of monedas) {
    await prisma.moneda.upsert({
      where: { codigo: moneda.codigo },
      update: {
        nombre: moneda.nombre,
        simbolo: moneda.simbolo,
        esPrincipal: moneda.esPrincipal,
        isActive: moneda.isActive
      },
      create: moneda
    })
  }
}

/**
 * @description Crea tipos de pago contables de transferencia y efectivo.
 * @returns {Promise<void>} Promesa resuelta cuando termina el upsert de tipos de pago
 */
async function seedTiposPagoContables(): Promise<void> {
  const tiposPago = [
    {
      tipoId: 'tp_impl_transferencia',
      nombre: 'Transferencia',
      descripcion: 'Pago por transferencia bancaria',
      requiereCuenta: true,
      isActive: true
    },
    {
      tipoId: 'tp_impl_efectivo',
      nombre: 'Efectivo',
      descripcion: 'Pago en efectivo',
      requiereCuenta: false,
      isActive: true
    }
  ]

  for (const tipoPago of tiposPago) {
    await prisma.tipoPago.upsert({
      where: { tipoId: tipoPago.tipoId },
      update: {
        nombre: tipoPago.nombre,
        descripcion: tipoPago.descripcion,
        requiereCuenta: tipoPago.requiereCuenta,
        isActive: tipoPago.isActive
      },
      create: tipoPago
    })
  }
}

/**
 * @description Crea dos cuentas bancarias por moneda para transferencia y efectivo.
 * @returns {Promise<void>} Promesa resuelta cuando termina el upsert de cuentas
 */
async function seedCuentasBancariasPorMoneda(): Promise<void> {
  const cuentas = [
    {
      cuentaId: 'cb_impl_cup_transferencia',
      nombreBanco: 'Banco Implementacion CUP',
      numeroCuenta: 'IMP-CUP-TR-001',
      tipoCuenta: 'TRANSFERENCIA',
      saldo: 200000,
      moneda: 'CUP',
      isActive: true
    },
    {
      cuentaId: 'cb_impl_cup_efectivo',
      nombreBanco: 'Caja Implementacion CUP',
      numeroCuenta: 'IMP-CUP-EF-001',
      tipoCuenta: 'EFECTIVO',
      saldo: 150000,
      moneda: 'CUP',
      isActive: true
    },
    {
      cuentaId: 'cb_impl_usd_transferencia',
      nombreBanco: 'Banco Implementacion USD',
      numeroCuenta: 'IMP-USD-TR-001',
      tipoCuenta: 'TRANSFERENCIA',
      saldo: 12000,
      moneda: 'USD',
      isActive: true
    },
    {
      cuentaId: 'cb_impl_usd_efectivo',
      nombreBanco: 'Caja Implementacion USD',
      numeroCuenta: 'IMP-USD-EF-001',
      tipoCuenta: 'EFECTIVO',
      saldo: 8000,
      moneda: 'USD',
      isActive: true
    },
    {
      cuentaId: 'cb_impl_eur_transferencia',
      nombreBanco: 'Banco Implementacion EUR',
      numeroCuenta: 'IMP-EUR-TR-001',
      tipoCuenta: 'TRANSFERENCIA',
      saldo: 9000,
      moneda: 'EUR',
      isActive: true
    },
    {
      cuentaId: 'cb_impl_eur_efectivo',
      nombreBanco: 'Caja Implementacion EUR',
      numeroCuenta: 'IMP-EUR-EF-001',
      tipoCuenta: 'EFECTIVO',
      saldo: 6000,
      moneda: 'EUR',
      isActive: true
    },
    {
      cuentaId: 'cb_impl_mxn_transferencia',
      nombreBanco: 'Banco Implementacion MXN',
      numeroCuenta: 'IMP-MXN-TR-001',
      tipoCuenta: 'TRANSFERENCIA',
      saldo: 250000,
      moneda: 'MXN',
      isActive: true
    },
    {
      cuentaId: 'cb_impl_mxn_efectivo',
      nombreBanco: 'Caja Implementacion MXN',
      numeroCuenta: 'IMP-MXN-EF-001',
      tipoCuenta: 'EFECTIVO',
      saldo: 180000,
      moneda: 'MXN',
      isActive: true
    }
  ]

  for (const cuenta of cuentas) {
    await prisma.cuentaBancaria.upsert({
      where: { cuentaId: cuenta.cuentaId },
      update: {
        nombreBanco: cuenta.nombreBanco,
        numeroCuenta: cuenta.numeroCuenta,
        tipoCuenta: cuenta.tipoCuenta,
        saldo: cuenta.saldo,
        moneda: cuenta.moneda,
        isActive: cuenta.isActive
      },
      create: cuenta
    })
  }
}

/**
 * @description Inserta datos base de inventario y contabilidad para fase de implementacion.
 * @returns {Promise<void>} Promesa resuelta al completar el seed
 */
export async function seedImplementationData(): Promise<void> {
  console.log('🌱 Iniciando seed de implementacion...')

  await seedMonedas()
  await seedTiposPagoContables()
  await seedCuentasBancariasPorMoneda()

  const categorias = [
    { catId: 'cat_impl_alimentos', nombre: 'Alimentos', descripcion: 'Categoria para alimentos' },
    { catId: 'cat_impl_hogar', nombre: 'Hogar', descripcion: 'Categoria para productos del hogar' },
    { catId: 'cat_impl_tecnologia', nombre: 'Tecnologia', descripcion: 'Categoria de tecnologia' },
    {
      catId: 'cat_impl_bebidas',
      nombre: 'Bebidas',
      descripcion: 'Subcategoria de bebidas',
      parentId: 'cat_impl_alimentos'
    },
    {
      catId: 'cat_impl_limpieza',
      nombre: 'Limpieza',
      descripcion: 'Subcategoria de limpieza',
      parentId: 'cat_impl_hogar'
    }
  ]

  for (const categoria of categorias) {
    await prisma.categoria.upsert({
      where: { catId: categoria.catId },
      update: {
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        parentId: categoria.parentId
      },
      create: categoria
    })
  }

  const unidades = [
    { unidadId: 'und_impl_unidad', nombre: 'Unidad', simbolo: 'u' },
    { unidadId: 'und_impl_kilogramo', nombre: 'Kilogramo', simbolo: 'kg' },
    { unidadId: 'und_impl_litro', nombre: 'Litro', simbolo: 'L' },
    { unidadId: 'und_impl_caja', nombre: 'Caja', simbolo: 'cj' }
  ]

  for (const unidad of unidades) {
    await prisma.unidad.upsert({
      where: { unidadId: unidad.unidadId },
      update: {
        nombre: unidad.nombre,
        simbolo: unidad.simbolo
      },
      create: unidad
    })
  }

  const proveedores = [
    {
      vendorId: 'vendor_impl_001',
      nombre: 'Proveedor Caribe Alimentos',
      contacto: 'Ana Ruiz',
      telefono: '+53-5551-0001',
      direccion: 'La Habana'
    },
    {
      vendorId: 'vendor_impl_002',
      nombre: 'Proveedor Atlantico Hogar',
      contacto: 'Luis Perez',
      telefono: '+53-5551-0002',
      direccion: 'Matanzas'
    },
    {
      vendorId: 'vendor_impl_003',
      nombre: 'Proveedor Tecno Norte',
      contacto: 'Marta Leon',
      telefono: '+53-5551-0003',
      direccion: 'Villa Clara'
    }
  ]

  for (const proveedor of proveedores) {
    await prisma.vendor.upsert({
      where: { vendorId: proveedor.vendorId },
      update: {
        nombre: proveedor.nombre,
        contacto: proveedor.contacto,
        telefono: proveedor.telefono,
        direccion: proveedor.direccion
      },
      create: proveedor
    })
  }

  const clientes = [
    {
      clienteId: 'cliente_impl_001',
      nombre: 'Cliente Prueba Centro',
      telefono: '+53-7000-1001',
      direccion: 'Centro Habana'
    },
    {
      clienteId: 'cliente_impl_002',
      nombre: 'Cliente Prueba Vedado',
      telefono: '+53-7000-1002',
      direccion: 'Vedado'
    },
    {
      clienteId: 'cliente_impl_003',
      nombre: 'Cliente Prueba Playa',
      telefono: '+53-7000-1003',
      direccion: 'Playa'
    }
  ]

  for (const cliente of clientes) {
    await prisma.cliente.upsert({
      where: { clienteId: cliente.clienteId },
      update: {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: cliente.direccion
      },
      create: cliente
    })
  }

  const almacenes = [
    { almacenId: 'alm_impl_central', nombre: 'Almacen Central Implementacion' },
    { almacenId: 'alm_impl_secundario', nombre: 'Almacen Secundario Implementacion' }
  ]

  for (const almacen of almacenes) {
    await prisma.almacen.upsert({
      where: { almacenId: almacen.almacenId },
      update: {
        nombre: almacen.nombre
      },
      create: almacen
    })
  }

  const listasPrecios = [
    {
      id: 'lp_impl_minorista',
      nombre: 'Lista Minorista Implementacion',
      descripcion: 'Lista de precios para ventas minoristas',
      esDefault: true
    },
    {
      id: 'lp_impl_mayorista',
      nombre: 'Lista Mayorista Implementacion',
      descripcion: 'Lista de precios para ventas por volumen',
      esDefault: false
    }
  ]

  for (const lista of listasPrecios) {
    await prisma.listaPrecio.upsert({
      where: { id: lista.id },
      update: {
        nombre: lista.nombre,
        descripcion: lista.descripcion,
        esDefault: lista.esDefault
      },
      create: lista
    })
  }

  const puntosDeVenta = [
    {
      pvId: 'pv_impl_centro',
      nombre: 'Punto de Venta Centro',
      ubicacion: 'Centro',
      listaPrecioId: 'lp_impl_minorista'
    },
    {
      pvId: 'pv_impl_oeste',
      nombre: 'Punto de Venta Oeste',
      ubicacion: 'Oeste',
      listaPrecioId: 'lp_impl_mayorista'
    }
  ]

  for (const puntoDeVenta of puntosDeVenta) {
    await prisma.puntoDeVenta.upsert({
      where: { pvId: puntoDeVenta.pvId },
      update: {
        nombre: puntoDeVenta.nombre,
        ubicacion: puntoDeVenta.ubicacion,
        listaPrecioId: puntoDeVenta.listaPrecioId
      },
      create: puntoDeVenta
    })
  }

  const productos = [
    {
      id: 'prod_impl_arroz',
      nombre: 'Arroz 1kg',
      descripcion: 'Arroz blanco de prueba',
      precioCosto: 75,
      precioVenta: 95,
      stock: 180,
      stockMinimo: 30,
      categoriaId: 'cat_impl_alimentos',
      subcategoriaId: 'cat_impl_bebidas',
      unidadId: 'und_impl_kilogramo',
      vendorId: 'vendor_impl_001',
      almacenId: 'alm_impl_central',
      puntoDeVentaId: 'pv_impl_centro'
    },
    {
      id: 'prod_impl_aceite',
      nombre: 'Aceite vegetal 1L',
      descripcion: 'Aceite vegetal comestible',
      precioCosto: 180,
      precioVenta: 220,
      stock: 90,
      stockMinimo: 20,
      categoriaId: 'cat_impl_alimentos',
      subcategoriaId: 'cat_impl_bebidas',
      unidadId: 'und_impl_litro',
      vendorId: 'vendor_impl_001',
      almacenId: 'alm_impl_central',
      puntoDeVentaId: 'pv_impl_oeste'
    },
    {
      id: 'prod_impl_detergente',
      nombre: 'Detergente liquido 500ml',
      descripcion: 'Detergente para uso domestico',
      precioCosto: 120,
      precioVenta: 165,
      stock: 110,
      stockMinimo: 25,
      categoriaId: 'cat_impl_hogar',
      subcategoriaId: 'cat_impl_limpieza',
      unidadId: 'und_impl_unidad',
      vendorId: 'vendor_impl_002',
      almacenId: 'alm_impl_secundario',
      puntoDeVentaId: 'pv_impl_centro'
    },
    {
      id: 'prod_impl_jabon',
      nombre: 'Jabon de lavar',
      descripcion: 'Jabon en barra para limpieza',
      precioCosto: 35,
      precioVenta: 55,
      stock: 260,
      stockMinimo: 40,
      categoriaId: 'cat_impl_hogar',
      subcategoriaId: 'cat_impl_limpieza',
      unidadId: 'und_impl_unidad',
      vendorId: 'vendor_impl_002',
      almacenId: 'alm_impl_secundario',
      puntoDeVentaId: 'pv_impl_oeste'
    },
    {
      id: 'prod_impl_teclado',
      nombre: 'Teclado USB',
      descripcion: 'Teclado de oficina',
      precioCosto: 950,
      precioVenta: 1300,
      stock: 45,
      stockMinimo: 10,
      categoriaId: 'cat_impl_tecnologia',
      unidadId: 'und_impl_unidad',
      vendorId: 'vendor_impl_003',
      almacenId: 'alm_impl_central',
      puntoDeVentaId: 'pv_impl_centro'
    },
    {
      id: 'prod_impl_mouse',
      nombre: 'Mouse optico USB',
      descripcion: 'Mouse de uso general',
      precioCosto: 550,
      precioVenta: 780,
      stock: 60,
      stockMinimo: 15,
      categoriaId: 'cat_impl_tecnologia',
      unidadId: 'und_impl_unidad',
      vendorId: 'vendor_impl_003',
      almacenId: 'alm_impl_central',
      puntoDeVentaId: 'pv_impl_oeste'
    }
  ]

  for (const producto of productos) {
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
      create: producto
    })
  }

  const preciosProducto = [
    { id: 'pp_impl_minorista_arroz', listaPrecioId: 'lp_impl_minorista', productoId: 'prod_impl_arroz', precio: 95 },
    { id: 'pp_impl_minorista_aceite', listaPrecioId: 'lp_impl_minorista', productoId: 'prod_impl_aceite', precio: 220 },
    { id: 'pp_impl_minorista_detergente', listaPrecioId: 'lp_impl_minorista', productoId: 'prod_impl_detergente', precio: 165 },
    { id: 'pp_impl_minorista_jabon', listaPrecioId: 'lp_impl_minorista', productoId: 'prod_impl_jabon', precio: 55 },
    { id: 'pp_impl_minorista_teclado', listaPrecioId: 'lp_impl_minorista', productoId: 'prod_impl_teclado', precio: 1300 },
    { id: 'pp_impl_minorista_mouse', listaPrecioId: 'lp_impl_minorista', productoId: 'prod_impl_mouse', precio: 780 },
    { id: 'pp_impl_mayorista_arroz', listaPrecioId: 'lp_impl_mayorista', productoId: 'prod_impl_arroz', precio: 88 },
    { id: 'pp_impl_mayorista_aceite', listaPrecioId: 'lp_impl_mayorista', productoId: 'prod_impl_aceite', precio: 205 },
    { id: 'pp_impl_mayorista_detergente', listaPrecioId: 'lp_impl_mayorista', productoId: 'prod_impl_detergente', precio: 152 },
    { id: 'pp_impl_mayorista_jabon', listaPrecioId: 'lp_impl_mayorista', productoId: 'prod_impl_jabon', precio: 50 },
    { id: 'pp_impl_mayorista_teclado', listaPrecioId: 'lp_impl_mayorista', productoId: 'prod_impl_teclado', precio: 1210 },
    { id: 'pp_impl_mayorista_mouse', listaPrecioId: 'lp_impl_mayorista', productoId: 'prod_impl_mouse', precio: 730 }
  ]

  for (const precioProducto of preciosProducto) {
    await prisma.precioProducto.upsert({
      where: { id: precioProducto.id },
      update: {
        listaPrecioId: precioProducto.listaPrecioId,
        productoId: precioProducto.productoId,
        precio: precioProducto.precio
      },
      create: precioProducto
    })
  }

  console.log('✅ Seed de implementacion completado')
}

const isDirectExecution = process.argv.some((arg) => arg.includes('implementation-seed.ts'))

if (isDirectExecution) {
  seedImplementationData()
    .catch((error) => {
      console.error('❌ Error en seed de implementacion:', error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
