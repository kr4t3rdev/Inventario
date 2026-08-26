/**
 * @description Seed extras para demo Empresarial.
 *              Extiende base + profesional con operación multi-sede completa:
 *              + MXN, + cuentas en todas las monedas, + más almacenes/PVs,
 *              + catálogo extenso (~50 productos extra), + transferencias,
 *              + stock por ubicación, + historial de ventas y compras.
 *              Historia: "Operación robusta multi-sede — una empresa andando de verdad".
 *
 * @module prisma/seed/demo/enterprise-seed
 */

import { demoSeedId } from './seed-id'

export interface EnterpriseSeedClient {
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
  venta: {
    create: (args: any) => Promise<unknown>
    update: (args: any) => Promise<unknown>
  }
  ventaItem: { createMany: (args: any) => Promise<unknown> }
  ventaServicios: { create: (args: any) => Promise<unknown> }
  gastoCompra: { create: (args: any) => Promise<unknown> }
  stockUbicacion: { create: (args: any) => Promise<unknown> }
  transferencia: { create: (args: any) => Promise<unknown> }
}

export interface EnterpriseSeedInput {
  tenantId: string
}

/* ───── Moneda MXN ───── */

async function seedMonedaMxn(client: EnterpriseSeedClient): Promise<void> {
  await client.moneda.upsert({
    where: { codigo: 'MXN' },
    update: { nombre: 'Peso Mexicano', simbolo: 'MXN', esPrincipal: false, isActive: true },
    create: { codigo: 'MXN', nombre: 'Peso Mexicano', simbolo: 'MXN', esPrincipal: false, isActive: true },
  })
}

/* ───── Cuentas en MXN ───── */

async function seedCuentasMxn(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const cuentas = [
    { cuentaId: demoSeedId('demo_emp_mxn_transf', tenantId), nombreBanco: 'Banco Comercial MXN', numeroCuenta: '030-000201-MXN', tipoCuenta: 'TRANSFERENCIA', saldo: 180000, moneda: 'MXN', isActive: true },
    { cuentaId: demoSeedId('demo_emp_mxn_efectivo', tenantId), nombreBanco: 'Caja MXN', numeroCuenta: 'CAJA-MXN-01', tipoCuenta: 'EFECTIVO', saldo: 90000, moneda: 'MXN', isActive: true },
  ]
  for (const c of cuentas) {
    await client.cuentaBancaria.upsert({ where: { cuentaId: c.cuentaId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Proveedores especializados ───── */

async function seedProveedoresEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const vendors = [
    { vendorId: demoSeedId('demo_emp_prov_004', tenantId), nombre: 'AgroIndustrias del Sur', contacto: 'Félix Torres', telefono: '+53-5551-3001', direccion: 'Santiago de Cuba' },
    { vendorId: demoSeedId('demo_emp_prov_005', tenantId), nombre: 'ElectroDomésticos Nacional', contacto: 'Diana Ríos', telefono: '+53-5551-3002', direccion: 'Camagüey' },
    { vendorId: demoSeedId('demo_emp_prov_006', tenantId), nombre: 'Farmacéutica Oriental', contacto: 'Miguel Ángel', telefono: '+53-5551-3003', direccion: 'Holguín' },
  ]
  for (const v of vendors) {
    await client.vendor.upsert({ where: { vendorId: v.vendorId }, update: v, create: { ...v, tenantId } })
  }
}

/* ───── Clientes corporativos ───── */

async function seedClientesEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const clientes = [
    { clienteId: demoSeedId('demo_emp_cli_007', tenantId), nombre: 'Corporación Hotelera Caribe', telefono: '+53-7000-4001', direccion: 'Varadero' },
    { clienteId: demoSeedId('demo_emp_cli_008', tenantId), nombre: 'Hospital Provincial Norte', telefono: '+53-7000-4002', direccion: 'Santa Clara' },
    { clienteId: demoSeedId('demo_emp_cli_009', tenantId), nombre: 'Universidad Central', telefono: '+53-7000-4003', direccion: 'Camagüey' },
    { clienteId: demoSeedId('demo_emp_cli_010', tenantId), nombre: 'Supermercado La Estrella', telefono: '+53-7000-4004', direccion: 'Holguín' },
  ]
  for (const c of clientes) {
    await client.cliente.upsert({ where: { clienteId: c.clienteId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Más almacenes ───── */

async function seedAlmacenesEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const almacenes = [
    { almacenId: demoSeedId('demo_emp_alm_03', tenantId), nombre: 'Almacén Regional Oriente' },
    { almacenId: demoSeedId('demo_emp_alm_04', tenantId), nombre: 'Almacén Frío' },
  ]
  for (const a of almacenes) {
    await client.almacen.upsert({ where: { almacenId: a.almacenId }, update: a, create: { ...a, tenantId } })
  }
}

/* ───── Lista de precios corporativa ───── */

async function seedListaCorporativa(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const lp = { id: demoSeedId('demo_emp_lista_corp', tenantId), nombre: 'Precio Corporativo', descripcion: 'Lista para clientes corporativos con descuento por volumen', esDefault: false }
  await client.listaPrecio.upsert({ where: { id: lp.id }, update: lp, create: { ...lp, tenantId } })
}

/* ───── Más PVs ───── */

async function seedPVsEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const pvs = [
    { pvId: demoSeedId('demo_emp_pv_03', tenantId), nombre: 'Sucursal Oriente', ubicacion: 'Santiago de Cuba', listaPrecioId: demoSeedId('demo_pro_lista_may', tenantId) },
    { pvId: demoSeedId('demo_emp_pv_04', tenantId), nombre: 'Tienda Central', ubicacion: 'Santa Clara', listaPrecioId: demoSeedId('demo_emp_lista_corp', tenantId) },
  ]
  for (const pv of pvs) {
    await client.puntoDeVenta.upsert({ where: { pvId: pv.pvId }, update: pv, create: { ...pv, tenantId } })
  }
}

/* ───── Categorías extra ───── */

async function seedCategoriasEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const cats = [
    { catId: demoSeedId('demo_emp_farmacia', tenantId), nombre: 'Farmacia', descripcion: 'Medicamentos e insumos médicos' },
    { catId: demoSeedId('demo_emp_electro', tenantId), nombre: 'Electrodomésticos', descripcion: 'Equipos para el hogar' },
    { catId: demoSeedId('demo_emp_oficina', tenantId), nombre: 'Oficina', descripcion: 'Material de oficina y papelería' },
  ]
  for (const c of cats) {
    await client.categoria.upsert({ where: { catId: c.catId }, update: c, create: { ...c, tenantId } })
  }
}

/* ───── Unidades extra ───── */

async function seedUnidadesEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const unidades = [
    { unidadId: demoSeedId('demo_emp_paquete', tenantId), nombre: 'Paquete', simbolo: 'pq' },
    { unidadId: demoSeedId('demo_emp_galon', tenantId), nombre: 'Galón', simbolo: 'gal' },
  ]
  for (const u of unidades) {
    await client.unidad.upsert({ where: { unidadId: u.unidadId }, update: u, create: { ...u, tenantId } })
  }
}

/* ───── Catálogo extenso (~50 productos) ───── */

async function seedProductosEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const productos = [
    // Alimentos (10)
    { id: demoSeedId('demo_emp_aceituna', tenantId),    nombre: 'Aceitunas Rellenas 200g',  precioCosto: 95,  precioVenta: 135, stock: 60,  stockMinimo: 12, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_004', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId), puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_mermelada', tenantId),   nombre: 'Mermelada de Fresa 400g',  precioCosto: 80,  precioVenta: 110, stock: 45,  stockMinimo: 10, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_004', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),    puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_emp_cereal', tenantId),      nombre: 'Cereal Integral 500g',     precioCosto: 130, precioVenta: 175, stock: 40,  stockMinimo: 8,  categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_004', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),    puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_chocolate', tenantId),   nombre: 'Chocolate en Barra 100g',  precioCosto: 65,  precioVenta: 95,  stock: 80,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_004', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId),   puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_emp_enlatados', tenantId),   nombre: 'Vegetales Enlatados 400g', precioCosto: 55,  precioVenta: 80,  stock: 100, stockMinimo: 20, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_004', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),    puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_pollo', tenantId),       nombre: 'Pollo Congelado 1kg',      precioCosto: 280, precioVenta: 350, stock: 30,  stockMinimo: 8,  categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_kg', tenantId),    vendorId: demoSeedId('demo_emp_prov_004', tenantId), almacenId: demoSeedId('demo_emp_alm_04', tenantId),    puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_emp_carne', tenantId),       nombre: 'Carne de Res 1kg',         precioCosto: 420, precioVenta: 520, stock: 20,  stockMinimo: 5,  categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_kg', tenantId),    vendorId: demoSeedId('demo_emp_prov_004', tenantId), almacenId: demoSeedId('demo_emp_alm_04', tenantId),    puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_helado', tenantId),      nombre: 'Helado 1L',                precioCosto: 150, precioVenta: 210, stock: 35,  stockMinimo: 8,  categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_litro', tenantId), vendorId: demoSeedId('demo_emp_prov_004', tenantId), almacenId: demoSeedId('demo_emp_alm_04', tenantId),    puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_emp_pan_int', tenantId),     nombre: 'Pan Integral 500g',        precioCosto: 70,  precioVenta: 95,  stock: 55,  stockMinimo: 12, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_base_prov', tenantId),    almacenId: demoSeedId('demo_pro_alm_02', tenantId),   puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_miel', tenantId),        nombre: 'Miel de Abeja 250g',       precioCosto: 110, precioVenta: 155, stock: 40,  stockMinimo: 10, categoriaId: demoSeedId('demo_base_alimentos', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_004', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),    puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    // Bebidas (8)
    { id: demoSeedId('demo_emp_whisky', tenantId),      nombre: 'Whisky Escocés 750ml',     precioCosto: 850, precioVenta: 1100,stock: 15,  stockMinimo: 3,  categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),    puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_champagne', tenantId),   nombre: 'Champagne Brut 750ml',     precioCosto: 680, precioVenta: 890, stock: 12,  stockMinimo: 3,  categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),    puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_agua_gas', tenantId),    nombre: 'Agua con Gas 500ml',       precioCosto: 30,  precioVenta: 45,  stock: 200, stockMinimo: 30, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),    puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_energizante', tenantId), nombre: 'Bebida Energizante 250ml', precioCosto: 65,  precioVenta: 90,  stock: 85,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId),   puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_emp_leche_alm', tenantId),   nombre: 'Leche de Almendras 1L',   precioCosto: 160, precioVenta: 210, stock: 30,  stockMinimo: 8,  categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_litro', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),    puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_emp_te', tenantId),          nombre: 'Té Verde (caja 20u)',      precioCosto: 45,  precioVenta: 65,  stock: 75,  stockMinimo: 15, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId),   puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_sidra', tenantId),       nombre: 'Sidra 750ml',              precioCosto: 180, precioVenta: 240, stock: 30,  stockMinimo: 8,  categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),    puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_emp_batido', tenantId),      nombre: 'Batido Proteico 500ml',    precioCosto: 95,  precioVenta: 135, stock: 50,  stockMinimo: 10, categoriaId: demoSeedId('demo_base_bebidas', tenantId),   unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_002', tenantId), almacenId: demoSeedId('demo_emp_alm_04', tenantId),    puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    // Hogar (10)
    { id: demoSeedId('demo_emp_sabanas', tenantId),     nombre: 'Juego de Sábanas Queen',   precioCosto: 380, precioVenta: 520, stock: 20,  stockMinimo: 5,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_emp_paquete', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_toallas', tenantId),     nombre: 'Toalla de Baño',           precioCosto: 180, precioVenta: 250, stock: 35,  stockMinimo: 8,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_emp_plancha', tenantId),     nombre: 'Plancha a Vapor',          precioCosto: 650, precioVenta: 850, stock: 15,  stockMinimo: 4,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_olla', tenantId),        nombre: 'Olla de Presión 6L',       precioCosto: 480, precioVenta: 650, stock: 12,  stockMinimo: 3,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_emp_ventilador', tenantId),  nombre: 'Ventilador de Pie',        precioCosto: 780, precioVenta: 980, stock: 10,  stockMinimo: 3,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_cortina', tenantId),     nombre: 'Cortina Blackout',         precioCosto: 320, precioVenta: 440, stock: 18,  stockMinimo: 5,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_emp_espejo', tenantId),      nombre: 'Espejo de Pared 40x60',   precioCosto: 250, precioVenta: 360, stock: 14,  stockMinimo: 4,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_lampara', tenantId),     nombre: 'Lámpara LED Escritorio',   precioCosto: 390, precioVenta: 520, stock: 20,  stockMinimo: 5,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_emp_aspiradora', tenantId),  nombre: 'Aspiradora Compacta',      precioCosto: 1200,precioVenta: 1550,stock: 8,   stockMinimo: 2,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_cesto', tenantId),       nombre: 'Cesto de Ropa 60L',        precioCosto: 150, precioVenta: 210, stock: 25,  stockMinimo: 6,  categoriaId: demoSeedId('demo_base_hogar', tenantId),     unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    // Tecnología (8)
    { id: demoSeedId('demo_emp_laptop', tenantId),      nombre: 'Laptop Oficina 15"',       precioCosto: 8500,precioVenta: 10500,stock:6,   stockMinimo: 2,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_tablet', tenantId),      nombre: 'Tablet 10"',               precioCosto: 3200,precioVenta: 4200, stock: 10,  stockMinimo: 3,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_impresora', tenantId),   nombre: 'Impresora Multifunción',   precioCosto: 2800,precioVenta: 3600, stock: 5,   stockMinimo: 2,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_emp_webcam', tenantId),      nombre: 'Webcam HD 1080p',          precioCosto: 450, precioVenta: 620, stock: 20,  stockMinimo: 5,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_router', tenantId),      nombre: 'Router WiFi 6',            precioCosto: 1200,precioVenta: 1550, stock: 12,  stockMinimo: 3,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_teclado_mec', tenantId), nombre: 'Teclado Mecánico RGB',     precioCosto: 850, precioVenta: 1100, stock: 15,  stockMinimo: 4,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_emp_monitor', tenantId),     nombre: 'Monitor 24" Full HD',      precioCosto: 3800,precioVenta: 4800, stock: 8,   stockMinimo: 2,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_ups', tenantId),         nombre: 'UPS 1000VA',               precioCosto: 1650,precioVenta: 2100, stock: 7,   stockMinimo: 2,  categoriaId: demoSeedId('demo_pro_tecnologia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_pro_prov_003', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    // Farmacia (8)
    { id: demoSeedId('demo_emp_paracetamol', tenantId), nombre: 'Paracetamol 500mg (caja 20)', precioCosto: 35, precioVenta: 55, stock: 150, stockMinimo: 30, categoriaId: demoSeedId('demo_emp_farmacia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_006', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_alcohol', tenantId),     nombre: 'Alcohol 70% 500ml',        precioCosto: 45,  precioVenta: 70,  stock: 120, stockMinimo: 20, categoriaId: demoSeedId('demo_emp_farmacia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_006', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_emp_gasa', tenantId),        nombre: 'Gasa Estéril (pack 10)',   precioCosto: 55,  precioVenta: 85,  stock: 80,  stockMinimo: 15, categoriaId: demoSeedId('demo_emp_farmacia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_006', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_jeringa', tenantId),     nombre: 'Jeringas 5ml (caja 50)',   precioCosto: 120, precioVenta: 170, stock: 40,  stockMinimo: 10, categoriaId: demoSeedId('demo_emp_farmacia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_006', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_vitamina_c', tenantId),  nombre: 'Vitamina C 1000mg (30 tab)', precioCosto: 90,precioVenta: 130, stock: 65,  stockMinimo: 12, categoriaId: demoSeedId('demo_emp_farmacia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_006', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_emp_ibuprofeno', tenantId),  nombre: 'Ibuprofeno 400mg (caja 10)', precioCosto: 42,precioVenta: 65, stock: 100, stockMinimo: 20, categoriaId: demoSeedId('demo_emp_farmacia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_006', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_guantes', tenantId),     nombre: 'Guantes Nitrilo (caja 100)', precioCosto: 180,precioVenta: 240, stock: 35,  stockMinimo: 8,  categoriaId: demoSeedId('demo_emp_farmacia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_006', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_termometro', tenantId),  nombre: 'Termómetro Digital',       precioCosto: 210, precioVenta: 290, stock: 25,  stockMinimo: 5,  categoriaId: demoSeedId('demo_emp_farmacia', tenantId), unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_006', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    // Oficina (8)
    { id: demoSeedId('demo_emp_papel_carta', tenantId),  nombre: 'Papel Carta (resma 500)', precioCosto: 120, precioVenta: 165, stock: 50,  stockMinimo: 10, categoriaId: demoSeedId('demo_emp_oficina', tenantId),  unidadId: demoSeedId('demo_emp_paquete', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_boligrafo', tenantId),    nombre: 'Bolígrafos (caja 12)',    precioCosto: 45,  precioVenta: 65,  stock: 90,  stockMinimo: 20, categoriaId: demoSeedId('demo_emp_oficina', tenantId),  unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_carpeta', tenantId),      nombre: 'Carpeta Archivadora',     precioCosto: 25,  precioVenta: 40,  stock: 120, stockMinimo: 25, categoriaId: demoSeedId('demo_emp_oficina', tenantId),  unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_base_pv', tenantId) },
    { id: demoSeedId('demo_emp_marcador', tenantId),     nombre: 'Marcador Pizarra (pack 4)', precioCosto: 60,precioVenta: 85,  stock: 55,  stockMinimo: 12, categoriaId: demoSeedId('demo_emp_oficina', tenantId),  unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
    { id: demoSeedId('demo_emp_notas', tenantId),        nombre: 'Notas Adhesivas (pack 5)', precioCosto: 35, precioVenta: 50,  stock: 100, stockMinimo: 20, categoriaId: demoSeedId('demo_emp_oficina', tenantId),  unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId) },
    { id: demoSeedId('demo_emp_engrapadora', tenantId),  nombre: 'Engrapadora Metálica',    precioCosto: 95,  precioVenta: 135, stock: 30,  stockMinimo: 8,  categoriaId: demoSeedId('demo_emp_oficina', tenantId),  unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_toner', tenantId),        nombre: 'Tóner Impresora',         precioCosto: 580, precioVenta: 750, stock: 12,  stockMinimo: 3,  categoriaId: demoSeedId('demo_emp_oficina', tenantId),  unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId),  puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId) },
    { id: demoSeedId('demo_emp_calendario', tenantId),   nombre: 'Calendario de Pared 2026',precioCosto: 40,  precioVenta: 60,  stock: 40,  stockMinimo: 10, categoriaId: demoSeedId('demo_emp_oficina', tenantId),  unidadId: demoSeedId('demo_base_unidad', tenantId), vendorId: demoSeedId('demo_emp_prov_005', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId) },
  ]
  for (const p of productos) {
    await client.producto.upsert({ where: { id: p.id }, update: p, create: { ...p, tenantId } })
  }
}

/* ───── Precios multi-lista ───── */

async function seedPreciosEmp(
  client: EnterpriseSeedClient,
  tenantId: string,
): Promise<void> {
  const sampleIds = [demoSeedId('demo_emp_laptop', tenantId), demoSeedId('demo_emp_tablet', tenantId), demoSeedId('demo_emp_impresora', tenantId), demoSeedId('demo_emp_paracetamol', tenantId),
    demoSeedId('demo_emp_alcohol', tenantId), demoSeedId('demo_emp_papel_carta', tenantId), demoSeedId('demo_emp_toner', tenantId), demoSeedId('demo_emp_aceituna', tenantId),
    demoSeedId('demo_emp_whisky', tenantId), demoSeedId('demo_emp_champagne', tenantId), demoSeedId('demo_emp_sabanas', tenantId), demoSeedId('demo_emp_plancha', tenantId),
    demoSeedId('demo_emp_ventilador', tenantId), demoSeedId('demo_emp_aspiradora', tenantId), demoSeedId('demo_emp_router', tenantId), demoSeedId('demo_emp_monitor', tenantId),
    demoSeedId('demo_emp_ups', tenantId), demoSeedId('demo_emp_guantes', tenantId), demoSeedId('demo_emp_termometro', tenantId), demoSeedId('demo_emp_engrapadora', tenantId)]
  const samplePrecios = [110, 4300, 3700, 55, 70, 170, 780, 140, 1150, 920, 540, 880, 1020, 1620, 1600, 5000, 2200, 250, 300, 140]

  // Corporativos (descuento)
  for (let i = 0; i < sampleIds.length; i++) {
    await client.precioProducto.upsert({
      where: { id: demoSeedId(`demo_emp_prec_corp_${i}`, tenantId) },
      update: { listaPrecioId: demoSeedId('demo_emp_lista_corp', tenantId), productoId: sampleIds[i], precio: Math.round(samplePrecios[i] * 0.92) },
      create: { id: demoSeedId(`demo_emp_prec_corp_${i}`, tenantId), listaPrecioId: demoSeedId('demo_emp_lista_corp', tenantId), productoId: sampleIds[i], precio: Math.round(samplePrecios[i] * 0.92) },
    })
  }
}

/* ───── Ventas multi-PV ───── */

async function seedVentasEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const now = new Date()
  const pvs = [demoSeedId('demo_base_pv', tenantId), demoSeedId('demo_pro_pv_02', tenantId), demoSeedId('demo_emp_pv_03', tenantId), demoSeedId('demo_emp_pv_04', tenantId)]
  const productosIds = [demoSeedId('demo_emp_laptop', tenantId), demoSeedId('demo_emp_paracetamol', tenantId), demoSeedId('demo_emp_papel_carta', tenantId), demoSeedId('demo_emp_aceituna', tenantId), demoSeedId('demo_emp_whisky', tenantId)]

  for (let d = 1; d <= 14; d++) {
    const pvId = pvs[d % pvs.length]
    const prodId = productosIds[d % productosIds.length]
    const fecha = new Date(now.getTime() - d * 86400000)
    const v = await client.venta.create({
      data: {
        tenantId,
        total: 0, subtotal: 0, descuento: 0,
        estado: 'completada',
        clienteId: demoSeedId(`demo_emp_cli_00${7 + (d % 4)}`, tenantId),
        puntoDeVentaId: pvId,
        createdAt: fecha, updatedAt: fecha,
      },
    }) as { ventaId: string }
    await client.ventaItem.createMany({
      data: [{ ventaId: v.ventaId, productoId: prodId, cantidad: 1 + (d % 3), precioUnitario: 500 + d * 100, subtotal: (1 + (d % 3)) * (500 + d * 100) }],
    })
    const subtotal = (1 + (d % 3)) * (500 + d * 100)
    await client.venta.update({
      where: { ventaId: v.ventaId },
      data: {
        subtotal,
        total: subtotal,
      },
    })
  }
  console.log(`   📊 [demo-emp] 14 ventas demo multi-PV creadas`)
}

/* ───── Compras ───── */

async function seedComprasEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const now = new Date()
  const compras = [
    { proveedor: demoSeedId('demo_emp_prov_004', tenantId), producto: demoSeedId('demo_emp_aceituna', tenantId), cantidad: 20, costo: 1900, dias: 30 },
    { proveedor: demoSeedId('demo_emp_prov_005', tenantId), producto: demoSeedId('demo_emp_sabanas', tenantId), cantidad: 10, costo: 3800, dias: 20 },
    { proveedor: demoSeedId('demo_emp_prov_006', tenantId), producto: demoSeedId('demo_emp_paracetamol', tenantId), cantidad: 50, costo: 1750, dias: 15 },
    { proveedor: demoSeedId('demo_pro_prov_003', tenantId), producto: demoSeedId('demo_emp_laptop', tenantId), cantidad: 5, costo: 42500, dias: 45 },
  ]
  for (const c of compras) {
    const fecha = new Date(now.getTime() - c.dias * 86400000)
    await client.gastoCompra.create({
      data: {
        tenantId,
        vendorId: c.proveedor,
        monto: c.costo,
        tipoCompra: 'INVENTARIO',
        descripcion: `Compra demo de ${c.cantidad}u`,
        estadoPago: 'PAGADA',
        cuentaBancariaId: demoSeedId('demo_base_cup_transf', tenantId),
        createdAt: fecha, updatedAt: fecha,
      },
    })
  }
  console.log(`   📦 [demo-emp] ${compras.length} compras demo creadas`)
}

/* ───── Transferencias entre almacenes ───── */

async function seedTransferenciasEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const now = new Date()
  const transfers = [
    { origen: demoSeedId('demo_emp_alm_03', tenantId), destino: demoSeedId('demo_base_alm', tenantId), producto: demoSeedId('demo_emp_paracetamol', tenantId), cantidad: 30, dias: 5 },
    { origen: demoSeedId('demo_base_alm', tenantId), destino: demoSeedId('demo_emp_alm_03', tenantId), producto: demoSeedId('demo_base_arroz', tenantId), cantidad: 20, dias: 8 },
    { origen: demoSeedId('demo_pro_alm_02', tenantId), destino: demoSeedId('demo_emp_alm_04', tenantId), producto: demoSeedId('demo_pro_cerveza', tenantId), cantidad: 15, dias: 12 },
  ]
  for (const t of transfers) {
    const fecha = new Date(now.getTime() - t.dias * 86400000)
    await client.transferencia.create({
      data: {
        tenantId,
        almacenOrigenId: t.origen,
        almacenDestinoId: t.destino,
        productoId: t.producto,
        cantidad: t.cantidad,
        estado: 'completada',
        createdAt: fecha, updatedAt: fecha,
      },
    })
  }
  console.log(`   🔄 [demo-emp] ${transfers.length} transferencias demo creadas`)
}

/* ───── Stock por ubicación ───── */

async function seedStockUbicacionEmp(client: EnterpriseSeedClient, tenantId: string): Promise<void> {
  const stocks = [
    { productoId: demoSeedId('demo_base_arroz', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), cantidad: 80, puntoDeVentaId: demoSeedId('demo_base_pv', tenantId), cantidadPv: 70 },
    { productoId: demoSeedId('demo_base_arroz', tenantId), almacenId: demoSeedId('demo_pro_alm_02', tenantId), cantidad: 40, puntoDeVentaId: demoSeedId('demo_pro_pv_02', tenantId), cantidadPv: 30 },
    { productoId: demoSeedId('demo_emp_laptop', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), cantidad: 4, puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId), cantidadPv: 2 },
    { productoId: demoSeedId('demo_emp_paracetamol', tenantId), almacenId: demoSeedId('demo_emp_alm_03', tenantId), cantidad: 80, puntoDeVentaId: demoSeedId('demo_emp_pv_03', tenantId), cantidadPv: 70 },
    { productoId: demoSeedId('demo_emp_whisky', tenantId), almacenId: demoSeedId('demo_base_alm', tenantId), cantidad: 10, puntoDeVentaId: demoSeedId('demo_emp_pv_04', tenantId), cantidadPv: 5 },
  ]
  for (const s of stocks) {
    await client.stockUbicacion.create({ data: { ...s, tenantId } })
  }
  console.log(`   📍 [demo-emp] ${stocks.length} stock por ubicación creado`)
}

/* ───── Orquestador ───── */

export async function seedEnterpriseExtras(
  input: EnterpriseSeedInput,
  client: EnterpriseSeedClient,
): Promise<void> {
  const { tenantId } = input
  console.log('🏢 [demo-emp] Sembrando extras Empresarial...')

  await seedMonedaMxn(client)
  await seedCuentasMxn(client, tenantId)
  await seedUnidadesEmp(client, tenantId)
  await seedCategoriasEmp(client, tenantId)
  await seedProveedoresEmp(client, tenantId)
  await seedClientesEmp(client, tenantId)
  await seedAlmacenesEmp(client, tenantId)
  await seedListaCorporativa(client, tenantId)
  await seedPVsEmp(client, tenantId)
  await seedProductosEmp(client, tenantId)
  await seedPreciosEmp(client, tenantId)
  await seedVentasEmp(client, tenantId)
  await seedComprasEmp(client, tenantId)
  await seedTransferenciasEmp(client, tenantId)
  await seedStockUbicacionEmp(client, tenantId)

  console.log('✅ [demo-emp] Extras Empresarial completados')
}
