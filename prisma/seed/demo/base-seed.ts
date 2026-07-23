/**
 * @description Seed base para demos — todos los planes (Básico, Profesional, Empresarial).
 *              Cuenta la historia de un negocio pequeño listo para operar:
 *              1 almacén, 1 punto de venta, ~20 productos, operación simple.
 *
 * @module prisma/seed/demo/base-seed
 */

export interface DemoSeedClient {
  moneda: { upsert: (args: any) => Promise<unknown> }
  tipoPago: { upsert: (args: any) => Promise<unknown> }
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
}

export interface DemoSeedInput {
  tenantId: string
}

/* ───── Monedas (solo CUP y USD para Básico) ───── */

async function seedMonedas(client: DemoSeedClient): Promise<void> {
  const monedas = [
    { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: 'CUP', esPrincipal: true, isActive: true },
    { codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: 'USD', esPrincipal: false, isActive: true },
  ]
  for (const m of monedas) {
    await client.moneda.upsert({ where: { codigo: m.codigo }, update: m, create: m })
  }
}

/* ───── Tipos de pago ───── */

/**
 * @description Crea tipos de pago base aislados para un tenant demo.
 * @param {DemoSeedClient} client - Cliente Prisma o doble de prueba.
 * @param {string} tenantId - Tenant propietario de los tipos de pago.
 * @returns {Promise<void>} Promesa resuelta al completar los upserts.
 */
async function seedTiposPago(
  client: DemoSeedClient,
  tenantId: string,
): Promise<void> {
  const tipos = [
    { tipoId: `demo_base_transferencia__${tenantId}`, nombre: 'Transferencia', descripcion: 'Pago por transferencia', requiereCuenta: true, isActive: true },
    { tipoId: `demo_base_efectivo__${tenantId}`, nombre: 'Efectivo', descripcion: 'Pago en efectivo', requiereCuenta: false, isActive: true },
  ]
  for (const t of tipos) {
    await client.tipoPago.upsert({
      where: { tipoId: t.tipoId },
      update: t,
      create: { ...t, tenantId },
    })
  }
}

/* ───── Cuentas bancarias (solo CUP para Básico) ───── */

async function seedCuentas(client: DemoSeedClient, tenantId: string): Promise<void> {
  const cuentas = [
    { cuentaId: 'demo_base_cup_transf', nombreBanco: 'Banco Metropolitano', numeroCuenta: '030-000001-CUP', tipoCuenta: 'TRANSFERENCIA', saldo: 150000, moneda: 'CUP', isActive: true },
    { cuentaId: 'demo_base_cup_efectivo', nombreBanco: 'Caja Principal', numeroCuenta: 'CAJA-001', tipoCuenta: 'EFECTIVO', saldo: 80000, moneda: 'CUP', isActive: true },
  ]
  for (const c of cuentas) {
    await client.cuentaBancaria.upsert({ where: { cuentaId: c.cuentaId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Categorías ───── */

async function seedCategorias(client: DemoSeedClient, tenantId: string): Promise<void> {
  const cats = [
    { catId: 'demo_base_alimentos', nombre: 'Alimentos', descripcion: 'Productos alimenticios' },
    { catId: 'demo_base_hogar', nombre: 'Hogar', descripcion: 'Artículos para el hogar' },
    { catId: 'demo_base_bebidas', nombre: 'Bebidas', descripcion: 'Bebidas y refrescos', parentId: 'demo_base_alimentos' },
  ]
  for (const c of cats) {
    await client.categoria.upsert({ where: { catId: c.catId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Unidades ───── */

async function seedUnidades(client: DemoSeedClient, tenantId: string): Promise<void> {
  const unidades = [
    { unidadId: 'demo_base_unidad', nombre: 'Unidad', simbolo: 'u' },
    { unidadId: 'demo_base_kg', nombre: 'Kilogramo', simbolo: 'kg' },
    { unidadId: 'demo_base_litro', nombre: 'Litro', simbolo: 'L' },
  ]
  for (const u of unidades) {
    await client.unidad.upsert({ where: { unidadId: u.unidadId }, update: u, create: { ...u, tenantId } })
  }
}

/* ───── Proveedor ───── */

async function seedProveedor(client: DemoSeedClient, tenantId: string): Promise<void> {
  const v = { vendorId: 'demo_base_prov', nombre: 'Distribuidora Nacional', contacto: 'Carlos Mendoza', telefono: '+53-5551-1001', direccion: 'La Habana' }
  await client.vendor.upsert({ where: { vendorId: v.vendorId }, update: v, create: { ...v, tenantId } })
}

/* ───── Clientes ───── */

async function seedClientes(client: DemoSeedClient, tenantId: string): Promise<void> {
  const clientes = [
    { clienteId: 'demo_base_cli_001', nombre: 'María González', telefono: '+53-7000-2001', direccion: 'Centro Habana' },
    { clienteId: 'demo_base_cli_002', nombre: 'Pedro Rodríguez', telefono: '+53-7000-2002', direccion: 'Vedado' },
    { clienteId: 'demo_base_cli_003', nombre: 'Tienda La Esquina', telefono: '+53-7000-2003', direccion: 'Cerro' },
  ]
  for (const c of clientes) {
    await client.cliente.upsert({ where: { clienteId: c.clienteId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Almacén ───── */

async function seedAlmacen(client: DemoSeedClient, tenantId: string): Promise<void> {
  const a = { almacenId: 'demo_base_alm', nombre: 'Almacén Principal' }
  await client.almacen.upsert({ where: { almacenId: a.almacenId }, update: a, create: { ...a, tenantId } })
}

/* ───── Lista de precios ───── */

async function seedListaPrecios(client: DemoSeedClient, tenantId: string): Promise<void> {
  const lp = { id: 'demo_base_lista', nombre: 'Precio Minorista', descripcion: 'Lista de venta al público', esDefault: true }
  await client.listaPrecio.upsert({ where: { id: lp.id }, update: lp, create: { ...lp, tenantId } })
}

/* ───── Punto de venta ───── */

async function seedPuntoDeVenta(client: DemoSeedClient, tenantId: string): Promise<void> {
  const pv = { pvId: 'demo_base_pv', nombre: 'Tienda Principal', ubicacion: 'La Habana', listaPrecioId: 'demo_base_lista' }
  await client.puntoDeVenta.upsert({ where: { pvId: pv.pvId }, update: pv, create: { ...pv, tenantId } })
}

/* ───── Productos (~20) ───── */

async function seedProductos(client: DemoSeedClient, tenantId: string): Promise<void> {
  const productos = [
    { id: 'demo_base_arroz',      nombre: 'Arroz 1kg',            precioCosto: 75,  precioVenta: 95,  stock: 150, stockMinimo: 20, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_kg',    vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_aceite',     nombre: 'Aceite Vegetal 1L',    precioCosto: 180, precioVenta: 220, stock: 80,  stockMinimo: 15, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_litro', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_azucar',     nombre: 'Azúcar Refino 1kg',    precioCosto: 45,  precioVenta: 65,  stock: 200, stockMinimo: 30, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_kg',    vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_cafe',       nombre: 'Café Molido 250g',     precioCosto: 120, precioVenta: 160, stock: 60,  stockMinimo: 10, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_leche',      nombre: 'Leche en Polvo 400g',  precioCosto: 210, precioVenta: 270, stock: 45,  stockMinimo: 10, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_pan',        nombre: 'Pan de Molde',         precioCosto: 55,  precioVenta: 75,  stock: 90,  stockMinimo: 15, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_huevos',     nombre: 'Huevos (cartón 30u)',  precioCosto: 380, precioVenta: 450, stock: 35,  stockMinimo: 8,  categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_detergente', nombre: 'Detergente Líquido 500ml', precioCosto: 120, precioVenta: 165, stock: 85, stockMinimo: 20, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_jabon',      nombre: 'Jabón de Lavar',       precioCosto: 35,  precioVenta: 55,  stock: 200, stockMinimo: 30, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_cloro',      nombre: 'Cloro 1L',             precioCosto: 45,  precioVenta: 65,  stock: 120, stockMinimo: 20, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_litro', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_esponja',    nombre: 'Esponja Multiuso',     precioCosto: 25,  precioVenta: 40,  stock: 300, stockMinimo: 40, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_bolsa',      nombre: 'Bolsas Basura (pack 20)', precioCosto: 60, precioVenta: 90, stock: 100, stockMinimo: 20, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_agua',       nombre: 'Agua Mineral 1.5L',    precioCosto: 35,  precioVenta: 55,  stock: 180, stockMinimo: 30, categoriaId: 'demo_base_bebidas',   unidadId: 'demo_base_litro', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_refresco',   nombre: 'Refresco Cola 2L',     precioCosto: 70,  precioVenta: 95,  stock: 140, stockMinimo: 25, categoriaId: 'demo_base_bebidas',   unidadId: 'demo_base_litro', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_jugo',       nombre: 'Jugo de Naranja 1L',   precioCosto: 55,  precioVenta: 75,  stock: 100, stockMinimo: 15, categoriaId: 'demo_base_bebidas',   unidadId: 'demo_base_litro', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_malta',      nombre: 'Malta 330ml',          precioCosto: 40,  precioVenta: 55,  stock: 160, stockMinimo: 25, categoriaId: 'demo_base_bebidas',   unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_galleta',    nombre: 'Galletas Surtidas',    precioCosto: 50,  precioVenta: 70,  stock: 110, stockMinimo: 20, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_pasta',      nombre: 'Pasta Dental 120g',    precioCosto: 85,  precioVenta: 120, stock: 70,  stockMinimo: 15, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_servilleta', nombre: 'Servilletas (pack 100)', precioCosto: 65, precioVenta: 90, stock: 95,  stockMinimo: 20, categoriaId: 'demo_base_hogar',     unidadId: 'demo_base_unidad', vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
    { id: 'demo_base_harina',     nombre: 'Harina de Trigo 1kg',  precioCosto: 40,  precioVenta: 60,  stock: 130, stockMinimo: 25, categoriaId: 'demo_base_alimentos', unidadId: 'demo_base_kg',    vendorId: 'demo_base_prov', almacenId: 'demo_base_alm', puntoDeVentaId: 'demo_base_pv' },
  ]
  for (const p of productos) {
    await client.producto.upsert({
      where: { id: p.id },
      update: p,
      create: { ...p, tenantId },
    })
  }
}

/* ───── Precios ───── */

async function seedPrecios(client: DemoSeedClient): Promise<void> {
  const precios = [
    { id: 'demo_base_precio_arroz',      listaPrecioId: 'demo_base_lista', productoId: 'demo_base_arroz',      precio: 95 },
    { id: 'demo_base_precio_aceite',     listaPrecioId: 'demo_base_lista', productoId: 'demo_base_aceite',     precio: 220 },
    { id: 'demo_base_precio_azucar',     listaPrecioId: 'demo_base_lista', productoId: 'demo_base_azucar',     precio: 65 },
    { id: 'demo_base_precio_cafe',       listaPrecioId: 'demo_base_lista', productoId: 'demo_base_cafe',       precio: 160 },
    { id: 'demo_base_precio_leche',      listaPrecioId: 'demo_base_lista', productoId: 'demo_base_leche',      precio: 270 },
    { id: 'demo_base_precio_pan',        listaPrecioId: 'demo_base_lista', productoId: 'demo_base_pan',        precio: 75 },
    { id: 'demo_base_precio_huevos',     listaPrecioId: 'demo_base_lista', productoId: 'demo_base_huevos',     precio: 450 },
    { id: 'demo_base_precio_detergente', listaPrecioId: 'demo_base_lista', productoId: 'demo_base_detergente', precio: 165 },
    { id: 'demo_base_precio_jabon',      listaPrecioId: 'demo_base_lista', productoId: 'demo_base_jabon',      precio: 55 },
    { id: 'demo_base_precio_cloro',      listaPrecioId: 'demo_base_lista', productoId: 'demo_base_cloro',      precio: 65 },
    { id: 'demo_base_precio_esponja',    listaPrecioId: 'demo_base_lista', productoId: 'demo_base_esponja',    precio: 40 },
    { id: 'demo_base_precio_bolsa',      listaPrecioId: 'demo_base_lista', productoId: 'demo_base_bolsa',      precio: 90 },
    { id: 'demo_base_precio_agua',       listaPrecioId: 'demo_base_lista', productoId: 'demo_base_agua',       precio: 55 },
    { id: 'demo_base_precio_refresco',   listaPrecioId: 'demo_base_lista', productoId: 'demo_base_refresco',   precio: 95 },
    { id: 'demo_base_precio_jugo',       listaPrecioId: 'demo_base_lista', productoId: 'demo_base_jugo',       precio: 75 },
    { id: 'demo_base_precio_malta',      listaPrecioId: 'demo_base_lista', productoId: 'demo_base_malta',      precio: 55 },
    { id: 'demo_base_precio_galleta',    listaPrecioId: 'demo_base_lista', productoId: 'demo_base_galleta',    precio: 70 },
    { id: 'demo_base_precio_pasta',      listaPrecioId: 'demo_base_lista', productoId: 'demo_base_pasta',      precio: 120 },
    { id: 'demo_base_precio_servilleta', listaPrecioId: 'demo_base_lista', productoId: 'demo_base_servilleta', precio: 90 },
    { id: 'demo_base_precio_harina',     listaPrecioId: 'demo_base_lista', productoId: 'demo_base_harina',     precio: 60 },
  ]
  for (const pp of precios) {
    await client.precioProducto.upsert({ where: { id: pp.id }, update: pp, create: pp })
  }
}

/* ───── Orquestador del seed base ───── */

export async function seedBaseDemoData(
  input: DemoSeedInput,
  client: DemoSeedClient,
): Promise<void> {
  const { tenantId } = input
  console.log('🌱 [demo-base] Sembrando datos base (Básico)...')

  await seedMonedas(client)
  await seedTiposPago(client, tenantId)
  await seedCuentas(client, tenantId)
  await seedCategorias(client, tenantId)
  await seedUnidades(client, tenantId)
  await seedProveedor(client, tenantId)
  await seedClientes(client, tenantId)
  await seedAlmacen(client, tenantId)
  await seedListaPrecios(client, tenantId)
  await seedPuntoDeVenta(client, tenantId)
  await seedProductos(client, tenantId)
  await seedPrecios(client)

  console.log('✅ [demo-base] Seed base completado')
}
