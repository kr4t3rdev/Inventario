import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "./theme-toggle"
import { PanelNotificaciones } from "./notificaciones/panel-notificaciones"
import { CurrencyIndicator } from "./contabilidad/currency-indicator"
import { ContabilidadBreadcrumb } from "./contabilidad/contabilidad-breadcrumb"

export function SiteHeader() {
  
  return (
    <div>
      <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />      
        </div>
        
        {/* Currency Indicator */}
        <CurrencyIndicator />
        
        <div className="flex items-center gap-2">
          <ThemeToggle/>
          <PanelNotificaciones/>        
        </div>
      </header>
      
      {/* Breadcrumb Navigation */}
      <div className="px-4 lg:px-6 py-2">
        <ContabilidadBreadcrumb />
      </div>
    </div>
  )
}
