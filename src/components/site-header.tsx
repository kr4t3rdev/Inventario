import { getMonedasAction, getTasasActualesAction } from "@/features/contabilidad/actions-exchange"
import { getCurrentUser } from "@/lib/server-actions/get-current-user"
import { resolverMonedaPrincipal } from "@/lib/services/moneda-principal-service"
import Link from 'next/link';
import { FloatingNavigationMenu } from '@/components/floating-navigation';
import { NavUser } from '@/components/nav-user';
import { ThemeToggle } from "./theme-toggle"
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
      <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 sm:pl-20 lg:grid lg:grid-cols-[1fr_minmax(0,max-content)_1fr] lg:px-6">
        <Link href="/busy/dashboard" className="mr-auto font-semibold">FinanceMDM</Link>
        <div className="order-3 w-full min-w-0 lg:order-none lg:max-w-[48vw]">
          <FloatingNavigationMenu />
        </div>
        <div className="contents lg:flex lg:min-w-0 lg:items-center lg:justify-end lg:gap-2">
          <div className="order-2 flex w-full min-w-0 flex-wrap items-center gap-1 empty:hidden lg:order-none lg:w-auto">
            <PeriodoActivoIndicator />
            <CurrencyIndicator monedas={monedas} tasas={tasas} monedaPrincipal={monedaPrincipal} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NavUser compact />
            <ThemeToggle />
            <PanelNotificaciones />
          </div>
        </div>
      </header>
      
      {/* Breadcrumb Navigation */}
      <div className="px-4 lg:px-6 py-2">
        <ContabilidadBreadcrumb />
      </div>
    </div>
  )
}
