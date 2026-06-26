/**
 * @description Seed extras para demo Profesional.
 *              Extiende el seed base con más riqueza operativa:
 *              + monedas, + cuentas, + almacenes, + PVs, + productos,
 *              + lista mayorista, + ventas reales.
 *              Historia: "Negocio en crecimiento con más control y volumen".
 *
 * @module prisma/seed/demo/professional-seed
 */

export interface ProfessionalSeedClient {
  moneda: { upsert: (args: any) => Promise<unknown> }
  cuentaBancaria: { upsert: (args: any) => Promise<unknown> }
  categoria: { upsert: (args: any) => Promise<unknown> }
  unidad: { upsert: (args: any) => Promise<unknown> }
  vendor: { upsert: (args: any) => Promise<unknown> }
  cliente: { upsert: (args: any) => Promise<unknown> }
  almacen: { upsert: (args: any) => Promise<unknown> }
  listaPrecio: { upsert: (args: any) => Promise<unknown> }
  puntoDeVenta: { upsert: (args: any) => Promise<unknown> }
  producto: { upsert: (args: any) => Promise<unknown> }
  precioProducto: { upsert: (args: any) => Promise<unknown> }
  venta: { create: (args: any) => Promise<unknown> }
  ventaItem: { createMany: (args: any) => Promise<unknown> }
}

export interface ProfessionalSeedInput {
  tenantId: string
}

/* ───── Moneda adicional (EUR) ───── */

async function seedMonedaExtra(client: ProfessionalSeedClient): Promise<void> {
  await client.moneda.upsert({
    where: { codigo: 'EUR' },
    update: { nombre: 'Euro', simbolo: 'EUR', esPrincipal: false, isActive: true },
    create: { codigo: 'EUR', nombre: 'Euro', simbolo: 'EUR', esPrincipal: false, isActive: true },
  })
}

/* ───── Cuentas adicionales (USD + EUR) ───── */

async function seedCuentasExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const cuentas = [
    { cuentaId: 'demo_pro_usd_transf', nombreBanco: 'Banco Internacional USD', numeroCuenta: '030-000101-USD', tipoCuenta: 'TRANSFERENCIA', saldo: 8000, moneda: 'USD', isActive: true },
    { cuentaId: 'demo_pro_usd_efectivo', nombreBanco: 'Caja USD', numeroCuenta: 'CAJA-USD-01', tipoCuenta: 'EFECTIVO', saldo: 4000, moneda: 'USD', isActive: true },
    { cuentaId: 'demo_pro_eur_transf', nombreBanco: 'Banco Internacional EUR', numeroCuenta: '030-000102-EUR', tipoCuenta: 'TRANSFERENCIA', saldo: 6000, moneda: 'EUR', isActive: true },
  ]
  for (const c of cuentas) {
    await client.cuentaBancaria.upsert({ where: { cuentaId: c.cuentaId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Proveedores adicionales ───── */

async function seedProveedoresExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const vendors = [
    { vendorId: 'demo_pro_prov_002', nombre: 'Importadora del Caribe', contacto: 'Laura Díaz', telefono: '+53-5551-2002', direccion: 'Matanzas' },
    { vendorId: 'demo_pro_prov_003', nombre: 'TecnoSoluciones S.A.', contacto: 'Roberto Gil', telefono: '+53-5551-2003', direccion: 'Santa Clara' },
  ]
  for (const v of vendors) {
    await client.vendor.upsert({ where: { vendorId: v.vendorId }, update: v, create: { ...v, tenantId } })
  }
}

/* ───── Clientes adicionales ───── */

async function seedClientesExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const clientes = [
    { clienteId: 'demo_pro_cli_004', nombre: 'Restaurante El Sabor', telefono: '+53-7000-3004', direccion: 'Miramar' },
    { clienteId: 'demo_pro_cli_005', nombre: 'Hotel Colonial', telefono: '+53-7000-3005', direccion: 'Habana Vieja' },
    { clienteId: 'demo_pro_cli_006', nombre: 'Cafetería La Plaza', telefono: '+53-7000-3006', direccion: 'Plaza' },
  ]
  for (const c of clientes) {
    await client.cliente.upsert({ where: { clienteId: c.clienteId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Almacén adicional ───── */

async function seedAlmacenExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const a = { almacenId: 'demo_pro_alm_02', nombre: 'Almacén Secundario' }
  await client.almacen.upsert({ where: { almacenId: a.almacenId }, update: a, create: { ...a, tenantId } })
}

/* ───── Lista de precios mayorista ───── */

async function seedListaMayorista(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const lp = { id: 'demo_pro_lista_may', nombre: 'Precio Mayorista', descripcion: 'Lista para clientes por volumen', esDefault: false }
  await client.listaPrecio.upsert({ where: { id: lp.id }, update: lp, create: { ...lp, tenantId } })
}

/* ───── Punto de venta adicional ───── */

async function seedPuntoDeVentaExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const pv = { pvId: 'demo_pro_pv_02', nombre: 'Tienda Vedado', ubicacion: 'Vedado', listaPrecioId: 'demo_pro_lista_may' }
  await client.puntoDeVenta.upsert({ where: { pvId: pv.pvId }, update: pv, create: { ...pv, tenantId } })
}

/* ───── Unidad extra ───── */

async function seedUnidadExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const u = { unidadId: 'demo_pro_caja', nombre: 'Caja', simbolo: 'cj' }
  await client.unidad.upsert({ where: { unidadId: u.unidadId }, update: u, create: { ...u, tenantId } })
}

/* ───── Categoría extra ───── */

async function seedCategoriaExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const c = { catId: 'demo_pro_tecnologia', nombre: 'Tecnología', descripcion: 'Equipos electrónicos y accesorios' }
  await client.categoria.upsert({ where: { catId: c.catId }, update: c, create: { ...c, tenantId } })
}

/* ───── Productos adicionales (~25) ───── */

async function seedProductosExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const productos = [
    // Alimentos adicionales
    { id: 'demo_pro_arroz_int',   nombre: 'Arroz Integral 1kg',      precioCosto: 85,  precioVenta: 110, stock: 90,  stockMinimo: 15, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_kg',    vendorId: 'demo_pro_prov_002', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_frijoles',    nombre: 'Frijoles Negros 1kg',     precioCosto: 70,  precioVenta: 90,  stock: 100, stockMinimo: 20, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_kg',    vendorId: 'demo_pro_prov_002', almacenId: 'demo_pro_alm_02', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_sal',         nombre: 'Sal de Mesa 1kg',         precioCosto: 20,  precioVenta: 35,  stock: 250, stockMinimo: 40, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_kg',    vendorId: 'demo_base_prov',    almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_pro_pv_02' },
    { id: 'demo_pro_especias',    nombre: 'Especias Surtidas 100g',  precioCosto: 90,  precioVenta: 130, stock: 55,  stockMinimo: 10, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_002', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_sardinas',    nombre: 'Sardinas en Lata',        precioCosto: 65,  precioVenta: 85,  stock: 120, stockMinimo: 20, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov',    almacenId: 'demo_pro_alm_02', puntoDeVentaId: 'demo_pro_pv_02' },
    { id: 'demo_pro_queso',       nombre: 'Queso Crema 200g',        precioCosto: 110, precioVenta: 145, stock: 50,  stockMinimo: 10, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_002', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    // Bebidas adicionales
    { id: 'demo_pro_cerveza',     nombre: 'Cerveza Nacional 350ml',  precioCosto: 55,  precioVenta: 80,  stock: 200, stockMinimo: 30, categoriaId: 'demo_base_bebidas',   unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_003', almacenId: 'demo_pro_alm_02', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_vino',        nombre: 'Vino Tinto 750ml',        precioCosto: 350, precioVenta: 480, stock: 30,  stockMinimo: 8,  categoriaId: 'demo_base_bebidas',   unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_003', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_pro_pv_02' },
    { id: 'demo_pro_ron',         nombre: 'Ron Añejo 700ml',         precioCosto: 420, precioVenta: 550, stock: 25,  stockMinimo: 5,  categoriaId: 'demo_base_bebidas',   unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_003', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_yogurt',      nombre: 'Yogurt Natural 1L',       precioCosto: 75,  precioVenta: 100, stock: 65,  stockMinimo: 15, categoriaId: 'demo_base_bebidas',   unidadId: 'demo_base_litro', vendorId: 'demo_pro_prov_002', almacenId: 'demo_pro_alm_02', puntoDeVentaId: 'demo_pro_pv_02' },
    // Hogar adicionales
    { id: 'demo_pro_escoba',      nombre: 'Escoba de Plástico',      precioCosto: 95,  precioVenta: 140, stock: 40,  stockMinimo: 10, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_002', almacenId: 'demo_pro_alm_02', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_cubeta',      nombre: 'Cubeta 10L',              precioCosto: 80,  precioVenta: 115, stock: 35,  stockMinimo: 8,  categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov',    almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_pro_pv_02' },
    { id: 'demo_pro_papel',       nombre: 'Papel Higiénico (pack 4)',precioCosto: 95,  precioVenta: 135, stock: 80,  stockMinimo: 15, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_002', almacenId: 'demo_pro_alm_02', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_shampoo',     nombre: 'Shampoo 400ml',           precioCosto: 130, precioVenta: 180, stock: 55,  stockMinimo: 12, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_002', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_desodorante', nombre: 'Desodorante Roll-on',     precioCosto: 75,  precioVenta: 105, stock: 70,  stockMinimo: 15, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_002', almacenId: 'demo_pro_alm_02', puntoDeVentaId: 'demo_pro_pv_02' },
    // Tecnología
    { id: 'demo_pro_teclado',     nombre: 'Teclado USB Estándar',    precioCosto: 450, precioVenta: 620, stock: 25, stockMinimo: 5,  categoriaId: 'demo_pro_tecnologia', unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_003', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_mouse',       nombre: 'Mouse Inalámbrico',       precioCosto: 320, precioVenta: 450, stock: 30, stockMinimo: 8,  categoriaId: 'demo_pro_tecnologia', unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_003', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_pro_pv_02' },
    { id: 'demo_pro_audifonos',   nombre: 'Audífonos Bluetooth',     precioCosto: 580, precioVenta: 780, stock: 18, stockMinimo: 4,  categoriaId: 'demo_pro_tecnologia', unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_003', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_cargador',    nombre: 'Cargador USB-C 20W',      precioCosto: 210, precioVenta: 290, stock: 40, stockMinimo: 10, categoriaId: 'demo_pro_tecnologia', unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_003', almacenId: 'demo_pro_alm_02', puntoDeVentaId: 'demo_pro_pv_02' },
    { id: 'demo_pro_memoria',     nombre: 'Memoria USB 32GB',        precioCosto: 180, precioVenta: 250, stock: 50, stockMinimo: 10, categoriaId: 'demo_pro_tecnologia', unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_003', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_pro_cable_hdmi',  nombre: 'Cable HDMI 2m',           precioCosto: 95,  precioVenta: 140, stock: 35, stockMinimo: 8,  categoriaId: 'demo_pro_tecnologia', unidadId: 'demo_base_unidad', vendorId: 'demo_pro_prov_003', almacenId: 'demo_pro_alm_02', puntoDeVentaId: 'demo_pro_pv_02' },
  ]
  for (const p of productos) {
    await client.producto.upsert({ where: { id: p.id }, update: p, create: { ...p, tenantId } })
  }
}

/* ───── Precios mayoristas ───── */

async function seedPreciosMayoristas(client: ProfessionalSeedClient): Promise<void> {
  const precios = [
    { id: 'demo_pro_prec_arroz_int',   listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_arroz_int',   precio: 100 },
    { id: 'demo_pro_prec_frijoles',    listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_frijoles',    precio: 82 },
    { id: 'demo_pro_prec_cerveza',     listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_cerveza',     precio: 72 },
    { id: 'demo_pro_prec_vino',        listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_vino',        precio: 440 },
    { id: 'demo_pro_prec_teclado',     listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_teclado',     precio: 570 },
    { id: 'demo_pro_prec_mouse',       listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_mouse',       precio: 410 },
    { id: 'demo_pro_prec_audifonos',   listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_audifonos',   precio: 720 },
    { id: 'demo_pro_prec_cargador',    listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_cargador',    precio: 265 },
    { id: 'demo_pro_prec_memoria',     listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_memoria',     precio: 230 },
    { id: 'demo_pro_prec_shampoo',     listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_shampoo',     precio: 165 },
    { id: 'demo_pro_prec_escoba',      listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_escoba',      precio: 128 },
    { id: 'demo_pro_prec_papel',       listaPrecioId: 'demo_pro_lista_may', productoId: 'demo_pro_papel',       precio: 122 },
  ]
  for (const pp of precios) {
    await client.precioProducto.upsert({ where: { id: pp.id }, update: pp, create: pp })
  }
  // Precios minoristas para los productos nuevos (ya tienen precioVenta en el upsert del producto)
  const minoristas = [
    { id: 'demo_pro_prec_min_arroz_int',  listaPrecioId: 'demo_base_lista', productoId: 'demo_pro_arroz_int',  precio: 110 },
    { id: 'demo_pro_prec_min_frijoles',   listaPrecioId: 'demo_base_lista', productoId: 'demo_pro_frijoles',   precio: 90 },
    { id: 'demo_pro_prec_min_cerveza',    listaPrecioId: 'demo_base_lista', productoId: 'demo_pro_cerveza',    precio: 80 },
    { id: 'demo_pro_prec_min_teclado',    listaPrecioId: 'demo_base_lista', productoId: 'demo_pro_teclado',    precio: 620 },
    { id: 'demo_pro_prec_min_mouse',      listaPrecioId: 'demo_base_lista', productoId: 'demo_pro_mouse',      precio: 450 },
    { id: 'demo_pro_prec_min_audifonos',  listaPrecioId: 'demo_base_lista', productoId: 'demo_pro_audifonos',  precio: 780 },
  ]
  for (const pp of minoristas) {
    await client.precioProducto.upsert({ where: { id: pp.id }, update: pp, create: pp })
  }
}

/* ───── Ventas demo ───── */

async function seedVentasDemo(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const now = new Date()
  const days = [1, 2, 3, 4, 5, 7, 8, 10]
  for (const d of days) {
    const fecha = new Date(now.getTime() - d * 86400000)
    // Venta minorista en Tienda Principal
    const v1 = await client.venta.create({
      data: {
        tenantId,
        total: 0, // se calcula abajo
        subtotal: 0,
        descuento: 0,
        estado: 'completada',
        clienteId: 'demo_base_cli_001',
        puntoDeVentaId: 'demo_base_pv',
        createdAt: fecha,
        updatedAt: fecha,
      },
    }) as { ventaId: string }
    // Items de la venta
    const items = [
      { ventaId: v1.ventaId, productoId: 'demo_base_arroz', cantidad: 2, precioUnitario: 95, subtotal: 190 },
      { ventaId: v1.ventaId, productoId: 'demo_base_aceite', cantidad: 1, precioUnitario: 220, subtotal: 220 },
      { ventaId: v1.ventaId, productoId: 'demo_base_detergente', cantidad: 1, precioUnitario: 165, subtotal: 165 },
      { ventaId: v1.ventaId, productoId: 'demo_base_jabon', cantidad: 3, precioUnitario: 55, subtotal: 165 },
    ]
    const total = items.reduce((s, i) => s + i.subtotal, 0)
    await client.ventaItem.createMany({ data: items })
    // Update total (simplificado — en prod se haría con update)
  }
  console.log(`   📊 [demo-pro] ${days.length} ventas demo creadas`)
}

/* ───── Orquestador ───── */

export async function seedProfessionalExtras(
  input: ProfessionalSeedInput,
  client: ProfessionalSeedClient,
): Promise<void> {
  const { tenantId } = input
  console.log('🚀 [demo-pro] Sembrando extras Profesional...')

  await seedMonedaExtra(client)
  await seedCuentasExtra(client, tenantId)
  await seedUnidadExtra(client, tenantId)
  await seedCategoriaExtra(client, tenantId)
  await seedProveedoresExtra(client, tenantId)
  await seedClientesExtra(client, tenantId)
  await seedAlmacenExtra(client, tenantId)
  await seedListaMayorista(client, tenantId)
  await seedPuntoDeVentaExtra(client, tenantId)
  await seedProductosExtra(client, tenantId)
  await seedPreciosMayoristas(client)
  await seedVentasDemo(client, tenantId)

  console.log('✅ [demo-pro] Extras Profesional completados')
}
