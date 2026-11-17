import { getMonedasAction, getTasasActualesAction } from "@/features/contabilidad/actions-exchange"
import { getCurrentUser } from "@/lib/server-actions/get-current-user"
import { resolverMonedaPrincipal } from "@/lib/services/moneda-principal-service"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "./theme-toggle"
import {
  FloatingAccount,
  FloatingHeaderMenu,
  SidebarHeaderFrame,
  SidebarViewCollapse,
  SidebarViewToggle,
} from "./sidebar-view"
import { PanelNotificaciones } from "@/features/notificaciones/components/panel-notificaciones"
import { CurrencyIndicator } from "@/features/contabilidad/components/currency-indicator"
import { PeriodoActivoIndicator } from "@/features/contabilidad/components/periodo-activo-indicator"
import { ContabilidadBreadcrumb } from "@/features/contabilidad/components/contabilidad-breadcrumb"

/**
 * @description Encabezado principal con controles globales y contexto contable.
 * @returns {Promise<React.JSX.Element>} Encabezado accesible de la aplicación.
 */
export async function SiteHeader() {
  const [monedasResult, tasasResult, usuario] = await Promise.all([
    getMonedasAction(),
    getTasasActualesAction(),
    getCurrentUser(),
  ])

  // Fuente de verdad de la moneda principal: política contable del tenant.
  const monedaPrincipal = usuario?.tenantId
    ? await resolverMonedaPrincipal(usuario.tenantId)
    : { estado: 'AUSENTE' as const, moneda: null }

  const monedas = monedasResult.success ? (monedasResult.data ?? []) : []
  const tasas = tasasResult.success ? (tasasResult.data?.tasas ?? []) : []
  
  return (
    <div>
      <SidebarHeaderFrame>
        <div className="flex min-w-0 flex-1 items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarViewCollapse />
          <SidebarViewToggle />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <FloatingHeaderMenu />
          
          {/* Período Activo */}
          <PeriodoActivoIndicator />
        </div>
        
        {/* Currency Indicator */}
        <CurrencyIndicator monedas={monedas} tasas={tasas} monedaPrincipal={monedaPrincipal} />
        
        <div className="flex items-center gap-2">
          <FloatingAccount />
          <ThemeToggle/>
          <PanelNotificaciones/>        
        </div>
      </SidebarHeaderFrame>
      
      {/* Breadcrumb Navigation */}
      <div className="px-4 lg:px-6 py-2">
        <ContabilidadBreadcrumb />
      </div>
    </div>
  )
}
