/**
 * @description Definición de los 9 dominios y sus módulos, extraídos de docs/index.md.
 * El orden debe coincidir con el índice oficial.
 */

import type { DocDomain, DocModule } from "./types"

/** Slug base de cada módulo → su nombre visible y descripción */
const MODULE_INFO: Record<string, { title: string; description: string }> = {
  auth: {
    title: "Autenticación",
    description: "Te permite iniciar sesión, registrarte y completar el acceso al sistema.",
  },
  admin: {
    title: "Administración",
    description: "Te permite administrar usuarios, roles y accesos desde una vista central.",
  },
  "mi-empresa": {
    title: "Mi Empresa",
    description: "Aquí configuras los datos de tu negocio para que el sistema use tu información correcta.",
  },
  configuracion: {
    title: "Configuración",
    description: "Aquí ajustas opciones globales como series, reglas y parámetros generales.",
  },
  planes: {
    title: "Planes y Licencias",
    description: "Sirve para revisar qué incluye cada plan y qué licencias están activas.",
  },
  categorias: {
    title: "Categorías",
    description: "Organiza tus productos en grupos para encontrarlos y ordenarlos mejor.",
  },
  unidades: {
    title: "Unidades",
    description: "Define cómo se cuentan los productos: piezas, cajas, kilos o litros.",
  },
  productos: {
    title: "Productos",
    description: "Administra tu catálogo, precios y stock desde un solo lugar.",
  },
  vendors: {
    title: "Proveedores",
    description: "Registra proveedores y mantén sus datos de compra ordenados.",
  },
  "listas-precios": {
    title: "Listas de Precios",
    description: "Crea distintas listas de precios según canal, punto de venta o cliente.",
  },
  almacenes: {
    title: "Almacenes",
    description: "Controla tus almacenes y dónde está guardado cada stock.",
  },
  "puntos-venta": {
    title: "Puntos de Venta",
    description: "Administra tus sucursales o cajas de venta.",
  },
  transferencias: {
    title: "Transferencias",
    description: "Mueve stock entre almacenes sin perder trazabilidad.",
  },
  mermas: {
    title: "Mermas",
    description: "Registra pérdidas o ajustes para que tu inventario siga siendo real.",
  },
  ventas: {
    title: "Ventas",
    description: "Registra ventas, cobros y anulaciones de forma rápida.",
  },
  "venta-servicios": {
    title: "Venta de Servicios",
    description: "Te permite vender servicios además de productos cuando lo necesites.",
  },
  facturas: {
    title: "Facturas",
    description: "Emite facturas y sigue el estado de cobro de cada cliente.",
  },
  "series-facturacion": {
    title: "Series de Facturación",
    description: "Configura prefijos y numeración para tus facturas.",
  },
  ofertas: {
    title: "Ofertas",
    description: "Crea descuentos y promociones para impulsar tus ventas.",
  },
  clientes: {
    title: "Clientes",
    description: "Guarda clientes, historial y datos de contacto.",
  },
  "turnos-pos": {
    title: "Turnos POS",
    description: "Abre y cierra turnos de caja por empleado o punto de venta.",
  },
  "arqueo-caja": {
    title: "Arqueo de Caja",
    description: "Cuadra el efectivo y verifica diferencias al cierre.",
  },
  "cuadre-diario": {
    title: "Cuadre Diario",
    description: "Mira el resumen diario de ventas y caja de un vistazo.",
  },
  "compras-productos": {
    title: "Compras de Productos",
    description: "Registra compras de mercadería y sus documentos asociados.",
  },
  "compras-servicios": {
    title: "Compras de Servicios",
    description: "Controla compras de servicios a proveedores.",
  },
  servicios: {
    title: "Servicios",
    description: "Mantén el catálogo de servicios que vendes.",
  },
  empleados: {
    title: "Empleados",
    description: "Administra datos laborales, turnos y estado de tus empleados.",
  },
  "pago-salario": {
    title: "Pago de Salario",
    description: "Gestiona nómina, pagos y conceptos asociados.",
  },
  profile: {
    title: "Perfil",
    description: "Te permite ver y actualizar tu perfil de usuario.",
  },
  contabilidad: {
    title: "Contabilidad",
    description: "Agrupa cuentas, asientos y cierres para llevar control financiero.",
  },
  "contabilidad/periodos-contables": {
    title: "Periodos Contables",
    description: "Abre y cierra periodos contables sin perder el orden de tus números.",
  },
  "contabilidad/reconciliacion": {
    title: "Reconciliación Bancaria",
    description: "Compara tus movimientos con los del banco y detecta diferencias.",
  },
  "contabilidad/ajustes-bancarios": {
    title: "Ajustes Bancarios",
    description: "Registra ajustes, anticipos, deudas y préstamos vinculados a bancos.",
  },
  gastosDE: {
    title: "Gastos D/E",
    description: "Clasifica gastos operativos para entender mejor tus costos.",
  },
  "reportes-financieros": {
    title: "Reportes Financieros",
    description: "Consulta indicadores y reportes financieros listos para analizar o exportar.",
  },
  produccion: {
    title: "Producción",
    description: "Planifica y registra órdenes de producción y recetas.",
  },
  reparaciones: {
    title: "Reparaciones",
    description: "Gestiona órdenes de reparación, piezas y seguimiento de trabajos.",
  },
  backups: {
    title: "Backups",
    description: "Consulta y administra respaldos automáticos de tu información.",
  },
  notificaciones: {
    title: "Notificaciones",
    description: "Revisa alertas y avisos generados por el sistema.",
  },
  dashboard: {
    title: "Dashboard",
    description: "Ve los indicadores principales de tu negocio en un panel central.",
  },
  contratos: {
    title: "Contratos",
    description: "Lleva el control de contratos, su estado y sus versiones.",
  },
  reviews: {
    title: "Reviews",
    description: "Administra revisiones internas para mantener orden y control.",
  },
  landing: {
    title: "Landing Page",
    description: "Es la página pública que presenta tu negocio antes de iniciar sesión.",
  },
  licencias: {
    title: "Licencias",
    description: "Te permite ver licencias activas y entender qué puede usar cada usuario o empresa.",
  },
  "ficha-costo": {
    title: "Ficha de Costo",
    description: "Calcula el costo de cada producto y entiende su rentabilidad.",
  },
}

function mapToModule(slug: string, domainName: string, domainIcon: string): DocModule {
  const info = MODULE_INFO[slug] ?? { title: slug, description: "" }
  return { slug, title: info.title, description: info.description, domain: domainName, domainIcon }
}

/** Los 9 dominios según docs/index.md */
export const DOC_DOMAINS: DocDomain[] = [
  {
    name: "Fundación",
    icon: "🔐",
    modules: ["auth", "admin", "mi-empresa", "configuracion", "planes"].map((s) =>
      mapToModule(s, "Fundación", "🔐"),
    ),
  },
  {
    name: "Inventario",
    icon: "📦",
    modules: ["categorias", "unidades", "productos", "vendors", "listas-precios"].map((s) =>
      mapToModule(s, "Inventario", "📦"),
    ),
  },
  {
    name: "Operaciones",
    icon: "🏪",
    modules: ["almacenes", "puntos-venta", "transferencias", "mermas"].map((s) =>
      mapToModule(s, "Operaciones", "🏪"),
    ),
  },
  {
    name: "Ventas y Facturación",
    icon: "💰",
    modules: [
      "ventas",
      "venta-servicios",
      "facturas",
      "series-facturacion",
      "ofertas",
      "clientes",
      "turnos-pos",
      "arqueo-caja",
      "cuadre-diario",
    ].map((s) => mapToModule(s, "Ventas y Facturación", "💰")),
  },
  {
    name: "Compras",
    icon: "📥",
    modules: ["compras-productos", "compras-servicios", "servicios"].map((s) =>
      mapToModule(s, "Compras", "📥"),
    ),
  },
  {
    name: "Recursos Humanos",
    icon: "👥",
    modules: ["empleados", "pago-salario", "profile"].map((s) =>
      mapToModule(s, "Recursos Humanos", "👥"),
    ),
  },
  {
    name: "Contabilidad y Finanzas",
    icon: "📊",
    modules: [
      "contabilidad",
      "contabilidad/periodos-contables",
      "contabilidad/reconciliacion",
      "contabilidad/ajustes-bancarios",
      "gastosDE",
      "reportes-financieros",
    ].map((s) => mapToModule(s, "Contabilidad y Finanzas", "📊")),
  },
  {
    name: "Producción",
    icon: "🏭",
    modules: ["produccion", "reparaciones", "ficha-costo"].map((s) => mapToModule(s, "Producción", "🏭")),
  },
  {
    name: "Infraestructura",
    icon: "⚙️",
    modules: ["backups", "notificaciones", "dashboard", "contratos", "reviews", "landing", "licencias"].map((s) =>
      mapToModule(s, "Infraestructura", "⚙️"),
    ),
  },
]

/** Todos los módulos planos, útiles para búsqueda y generar slugs */
export function getAllModules(): DocModule[] {
  return DOC_DOMAINS.flatMap((d) => d.modules)
}

/** Mapa slug → módulo */
export function getModuleBySlug(slug: string): DocModule | undefined {
  return getAllModules().find((m) => m.slug === slug)
}
