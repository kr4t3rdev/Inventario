/**
 * @description Seed base para demos — todos los planes (Básico, Profesional, Empresarial).
 *              Cuenta la historia de un negocio pequeño listo para operar:
 *              1 almacén, 1 punto de venta, ~20 productos, operación simple.
 *
 * @module prisma/seed/demo/base-seed
 */

import { demoSeedId } from './seed-id'

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
    { cuentaId: demoSeedId('demo_base_cup_transf', tenantId), nombreBanco: 'Banco Metropolitano', numeroCuenta: '030-000001-CUP', tipoCuenta: 'TRANSFERENCIA', saldo: 150000, moneda: 'CUP', isActive: true },
    { cuentaId: demoSeedId('demo_base_cup_efectivo', tenantId), nombreBanco: 'Caja Principal', numeroCuenta: 'CAJA-001', tipoCuenta: 'EFECTIVO', saldo: 80000, moneda: 'CUP', isActive: true },
  ]
  for (const c of cuentas) {
    await client.cuentaBancaria.upsert({ where: { cuentaId: c.cuentaId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Categorías ───── */

async function seedCategorias(client: DemoSeedClient, tenantId: string): Promise<void> {
  const cats = [
    { catId: demoSeedId('demo_base_alimentos', tenantId), nombre: 'Alimentos', descripcion: 'Productos alimenticios' },
    { catId: demoSeedId('demo_base_hogar', tenantId), nombre: 'Hogar', descripcion: 'Artículos para el hogar' },
    { catId: demoSeedId('demo_base_bebidas', tenantId), nombre: 'Bebidas', descripcion: 'Bebidas y refrescos', parentId: demoSeedId('demo_base_alimentos', tenantId) },
  ]
  for (const c of cats) {
    await client.categoria.upsert({ where: { catId: c.catId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Unidades ───── */

async function seedUnidades(client: DemoSeedClient, tenantId: string): Promise<void> {
  const unidades = [
    { unidadId: demoSeedId('demo_base_unidad', tenantId), nombre: 'Unidad', simbolo: 'u' },
    { unidadId: demoSeedId('demo_base_kg', tenantId), nombre: 'Kilogramo', simbolo: 'kg' },
    { unidadId: demoSeedId('demo_base_litro', tenantId), nombre: 'Litro', simbolo: 'L' },
  ]
  for (const u of unidades) {
    await client.unidad.upsert({ where: { unidadId: u.unidadId }, update: u, create: { ...u, tenantId } })
  }
}

/* ───── Proveedor ───── */

async function seedProveedor(client: DemoSeedClient, tenantId: string): Promise<void> {
  const v = { vendorId: demoSeedId('demo_base_prov', tenantId), nombre: 'Distribuidora Nacional', contacto: 'Carlos Mendoza', telefono: '+53-5551-1001', direccion: 'La Habana' }
  await client.vendor.upsert({ where: { vendorId: v.vendorId }, update: v, create: { ...v, tenantId } })
}

/* ───── Clientes ───── */

async function seedClientes(client: DemoSeedClient, tenantId: string): Promise<void> {
  const clientes = [
    { clienteId: demoSeedId('demo_base_cli_001', tenantId), nombre: 'María González', telefono: '+53-7000-2001', direccion: 'Centro Habana' },
    { clienteId: demoSeedId('demo_base_cli_002', tenantId), nombre: 'Pedro Rodríguez', telefono: '+53-7000-2002', direccion: 'Vedado' },
    { clienteId: demoSeedId('demo_base_cli_003', tenantId), nombre: 'Tienda La Esquina', telefono: '+53-7000-2003', direccion: 'Cerro' },
  ]
  for (const c of clientes) {
    await client.cliente.upsert({ where: { clienteId: c.clienteId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Almacén ───── */

async function seedAlmacen(client: DemoSeedClient, tenantId: string): Promise<void> {
  const a = { almacenId: demoSeedId('demo_base_alm', tenantId), nombre: 'Almacén Principal' }
  await client.almacen.upsert({ where: { almacenId: a.almacenId }, update: a, create: { ...a, tenantId } })
}

/* ───── Lista de precios ───── */

async function seedListaPrecios(client: DemoSeedClient, tenantId: string): Promise<void> {
  const lp = { id: demoSeedId('demo_base_lista', tenantId), nombre: 'Precio Minorista', descripcion: 'Lista de venta al público', esDefault: true }
  await client.listaPrecio.upsert({ where: { id: lp.id }, update: lp, create: { ...lp, tenantId } })
}

/* ───── Punto de venta ───── */

async function seedPuntoDeVenta(client: DemoSeedClient, tenantId: string): Promise<void> {
  const pv = { pvId: demoSeedId('demo_base_pv', tenantId), nombre: 'Tienda Principal', ubicacion: 'La Habana', listaPrecioId: demoSeedId('demo_base_lista', tenantId) }
  await client.puntoDeVenta.upsert({ where: { pvId: pv.pvId }, update: pv, create: { ...pv, tenantId } })
}

/* ───── Productos (~20) ───── */

async function seedProductos(client: DemoSeedClient, tenantId: string): Promise<void> {
  const productos = [
    { id: demoSeedId('demo_base_arroz', tenantId),      nombre: 'Arroz 1kg',            precioCosto: 75,  precioVenta: 95,  stock: 150, stockMinimo: 20, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_kg', tenantId),    vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_aceite', tenantId),     nombre: 'Aceite Vegetal 1L',    precioCosto: 180, precioVenta: 220, stock: 80,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_litro', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_azucar', tenantId),     nombre: 'Azúcar Refino 1kg',    precioCosto: 45,  precioVenta: 65,  stock: 200, stockMinimo: 30, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_kg', tenantId),    vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_cafe', tenantId),       nombre: 'Café Molido 250g',     precioCosto: 120, precioVenta: 160, stock: 60,  stockMinimo: 10, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_leche', tenantId),      nombre: 'Leche en Polvo 400g',  precioCosto: 210, precioVenta: 270, stock: 45,  stockMinimo: 10, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_pan', tenantId),        nombre: 'Pan de Molde',         precioCosto: 55,  precioVenta: 75,  stock: 90,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_huevos', tenantId),     nombre: 'Huevos (cartón 30u)',  precioCosto: 380, precioVenta: 450, stock: 35,  stockMinimo: 8,  categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_detergente', tenantId), nombre: 'Detergente Líquido 500ml', precioCosto: 120, precioVenta: 165, stock: 85, stockMinimo: 20, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_jabon', tenantId),      nombre: 'Jabón de Lavar',       precioCosto: 35,  precioVenta: 55,  stock: 200, stockMinimo: 30, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_cloro', tenantId),      nombre: 'Cloro 1L',             precioCosto: 45,  precioVenta: 65,  stock: 120, stockMinimo: 20, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_litro', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_esponja', tenantId),    nombre: 'Esponja Multiuso',     precioCosto: 25,  precioVenta: 40,  stock: 300, stockMinimo: 40, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_bolsa', tenantId),      nombre: 'Bolsas Basura (pack 20)', precioCosto: 60, precioVenta: 90, stock: 100, stockMinimo: 20, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_agua', tenantId),       nombre: 'Agua Mineral 1.5L',    precioCosto: 35,  precioVenta: 55,  stock: 180, stockMinimo: 30, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_litro', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_refresco', tenantId),   nombre: 'Refresco Cola 2L',     precioCosto: 70,  precioVenta: 95,  stock: 140, stockMinimo: 25, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_litro', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_jugo', tenantId),       nombre: 'Jugo de Naranja 1L',   precioCosto: 55,  precioVenta: 75,  stock: 100, stockMinimo: 15, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_litro', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_malta', tenantId),      nombre: 'Malta 330ml',          precioCosto: 40,  precioVenta: 55,  stock: 160, stockMinimo: 25, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_galleta', tenantId),    nombre: 'Galletas Surtidas',    precioCosto: 50,  precioVenta: 70,  stock: 110, stockMinimo: 20, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_pasta', tenantId),      nombre: 'Pasta Dental 120g',    precioCosto: 85,  precioVenta: 120, stock: 70,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_servilleta', tenantId), nombre: 'Servilletas (pack 100)', precioCosto: 65, precioVenta: 90, stock: 95,  stockMinimo: 20, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_base_harina', tenantId),     nombre: 'Harina de Trigo 1kg',  precioCosto: 40,  precioVenta: 60,  stock: 130, stockMinimo: 25, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_kg', tenantId),    vendorId: demoSeedId('demo_base_prov', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
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

async function seedPrecios(client: DemoSeedClient, tenantId: string): Promise<void> {
  const precios = [
    { id: demoSeedId('demo_base_precio_arroz', tenantId),      listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_arroz', tenantId),      precio: 95 },
    { id: demoSeedId('demo_base_precio_aceite', tenantId),     listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_aceite', tenantId),     precio: 220 },
    { id: demoSeedId('demo_base_precio_azucar', tenantId),     listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_azucar', tenantId),     precio: 65 },
    { id: demoSeedId('demo_base_precio_cafe', tenantId),       listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_cafe', tenantId),       precio: 160 },
    { id: demoSeedId('demo_base_precio_leche', tenantId),      listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_leche', tenantId),      precio: 270 },
    { id: demoSeedId('demo_base_precio_pan', tenantId),        listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_pan', tenantId),        precio: 75 },
    { id: demoSeedId('demo_base_precio_huevos', tenantId),     listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_huevos', tenantId),     precio: 450 },
    { id: demoSeedId('demo_base_precio_detergente', tenantId), listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_detergente', tenantId), precio: 165 },
    { id: demoSeedId('demo_base_precio_jabon', tenantId),      listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_jabon', tenantId),      precio: 55 },
    { id: demoSeedId('demo_base_precio_cloro', tenantId),      listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_cloro', tenantId),      precio: 65 },
    { id: demoSeedId('demo_base_precio_esponja', tenantId),    listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_esponja', tenantId),    precio: 40 },
    { id: demoSeedId('demo_base_precio_bolsa', tenantId),      listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_bolsa', tenantId),      precio: 90 },
    { id: demoSeedId('demo_base_precio_agua', tenantId),       listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_agua', tenantId),       precio: 55 },
    { id: demoSeedId('demo_base_precio_refresco', tenantId),   listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_refresco', tenantId),   precio: 95 },
    { id: demoSeedId('demo_base_precio_jugo', tenantId),       listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_jugo', tenantId),       precio: 75 },
    { id: demoSeedId('demo_base_precio_malta', tenantId),      listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_malta', tenantId),      precio: 55 },
    { id: demoSeedId('demo_base_precio_galleta', tenantId),    listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_galleta', tenantId),    precio: 70 },
    { id: demoSeedId('demo_base_precio_pasta', tenantId),      listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_pasta', tenantId),      precio: 120 },
    { id: demoSeedId('demo_base_precio_servilleta', tenantId), listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_servilleta', tenantId), precio: 90 },
    { id: demoSeedId('demo_base_precio_harina', tenantId),     listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_base_harina', tenantId),     precio: 60 },
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
  await seedPrecios(client, tenantId)

  console.log('✅ [demo-base] Seed base completado')
}
