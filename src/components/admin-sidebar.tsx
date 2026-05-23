'use client'

import * as React from "react"
import { AnimatePresence, LazyMotion, m as motion, useReducedMotion } from "framer-motion"
import {
  LayoutDashboard,
  Building2,
  Wallet,
  Shield,
  Users,
  Database,
  BarChart3,
  Activity,
  Globe,
  AlertTriangle,
  Logs,
  Settings,
  UserCog,
  FileText,
  RefreshCw,
  ArrowLeftRight,
  Sparkles,
  Key,
  CreditCard,
} from "lucide-react"
import Link from "next/link"

import { useAuth } from "@/contexts/auth-context"
import { useIsMounted } from "@/hooks/use-is-mounted"
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

export function AdminSidebar({
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
        title: "Panel de Control",
        items: [
          {
            title: "Overview",
            url: "/admin",
            icon: LayoutDashboard,
          },
          {
            title: "Tenants",
            url: "/admin/tenants",
            icon: Building2,
          },
          {
            title: "Finanzas Globales",
            url: "/admin/finanzas",
            icon: Wallet,
          },
        ],
      },
      {
        title: "Monitor",
        items: [
          {
            title: "Salud del Sistema",
            url: "/admin/sistema",
            icon: Activity,
          },
          {
            title: "Usuarios",
            url: "/admin/usuarios",
            icon: UserCog,
          },
        ],
      },
      {
        title: "Licencias",
        items: [
          {
            title: "Licencias",
            url: "/admin/licencias",
            icon: Key,
          },
          {
            title: "Planes",
            url: "/admin/planes",
            icon: CreditCard,
          },
        ],
      },
      {
        title: "Herramientas",
        items: [
          {
            title: "Migraciones",
            url: "/admin/migraciones",
            icon: Database,
          },
        ],
      },
    ],
  }

  const groupToneByTitle: Record<string, string> = {
    "Panel de Control": "from-violet-500/15 via-sidebar-accent/45 to-transparent",
    Monitor: "from-amber-500/15 via-sidebar-accent/45 to-transparent",
    Licencias: "from-emerald-500/15 via-sidebar-accent/45 to-transparent",
    Herramientas: "from-sky-500/15 via-sidebar-accent/45 to-transparent",
  }

  const dashboardUrl = "/admin"

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "group-data-[variant=floating]:p-3",
        "[--sidebar-accent:theme(colors.violet.50)] dark:[--sidebar-accent:theme(colors.violet.950/0.3)]",
        className,
      )}
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
                  className="group/brand flex min-h-11 items-center gap-3 rounded-xl border border-sidebar-border/70 bg-linear-to-br from-violet-600/15 via-sidebar-accent/55 to-transparent px-3 py-3 text-sidebar-foreground transition-colors duration-200 hover:border-violet-400/70 hover:from-violet-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <motion.span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600"
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeOut" as const }}
                  >
                    <Shield className="h-5 w-5 transition-transform duration-200 group-hover/brand:-translate-y-0.5" />
                  </motion.span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-sm font-semibold tracking-wide">
                      Admin Panel
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      Control del sistema
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
            {data.groups.map((group) => (
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
                    "group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-1.5 group-data-[collapsible=icon]:shadow-none",
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
            {/* Toggle to business view */}
            <Link
              href="/busy/dashboard"
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Ir al Negocio</span>
            </Link>
            <NavUser />
          </SidebarFooter>
        </motion.div>
        <SidebarRail className="after:opacity-70" />
      </motion.div>
    </Sidebar>
  )
}
