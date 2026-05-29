'use client'

import * as React from "react"
import { AnimatePresence, LazyMotion, m as motion, useReducedMotion } from "framer-motion"
import {
  LayoutDashboard,
  Package,
  Tag,
  Square,
  Archive,
  Store,
  ShoppingCart,
  Users,
  Wrench,
  Wallet,
  ArrowRightLeft,
  BookOpen,
  Globe,
  ChefHat,
  CheckCircle,
  Factory,
  CreditCard,
  FileText,
  Receipt,
  AlertTriangle,
  BarChart3,
  
  TrendingUp,
  Calculator,
  Shield,
  LayoutDashboardIcon,
  Option,
  User2Icon,
  Clock,
  Calendar,
  DollarSign,
  SlidersHorizontal,
  Logs,
  Briefcase,
  Building2,
  History,
  ClipboardList,
  Settings,
  UtensilsCrossed,
  Monitor,
  FolderOpen,
} from "lucide-react"
import Link from "next/link"

import { useAuth } from "@/contexts/auth-context"
import { useIsMounted } from "@/hooks/use-is-mounted"
import { isTenantAdminRole, type TenantRole } from '@/lib/auth/roles'
import { cn } from "@/lib/utils"
import { NavMain } from "./nav-main"
import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
  useSidebar,
} from "./ui/sidebar"

/**
 * @description Componente de barra lateral de la aplicación que incluye navegación a todas las páginas principales.
 * @param {React.ComponentProps<typeof Sidebar>} props - Propiedades del contenedor Sidebar.
 * @returns {JSX.Element} Barra lateral principal con navegación agrupada por dominio.
 */
export function AppSidebar2({
  className,
  ...props
}: React.ComponentProps<typeof Sidebar>): React.JSX.Element {
  const { user } = useAuth()
  const { state } = useSidebar()
  const shouldReduceMotion = useReducedMotion()
  const isMounted = useIsMounted()

  const groupListVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
        delayChildren: shouldReduceMotion ? 0 : 0.03,
      },
    },
  }

  const groupItemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.24,
        ease: "easeOut" as const,
      },
    },
  }

  const data = {
    groups: [
      {
        title: "Gestión",
        items: [
          {
            title: "Productos",
            url: "/busy/products",
            icon: Package,
          },
          {
            title: "Categorías",
            url: "/busy/categoria",
            icon: Tag,
          },
          {
            title: "Unidades",
            url: "/busy/unidad",
            icon: Square,
          },
          {
            title: "Almacenes",
            url: "/busy/almacen",
            icon: Archive,
          },
          {
            title: "Puntos de Venta",
            url: "/busy/puntosDeVenta",
            icon: Store,
          },
          {
            title: "Listas de Precios",
            url: "/busy/listas-precios",
            icon: Tag,
          },
          {
            title: "Proveedores",
            url: "/busy/vendor",
            icon: User2Icon,
          },
        ],
      },
      {
        title: "Acciones",
        items: [
          {
            title: "Compras de Productos",
            url: "/busy/compras-productos",
            icon: Package,
          },
          {
            title: "Ventas",
            url: "/busy/sales",
            icon: ShoppingCart,
          },
          {
            title: "Gestión de Facturas",
            url: "/busy/facturas",
            icon: FileText,
          },
          {
            title: "Mermas",
            url: "/busy/mermas",
            icon: AlertTriangle,
          },
          {
            title: "Transferencias",
            url: "/busy/transferencias",
            icon: ArrowRightLeft,
          },
          {
            title: "Empleados",
            url: "",
            icon: Users,
            subItems: [
              {
                title: "Gestión de Empleados",
                url: "/busy/empleados",
                icon: Users,
              },
              {
                title: "Asistencia",
                url: "/busy/empleados/asistencia",
                icon: Clock,
              },
              {
                title: "Vacaciones",
                url: "/busy/empleados/vacaciones",
                icon: Calendar,
              },
              {
                title: "Nómina",
                url: "/busy/empleados/nomina",
                icon: DollarSign,
              },
            ],
          },
          {
            title: "Gastos DE",
            url: "/busy/gastosDE",
            icon: Receipt,
            subItems: [
              {
                title: "Lista de Gastos",
                url: "/busy/gastosDE",
                icon: Receipt,
              },
              {
                title: "Conceptos de Gastos",
                url: "/busy/gastosDE/conceptos",
                icon: FolderOpen,
              },
            ],
          },
          {
            title: "Producción",
            url: "/busy/produccion",
            icon: Factory,
          },
          {
            title: "Clientes",
            url: "/busy/cliente",
            icon: Users,
          },
          {
            title: "Servicios",
            url: "/busy/servicios",
            icon: ShoppingCart,
          },
          // {
          //   title: "Restaurante",
          //   url: "/busy/restaurante",
          //   icon: UtensilsCrossed,
          //   subItems: [
          //     {
          //       title: "Mesas",
          //       url: "/busy/restaurante/mesas",
          //       icon: Users,
          //     },
          //     {
          //       title: "POS",
          //       url: "/busy/restaurante/pos",
          //       icon: CreditCard,
          //     },
          //     {
          //       title: "Caja POS",
          //       url: "/busy/restaurante/caja",
          //       icon: Wallet,
          //     },
          //     {
          //       title: "KDS Cocina",
          //       url: "/busy/restaurante/kds",
          //       icon: Monitor,
          //     },
          //     {
          //       title: "Carta",
          //       url: "/busy/restaurante/carta",
          //       icon: BookOpen,
          //     },
          //     {
          //       title: "Recetas",
          //       url: "/busy/restaurante/recetas",
          //       icon: ChefHat,
          //     },
          //     {
          //       title: "Producción",
          //       url: "/busy/restaurante/produccion",
          //       icon: ClipboardList,
          //     },
          //   ],
          // },
          //  {
          //    title: "Servicios Reparacion",
          //    url: "/busy/reparaciones/ordenes",
          //    icon: Wrench,
          //    subItems: [
          //     {
          //       title: "Órdenes de Reparación",
          //       url: "/busy/reparaciones/ordenes",
          //       icon: ClipboardList,
          //     },
          //     {
          //       title: "Historial Series",
          //       url: "/busy/reparaciones/historial",
          //       icon: History,
          //     },
          //     {
          //       title: "Dashboard Técnicos",
          //       url: "/busy/reparaciones/tecnicos",
          //       icon: Users,
          //     },
          //     {
          //       title: "Configuración",
          //       url: "/busy/reparaciones",
          //       icon: Settings,
          //     },
          //    ]
          //  },
           {
            title: "Contratos",
            url: "/busy/contratos",
            icon: Briefcase,
          },
          {
            title: "Ofertas",
            url: "/busy/ofertas",
            icon: FileText,
          },
        ],
      },
      {
          title: "Configuración",
          items: [
          {
            title: "Mi Empresa",
            url: "/busy/configuracion/mi-empresa",
            icon: Building2,
          },
          {
            title: "Usuarios",
            url: "/busy/configuracion/usuarios",
            icon: Users,
          },
          {
            title: "Contratos",
            url: "/busy/configuracion/contratos",
            icon: FileText,
          },
          {
            title: "Licencias",
            url: "/admin/licencias",
            icon: Logs,
          },
          {
            title: "Planes",
            url: "/admin/planes",
            icon: Wrench
          },
        ],
      },
      {
        title: "Contabilidad",
        items: [
          {
            title: "Dashboard",
            url: "/busy/contabilidad",
            icon: LayoutDashboardIcon,
          },
          {
            title: "Cuentas Bancarias",
            url: "/busy/contabilidad/cuentas",
            icon: Wallet,
          },
          {
            title: "Cuentas por Cobrar",
            url: "/busy/contabilidad/cuentas-por-cobrar",
            icon: Users,
          },
          {
            title: "Cuentas por Pagar",
            url: "/busy/contabilidad/cuentas-por-pagar",
            icon: Receipt,
          },
          

          {
            title: 'Anticipos',
            url: '/busy/contabilidad/anticipos',
            icon: Clock,
          },
          {
            title: 'Préstamos en Efectivo',
            url: '/busy/contabilidad/prestamos-cash',
            icon: DollarSign,
          },
          {
            title: 'Deudas en Efectivo',
            url: '/busy/contabilidad/deudas-cash',
            icon: CreditCard,
          },

          {
            title: "Transferencias Bancarias",
            url: "/busy/contabilidad/transferencias",
            icon: ArrowRightLeft,
          },
          {
            title: "Ajustes Bancarios",
            url: "/busy/contabilidad/ajustes",
            icon: SlidersHorizontal,
          },
          {
            title: "Reconciliación",
            url: "/busy/contabilidad/reconciliacion",
            icon: CheckCircle,
            subItems: [
              {
                title: "Reconciliación Ventas",
                url: "/busy/contabilidad/reconciliacion/ventas",
                icon: CheckCircle,
              },
              {
                title: "Reconciliación Servicios",
                url: "/busy/contabilidad/reconciliacion/servicios",
                icon: CheckCircle,
              },
              {
                title: "Reconciliación Gastos",
                url: "/busy/contabilidad/reconciliacion/gastos",
                icon: CheckCircle,
              },
            ],
          },
          {
            title: "Exchange",
            url: "/busy/contabilidad/exchange",
            icon: Globe,
          },
          {
            title: "Inyección Capital",
            url: "/busy/contabilidad/capital",
            icon: TrendingUp,
          },
          {
            title: "Analisis Estado Cuenta",
            url: "/busy/contabilidad/analisis-cuenta-cliente",
            icon: FileText,
          },
          {
            title: "Facturas Vencidas",
            url: "/busy/contabilidad/facturas-vencidas",
            icon: AlertTriangle,
          },
          {
            title: "Balance y Resultados",
            url: "/busy/contabilidad/balance-resultados",
            icon: Calculator,
          },
          {
            title: "Reportes Contables",
            url: "/busy/contabilidad/reportes",
            icon: FileText,
          },
          {
            title: "Configuracion Contable",
            url: "/busy/contabilidad/configuracion",
            icon: Option,
          },
          {
            title: "Períodos Contables",
            url: "/busy/contabilidad/periodos",
            icon: Calendar,
          },
          {
            title: "Logs",
            url: "/busy/contabilidad/logs",
            icon: Logs,
          },
          
          // {
          //   title: "Cierres Contables",
          //   url: "/busy/contabilidad/cierres",
          //   icon: Calculator,
          // },
        ],
      },
      {
        title: "Reportes",
        items: [
          {
            title: "Reportes",
            url: "/busy/reportes",
            icon: BarChart3,
          },
          {
            title: "Venta Diaria",
            url: "/busy/reportes/venta-diaria",
            icon: Calendar,
          },
          {
            title: "Cuadre Financiero",
            url: "/busy/cuadre",
            icon: Briefcase,
          },
          {
            title: "Arqueos de Caja",
            url: "/busy/caja/arqueos",
            icon: DollarSign,
          },
        ],
      },
      // {
      //   title: "Sugerencia del usuario",
      //   items: [
          
      //     {
      //       title: "Wanda Dashboard",
      //       url: "/busy/sugerencias/wanda-dashboard",
      //       icon: BarChart3,
      //     },
          
      //   ],
      // },
    ],
  }

  const dashboardUrl = "/busy/dashboard"
  const groupToneByTitle: Record<string, string> = {
    Gestión: "from-emerald-500/15 via-sidebar-accent/45 to-transparent",
    Acciones: "from-amber-500/15 via-sidebar-accent/45 to-transparent",
    Administración: "from-violet-500/15 via-sidebar-accent/45 to-transparent",
    Contabilidad: "from-sky-500/15 via-sidebar-accent/45 to-transparent",
    Reportes: "from-rose-500/15 via-sidebar-accent/45 to-transparent",
  }

  // ── Permisos de sidebar por rol de tenant ──
  // Define qué items del menú ve cada rol de tenant.
  // Items sin entrada en el mapa solo los ve manager.
  const SIDEBAR_TENANT_PERMISSIONS: Record<string, TenantRole[]> = {
    // Gestión
    'Productos': ['dependiente', 'manager'],
    'Categorías': ['manager'],
    'Unidades': ['manager'],
    'Almacenes': ['manager'],
    'Puntos de Venta': ['manager'],
    'Listas de Precios': ['manager'],
    'Proveedores': ['manager'],
    // Acciones
    'Compras de Productos': ['manager'],
    'Ventas': ['dependiente', 'manager'],
    'Gestión de Facturas': ['dependiente', 'manager'],
    'Mermas': ['manager'],
    'Transferencias': ['manager'],
    'Empleados': ['manager'],
    'Gastos DE': ['economico', 'manager'],
    'Lista de Gastos': ['economico', 'manager'],
    'Conceptos de Gastos': ['economico', 'manager'],
    'Producción': ['manager'],
    'Clientes': ['manager'],
    'Servicios': ['dependiente', 'manager'],
    'Contratos': ['manager'],
    'Ofertas': ['manager'],
    // Configuración
    'Mi Empresa': ['dependiente', 'economico', 'manager'],
    'Usuarios': ['manager'],
    // Reportes
    'Reportes': ['dependiente', 'economico', 'manager'],
    'Venta Diaria': ['dependiente', 'manager'],
    'Reconciliación': ['economico', 'manager'],
    'Reconciliación Ventas': ['economico', 'manager'],
    'Reconciliación Servicios': ['economico', 'manager'],
    'Reconciliación Gastos': ['economico', 'manager'],
    'Cuadre Financiero': ['economico', 'manager'],
  }

  /**
   * @description Verifica si un item del sidebar es visible para el rol de tenant del usuario.
   */
  function canSeeSidebarItem(itemTitle: string): boolean {
    // Admin global ve todo
    if (user?.role === 'admin') return true

    // Si no hay tenantRole (usuario sin membresía), no ve nada
    if (!user?.tenantRole) return false

    const allowedRoles = SIDEBAR_TENANT_PERMISSIONS[itemTitle]
    // Si el item no está en el mapa, solo manager tiene acceso
    if (!allowedRoles) return user.tenantRole === 'manager'

    return allowedRoles.includes(user.tenantRole as TenantRole)
  }

  /**
   * @description Filtra los subitems recursivamente según el rol.
   */
  function filterSidebarItems(items: any[]): any[] {
    return items.filter(item => {
      // Verificar el item principal
      if (!canSeeSidebarItem(item.title)) return false

      // Si tiene subitems, filtrarlos también
      if (item.subItems) {
        item.subItems = item.subItems.filter(sub => canSeeSidebarItem(sub.title))
        if (item.subItems.length === 0) return false
      }

      return true
    })
  }

  // Filter groups based on user role
  const filteredGroups = (() => {
    return data.groups.map(group => {
      // Licencias y Planes son solo para admin global
      const items = filterSidebarItems(group.items).filter(item => {
        if (item.title === 'Licencias' || item.title === 'Planes') return user?.role === 'admin'
        // Usuarios ya se filtra por tenantRole en canSeeSidebarItem
        return true
      })
      return { ...group, items }
    }).filter(group => group.items.length > 0)
  })()

  return (
    <Sidebar
      collapsible="icon"
      className={cn("group-data-[variant=floating]:p-3", className)}
      {...props}
    >
      <motion.div
        className="flex h-full min-h-0 flex-col"
        initial={isMounted && !shouldReduceMotion ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.26, ease: "easeOut" as const }}
      >
        <AnimatePresence initial={false}>
          {state !== "collapsed" && (
            <motion.div
              key="sidebar-brand-header"
              initial={isMounted && !shouldReduceMotion ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isMounted && !shouldReduceMotion ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "easeOut" as const }}
            >
              <SidebarHeader className="px-3 pb-2 pt-3">
                <Link
                  href={dashboardUrl}
                  className="group/brand flex min-h-11 items-center gap-3 rounded-xl border border-sidebar-border/70 bg-linear-to-br from-primary/15 via-sidebar-accent/55 to-transparent px-3 py-3 text-sidebar-foreground transition-colors duration-200 hover:border-primary/40 hover:from-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <motion.span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeOut" as const }}
                  >
                    <LayoutDashboard className="h-5 w-5 transition-transform duration-200 group-hover/brand:-translate-y-0.5" />
                  </motion.span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-sm font-semibold tracking-wide">
                      FinanceMDM
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      Inventario y finanzas
                    </span>
                  </span>
                </Link>
              </SidebarHeader>
              <SidebarSeparator className="mx-0.5 mb-0.5" />
            </motion.div>
          )}
        </AnimatePresence>

        <SidebarContent className="px-2 pb-2 group-data-[collapsible=icon]:overflow-y-auto group-data-[collapsible=icon]:px-0">
          <motion.div
            className="flex flex-col gap-2 group-data-[collapsible=icon]:gap-2"
            variants={groupListVariants}
            initial={isMounted && !shouldReduceMotion ? "hidden" : "visible"}
            animate="visible"
          >
            {filteredGroups.map((group) => (
              <motion.div
                key={group.title}
                variants={groupItemVariants}
                whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                title={state === "collapsed" ? group.title : undefined}
              >
                <SidebarGroup
                  className={cn(
                    "rounded-xl border border-sidebar-border/70 bg-linear-to-br p-2 shadow-sm transition-colors duration-200 hover:border-sidebar-border",
                    groupToneByTitle[group.title] ??
                      "from-sidebar-accent/55 via-sidebar-accent/30 to-transparent",
                    "group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-1.5 group-data-[collapsible=icon]:shadow-none"
                  )}
                >
                  <SidebarGroupLabel className="h-auto px-2 py-1 text-[0.67rem] font-semibold uppercase tracking-widest text-sidebar-foreground/70">
                    {group.title}
                  </SidebarGroupLabel>
                  <NavMain items={group.items} />
                </SidebarGroup>
              </motion.div>
            ))}
          </motion.div>
        </SidebarContent>

        <motion.div
          initial={isMounted && !shouldReduceMotion ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "easeOut" as const }}
        >
          <SidebarSeparator className="mx-0.5 mt-1" />
          <SidebarFooter className="flex flex-col gap-2 p-3 pt-2 group-data-[collapsible=icon]:p-1">
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"
              >
                <Shield className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Panel de Control</span>
              </Link>
            )}
            <NavUser />
          </SidebarFooter>
        </motion.div>
        <SidebarRail className="after:opacity-70" />
      </motion.div>
    </Sidebar>
  )
}
