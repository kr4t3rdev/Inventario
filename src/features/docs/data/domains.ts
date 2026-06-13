/**
 * @description Definición de los 9 dominios y sus módulos, extraídos de docs/index.md.
 * El orden debe coincidir con el índice oficial.
 */

import type { DocDomain, DocModule } from "./types"

/** Slug base de cada módulo → su nombre visible y descripción */
const MODULE_INFO: Record<string, { title: string; description: string }> = {
  auth: {
    title: "Autenticación",
    description: "Login, registro, onboarding, JWT, Clerk",
  },
  admin: {
    title: "Administración",
    description: "Usuarios, roles, permisos, multi-tenant admin",
  },
  "mi-empresa": {
    title: "Mi Empresa",
    description: "Configuración del negocio, perfil del tenant",
  },
  configuracion: {
    title: "Configuración",
    description: "Series fiscales, defectaciones, ajustes globales",
  },
  planes: {
    title: "Planes y Licencias",
    description: "Planes de suscripción, feature flags, licenciamiento",
  },
  categorias: {
    title: "Categorías",
    description: "Taxonomía jerárquica de productos",
  },
  unidades: {
    title: "Unidades",
    description: "Unidades de medida",
  },
  productos: {
    title: "Productos",
    description: "Catálogo, stock, costos, códigos EAN-13",
  },
  vendors: {
    title: "Proveedores",
    description: "Gestión de proveedores",
  },
  "listas-precios": {
    title: "Listas de Precios",
    description: "Pricing, listas diferenciadas",
  },
  almacenes: {
    title: "Almacenes",
    description: "Almacenes y ubicaciones de stock",
  },
  "puntos-venta": {
    title: "Puntos de Venta",
    description: "Sucursales y puntos de venta",
  },
  transferencias: {
    title: "Transferencias",
    description: "Movimientos de stock entre almacenes",
  },
  mermas: {
    title: "Mermas",
    description: "Control de pérdidas y ajustes",
  },
  ventas: {
    title: "Ventas",
    description: "Ventas POS, registro, anulación",
  },
  "venta-servicios": {
    title: "Venta de Servicios",
    description: "Ventas de servicios (simple y mixta)",
  },
  facturas: {
    title: "Facturas",
    description: "Facturación electrónica, cuentas por cobrar",
  },
  "series-facturacion": {
    title: "Series de Facturación",
    description: "Series, prefijos y numeración fiscal",
  },
  ofertas: {
    title: "Ofertas",
    description: "Ofertas, descuentos y promociones",
  },
  clientes: {
    title: "Clientes",
    description: "Cartera de clientes, historial",
  },
  "turnos-pos": {
    title: "Turnos POS",
    description: "Turnos de empleados por punto de venta",
  },
  "arqueo-caja": {
    title: "Arqueo de Caja",
    description: "Arqueo y cierre de caja por turno",
  },
  "cuadre-diario": {
    title: "Cuadre Diario",
    description: "Cuadre diario consolidado",
  },
  "compras-productos": {
    title: "Compras de Productos",
    description: "Compras, documentos, FIFO, gastos asociados",
  },
  "compras-servicios": {
    title: "Compras de Servicios",
    description: "Compras de servicios a proveedores",
  },
  servicios: {
    title: "Servicios",
    description: "Catálogo de servicios ofrecidos",
  },
  empleados: {
    title: "Empleados",
    description: "Gestión de empleados, datos laborales",
  },
  "pago-salario": {
    title: "Pago de Salario",
    description: "Nómina, comisiones, vacaciones",
  },
  profile: {
    title: "Perfil",
    description: "Perfil de usuario",
  },
  contabilidad: {
    title: "Contabilidad",
    description: "Plan contable, cuentas, asientos, cierres",
  },
  "contabilidad/periodos-contables": {
    title: "Periodos Contables",
    description: "Apertura, cierre, snapshots",
  },
  "contabilidad/reconciliacion": {
    title: "Reconciliación Bancaria",
    description: "Conciliación de cuentas bancarias",
  },
  "contabilidad/ajustes-bancarios": {
    title: "Ajustes Bancarios",
    description: "Ajustes, anticipos, deudas, préstamos",
  },
  gastosDE: {
    title: "Gastos D/E",
    description: "Gastos de distribución y explotación",
  },
  "reportes-financieros": {
    title: "Reportes Financieros",
    description: "Indicadores, balances, reportes exportables",
  },
  produccion: {
    title: "Producción",
    description: "Órdenes de producción, recetas",
  },
  reparaciones: {
    title: "Reparaciones",
    description: "Taller de reparaciones",
  },
  backups: {
    title: "Backups",
    description: "Sistema de respaldos automáticos",
  },
  notificaciones: {
    title: "Notificaciones",
    description: "Centro de notificaciones",
  },
  dashboard: {
    title: "Dashboard",
    description: "Panel ejecutivo e indicadores",
  },
  contratos: {
    title: "Contratos",
    description: "Gestión de contratos",
  },
  reviews: {
    title: "Reviews",
    description: "Sistema de revisión de asientos",
  },
  landing: {
    title: "Landing Page",
    description: "Página pública de aterrizaje",
  },
  licencias: {
    title: "Licencias",
    description: "Licencias individuales (legacy)",
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
    modules: ["produccion", "reparaciones"].map((s) => mapToModule(s, "Producción", "🏭")),
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
