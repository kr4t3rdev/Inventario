/**
 * @description Seed extras para demo Profesional.
 *              Extiende el seed base con más riqueza operativa:
 *              + monedas, + cuentas, + almacenes, + PVs, + productos,
 *              + lista mayorista, + ventas reales.
 *              Historia: "Negocio en crecimiento con más control y volumen".
 *
 * @module prisma/seed/demo/professional-seed
 */

import { demoSeedId } from './seed-id'

export interface ProfessionalSeedClient {
  moneda: { upsert: (args: any) => Promise<unknown> }
  cuentaBancaria: { upsert: (args: any) => Promise<unknown> }
  categoria: { upsert: (args: any) => Promise<unknown>; findFirst: (args: any) => Promise<unknown> }
  unidad: { upsert: (args: any) => Promise<unknown>; findFirst: (args: any) => Promise<unknown> }
  vendor: { upsert: (args: any) => Promise<unknown>; findFirst: (args: any) => Promise<unknown> }
  cliente: { upsert: (args: any) => Promise<unknown>; findFirst: (args: any) => Promise<unknown> }
  almacen: { upsert: (args: any) => Promise<unknown>; findFirst: (args: any) => Promise<unknown> }
  listaPrecio: { upsert: (args: any) => Promise<unknown>; findFirst: (args: any) => Promise<unknown> }
  puntoDeVenta: { upsert: (args: any) => Promise<unknown>; findFirst: (args: any) => Promise<unknown> }
  producto: { upsert: (args: any) => Promise<unknown>; findFirst: (args: any) => Promise<unknown> }
  precioProducto: { upsert: (args: any) => Promise<unknown>; findFirst: (args: any) => Promise<unknown> }
  venta: {
    create: (args: any) => Promise<unknown>
    update: (args: any) => Promise<unknown>
  }
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
    { cuentaId: demoSeedId('demo_pro_usd_transf', tenantId), nombreBanco: 'Banco Internacional USD', numeroCuenta: '030-000101-USD', tipoCuenta: 'TRANSFERENCIA', saldo: 8000, moneda: 'USD', isActive: true },
    { cuentaId: demoSeedId('demo_pro_usd_efectivo', tenantId), nombreBanco: 'Caja USD', numeroCuenta: 'CAJA-USD-01', tipoCuenta: 'EFECTIVO', saldo: 4000, moneda: 'USD', isActive: true },
    { cuentaId: demoSeedId('demo_pro_eur_transf', tenantId), nombreBanco: 'Banco Internacional EUR', numeroCuenta: '030-000102-EUR', tipoCuenta: 'TRANSFERENCIA', saldo: 6000, moneda: 'EUR', isActive: true },
  ]
  for (const c of cuentas) {
    await client.cuentaBancaria.upsert({ where: { cuentaId: c.cuentaId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Proveedores adicionales ───── */

async function seedProveedoresExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const vendors = [
    { vendorId: demoSeedId('demo_pro_prov_002', tenantId), nombre: 'Importadora del Caribe', contacto: 'Laura Díaz', telefono: '+53-5551-2002', direccion: 'Matanzas' },
    { vendorId: demoSeedId('demo_pro_prov_003', tenantId), nombre: 'TecnoSoluciones S.A.', contacto: 'Roberto Gil', telefono: '+53-5551-2003', direccion: 'Santa Clara' },
  ]
  for (const v of vendors) {
    await client.vendor.upsert({ where: { vendorId: v.vendorId }, update: v, create: { ...v, tenantId } })
  }
}

/* ───── Clientes adicionales ───── */

async function seedClientesExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const clientes = [
    { clienteId: demoSeedId('demo_pro_cli_004', tenantId), nombre: 'Restaurante El Sabor', telefono: '+53-7000-3004', direccion: 'Miramar' },
    { clienteId: demoSeedId('demo_pro_cli_005', tenantId), nombre: 'Hotel Colonial', telefono: '+53-7000-3005', direccion: 'Habana Vieja' },
    { clienteId: demoSeedId('demo_pro_cli_006', tenantId), nombre: 'Cafetería La Plaza', telefono: '+53-7000-3006', direccion: 'Plaza' },
  ]
  for (const c of clientes) {
    await client.cliente.upsert({ where: { clienteId: c.clienteId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Almacén adicional ───── */

async function seedAlmacenExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const a = { almacenId: demoSeedId('demo_pro_alm_02', tenantId), nombre: 'Almacén Secundario' }
  await client.almacen.upsert({ where: { almacenId: a.almacenId }, update: a, create: { ...a, tenantId } })
}

/* ───── Lista de precios mayorista ───── */

async function seedListaMayorista(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const lp = { id: demoSeedId('demo_pro_lista_may', tenantId), nombre: 'Precio Mayorista', descripcion: 'Lista para clientes por volumen', esDefault: false }
  await client.listaPrecio.upsert({ where: { id: lp.id }, update: lp, create: { ...lp, tenantId } })
}

/* ───── Punto de venta adicional ───── */

async function seedPuntoDeVentaExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const pv = { pvId: demoSeedId('demo_pro_pv_02', tenantId), nombre: 'Tienda Vedado', ubicacion: 'Vedado', listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId) }
  await client.puntoDeVenta.upsert({ where: { pvId: pv.pvId }, update: pv, create: { ...pv, tenantId } })
}

/* ───── Unidad extra ───── */

async function seedUnidadExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const u = { unidadId: demoSeedId('demo_pro_caja', tenantId), nombre: 'Caja', simbolo: 'cj' }
  await client.unidad.upsert({ where: { unidadId: u.unidadId }, update: u, create: { ...u, tenantId } })
}

/* ───── Categoría extra ───── */

async function seedCategoriaExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const c = { catId: demoSeedId('demo_pro_tecnologia', tenantId), nombre: 'Tecnología', descripcion: 'Equipos electrónicos y accesorios' }
  await client.categoria.upsert({ where: { catId: c.catId }, update: c, create: { ...c, tenantId } })
}

/* ───── Productos adicionales (~25) ───── */

async function seedProductosExtra(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const productos = [
    // Alimentos adicionales
    { id: demoSeedId('demo_pro_arroz_int', tenantId),   nombre: 'Arroz Integral 1kg',      precioCosto: 85,  precioVenta: 110, stock: 90,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_kg', tenantId),    vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_frijoles', tenantId),    nombre: 'Frijoles Negros 1kg',     precioCosto: 70,  precioVenta: 90,  stock: 100, stockMinimo: 20, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_kg', tenantId),    vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_sal', tenantId),         nombre: 'Sal de Mesa 1kg',         precioCosto: 20,  precioVenta: 35,  stock: 250, stockMinimo: 40, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_kg', tenantId),    vendorId: demoSeedId('demo_base_prov', tenantId),    almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_pro_especias', tenantId),    nombre: 'Especias Surtidas 100g',  precioCosto: 90,  precioVenta: 130, stock: 55,  stockMinimo: 10, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_sardinas', tenantId),    nombre: 'Sardinas en Lata',        precioCosto: 65,  precioVenta: 85,  stock: 120, stockMinimo: 20, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId),    almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_pro_queso', tenantId),       nombre: 'Queso Crema 200g',        precioCosto: 110, precioVenta: 145, stock: 50,  stockMinimo: 10, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    // Bebidas adicionales
    { id: demoSeedId('demo_pro_cerveza', tenantId),     nombre: 'Cerveza Nacional 350ml',  precioCosto: 55,  precioVenta: 80,  stock: 200, stockMinimo: 30, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_vino', tenantId),        nombre: 'Vino Tinto 750ml',        precioCosto: 350, precioVenta: 480, stock: 30,  stockMinimo: 8,  categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_pro_ron', tenantId),         nombre: 'Ron Añejo 700ml',         precioCosto: 420, precioVenta: 550, stock: 25,  stockMinimo: 5,  categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_yogurt', tenantId),      nombre: 'Yogurt Natural 1L',       precioCosto: 75,  precioVenta: 100, stock: 65,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_litro', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    // Hogar adicionales
    { id: demoSeedId('demo_pro_escoba', tenantId),      nombre: 'Escoba de Plástico',      precioCosto: 95,  precioVenta: 140, stock: 40,  stockMinimo: 10, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_cubeta', tenantId),      nombre: 'Cubeta 10L',              precioCosto: 80,  precioVenta: 115, stock: 35,  stockMinimo: 8,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId),    almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_pro_papel', tenantId),       nombre: 'Papel Higiénico (pack 4)',precioCosto: 95,  precioVenta: 135, stock: 80,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_shampoo', tenantId),     nombre: 'Shampoo 400ml',           precioCosto: 130, precioVenta: 180, stock: 55,  stockMinimo: 12, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_desodorante', tenantId), nombre: 'Desodorante Roll-on',     precioCosto: 75,  precioVenta: 105, stock: 70,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    // Tecnología
    { id: demoSeedId('demo_pro_teclado', tenantId),     nombre: 'Teclado USB Estándar',    precioCosto: 450, precioVenta: 620, stock: 25, stockMinimo: 5,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_mouse', tenantId),       nombre: 'Mouse Inalámbrico',       precioCosto: 320, precioVenta: 450, stock: 30, stockMinimo: 8,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_pro_audifonos', tenantId),   nombre: 'Audífonos Bluetooth',     precioCosto: 580, precioVenta: 780, stock: 18, stockMinimo: 4,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_cargador', tenantId),    nombre: 'Cargador USB-C 20W',      precioCosto: 210, precioVenta: 290, stock: 40, stockMinimo: 10, categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_pro_memoria', tenantId),     nombre: 'Memoria USB 32GB',        precioCosto: 180, precioVenta: 250, stock: 50, stockMinimo: 10, categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_pro_cable_hdmi', tenantId),  nombre: 'Cable HDMI 2m',           precioCosto: 95,  precioVenta: 140, stock: 35, stockMinimo: 8,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
  ]
  for (const p of productos) {
    await client.producto.upsert({ where: { id: p.id }, update: p, create: { ...p, tenantId } })
  }
}

/* ───── Precios mayoristas ───── */

async function seedPreciosMayoristas(
  client: ProfessionalSeedClient,
  tenantId: string,
): Promise<void> {
  const precios = [
    { id: demoSeedId('demo_pro_prec_arroz_int', tenantId),   listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_arroz_int', tenantId),   precio: 100 },
    { id: demoSeedId('demo_pro_prec_frijoles', tenantId),    listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_frijoles', tenantId),    precio: 82 },
    { id: demoSeedId('demo_pro_prec_cerveza', tenantId),     listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_cerveza', tenantId),     precio: 72 },
    { id: demoSeedId('demo_pro_prec_vino', tenantId),        listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_vino', tenantId),        precio: 440 },
    { id: demoSeedId('demo_pro_prec_teclado', tenantId),     listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_teclado', tenantId),     precio: 570 },
    { id: demoSeedId('demo_pro_prec_mouse', tenantId),       listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_mouse', tenantId),       precio: 410 },
    { id: demoSeedId('demo_pro_prec_audifonos', tenantId),   listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_audifonos', tenantId),   precio: 720 },
    { id: demoSeedId('demo_pro_prec_cargador', tenantId),    listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_cargador', tenantId),    precio: 265 },
    { id: demoSeedId('demo_pro_prec_memoria', tenantId),     listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_memoria', tenantId),     precio: 230 },
    { id: demoSeedId('demo_pro_prec_shampoo', tenantId),     listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_shampoo', tenantId),     precio: 165 },
    { id: demoSeedId('demo_pro_prec_escoba', tenantId),      listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_escoba', tenantId),      precio: 128 },
    { id: demoSeedId('demo_pro_prec_papel', tenantId),       listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId), productoId: demoSeedId('demo_pro_papel', tenantId),       precio: 122 },
  ]
  for (const pp of precios) {
    await client.precioProducto.upsert({ where: { id: pp.id }, update: pp, create: pp })
  }
  // Precios minoristas para los productos nuevos (ya tienen precioVenta en el upsert del producto)
  const minoristas = [
    { id: demoSeedId('demo_pro_prec_min_arroz_int', tenantId),  listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_pro_arroz_int', tenantId),  precio: 110 },
    { id: demoSeedId('demo_pro_prec_min_frijoles', tenantId),   listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_pro_frijoles', tenantId),   precio: 90 },
    { id: demoSeedId('demo_pro_prec_min_cerveza', tenantId),    listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_pro_cerveza', tenantId),    precio: 80 },
    { id: demoSeedId('demo_pro_prec_min_teclado', tenantId),    listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_pro_teclado', tenantId),    precio: 620 },
    { id: demoSeedId('demo_pro_prec_min_mouse', tenantId),      listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_pro_mouse', tenantId),      precio: 450 },
    { id: demoSeedId('demo_pro_prec_min_audifonos', tenantId),  listaPrecioId: demoSeedId('demo_base_lista', tenantId), productoId: demoSeedId('demo_pro_audifonos', tenantId),  precio: 780 },
  ]
  for (const pp of minoristas) {
    await client.precioProducto.upsert({ where: { id: pp.id }, update: pp, create: pp })
  }
}

/* ───── Integridad: verifica que datos base existan ───── */

async function assertBaseSeedExists(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  const REQUIRED_PRODUCTS = [demoSeedId('demo_base_arroz', tenantId), demoSeedId('demo_base_aceite', tenantId), demoSeedId('demo_base_detergente', tenantId), demoSeedId('demo_base_jabon', tenantId)] as const
  for (const id of REQUIRED_PRODUCTS) {
    const p = await client.producto.findFirst({ where: { id } })
    if (!p) {
      throw new Error(
        `[demo-pro] Producto base '${id}' no encontrado. ` +
        'seedProfessionalExtras requiere que seedBaseDemoData se ejecute primero en la misma transacción.'
      )
    }
  }
  const cliente = await client.cliente.findFirst({ where: { clienteId: demoSeedId('demo_base_cli_001', tenantId) } })
  if (!cliente) {
    throw new Error('[demo-pro] Cliente base demo_base_cli_001 no encontrado. Ejecute seedBaseDemoData primero.')
  }
  const pv = await client.puntoDeVenta.findFirst({ where: { pvId: demoSeedId('demo_base_pv', tenantId) } })
  if (!pv) {
    throw new Error('[demo-pro] Punto de venta base demo_base_pv no encontrado. Ejecute seedBaseDemoData primero.')
  }
  console.log('   ✅ [demo-pro] Datos base verificados, procediendo con ventas...')
}

/* ───── Ventas demo ───── */

async function seedVentasDemo(client: ProfessionalSeedClient, tenantId: string): Promise<void> {
  await assertBaseSeedExists(client, tenantId)
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
        clienteId: demoSeedId('demo_base_cli_001', tenantId),
        puntoDeVentaId: demoSeedId('demo_base_pv', tenantId),
        createdAt: fecha,
        updatedAt: fecha,
      },
    }) as { ventaId: string }
    // Items de la venta
    const items = [
      { ventaId: v1.ventaId, productoId: demoSeedId('demo_base_arroz', tenantId), cantidad: 2, precioUnitario: 95, subtotal: 190 },
      { ventaId: v1.ventaId, productoId: demoSeedId('demo_base_aceite', tenantId), cantidad: 1, precioUnitario: 220, subtotal: 220 },
      { ventaId: v1.ventaId, productoId: demoSeedId('demo_base_detergente', tenantId), cantidad: 1, precioUnitario: 165, subtotal: 165 },
      { ventaId: v1.ventaId, productoId: demoSeedId('demo_base_jabon', tenantId), cantidad: 3, precioUnitario: 55, subtotal: 165 },
    ]
    const total = items.reduce((s, i) => s + i.subtotal, 0)
    await client.ventaItem.createMany({ data: items })
    await client.venta.update({
      where: { ventaId: v1.ventaId },
      data: {
        subtotal: total,
        total,
      },
    })
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
  await seedPreciosMayoristas(client, tenantId)
  await seedVentasDemo(client, tenantId)

  console.log('✅ [demo-pro] Extras Profesional completados')
}
