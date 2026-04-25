"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const breadcrumbMap: Record<string, string> = {
  "/busy/contabilidad": "Dashboard",
  "/busy/contabilidad/cuentas": "Cuentas Bancarias",
  "/busy/contabilidad/cuentas-por-pagar": "Cuentas por Pagar",
  "/busy/contabilidad/ajustes": "Ajustes Bancarios",
  "/busy/contabilidad/reconciliacion": "Reconciliación",
  "/busy/contabilidad/reconciliacion/ventas": "Reconciliación de Ventas",
  "/busy/contabilidad/reconciliacion/servicios": "Reconciliación de Servicios",
  "/busy/contabilidad/reconciliacion/gastos": "Reconciliación de Gastos",
  "/busy/contabilidad/exchange": "Exchange",
  "/busy/contabilidad/transferencias": "Transferencias Bancarias",
  "/busy/contabilidad/reportes": "Reportes Financieros",
  "/busy/contabilidad/configuracion": "Configuración",
  "/busy/contabilidad/cierres": "Cierres Contables",
  "/busy/contabilidad/logs": "Logs de Auditoría",
  "/busy/contabilidad/periodos": "Períodos Contables",
  "/busy/contabilidad/eventos": "Eventos Contables",
  "/busy/contabilidad/capital": "Inyeccion de Capital",
  "/busy/contabilidad/cuentas-por-cobrar": "Cuentas por Cobrar",
  "/busy/contabilidad/analisis-cuenta-cliente": "Análisis de Cuenta",
  "/busy/contabilidad/facturas-vencidas": "Facturas Vencidas",
  "/busy/contabilidad/balance-resultados": "Balance y Resultados",
  "/busy/contabilidad/anticipos": "Anticipos",
  "/busy/contabilidad/prestamos-cash": "Préstamos",
  "/busy/contabilidad/deudas-cash": "Deudas",
}

export function ContabilidadBreadcrumb() {
  const pathname = usePathname()
  
  // Only show breadcrumb on contabilidad pages
  if (!pathname.startsWith("/busy/contabilidad")) {
    return null
  }

  const pathSegments = pathname.split("/").filter(Boolean)
  const breadcrumbItems = []

  // Add home
  breadcrumbItems.push({
    href: "/busy/dashboard",
    label: "Inicio",
    isHome: true,
  })

  // Build breadcrumb path
  let currentPath = ""
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i]
    currentPath += `/${segment}`

    // Skip if not a contabilidad path or if it's the base /busy path
    if (currentPath === "/busy") continue

    const label = breadcrumbMap[currentPath]
    if (label) {
      breadcrumbItems.push({
        href: currentPath,
        label,
        isHome: false,
      })
    } else if (currentPath.startsWith("/busy/contabilidad/cierres/") && segment !== "cierres") {
      // Handle dynamic cierre ID
      breadcrumbItems.push({
        href: currentPath,
        label: "Detalles del Cierre",
        isHome: false,
      })
    }
  }

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <div key={item.href} className="flex items-center">
            {index > 0 && (
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
            )}
            <BreadcrumbItem>
              {index === breadcrumbItems.length - 1 ? (
                <BreadcrumbPage className="flex items-center gap-1">
                  {item.isHome && <Home className="h-4 w-4" />}
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href} className="flex items-center gap-1">
                    {item.isHome && <Home className="h-4 w-4" />}
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
