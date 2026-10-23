import { MiEmpresaForm } from "@/features/mi-empresa/components/mi-empresa-form"
import { getMiEmpresaPageData } from "@/features/mi-empresa/server/data"
import {
  mapMiEmpresaApiToFormValues,
  filterActiveCuentasBancarias,
} from "@/features/mi-empresa/lib/miEmpresaUtils"
import { getCurrentUser } from "@/lib/server-actions"
import { hasFeature } from "@/lib/services/tenant-scope"
import { getFiscalConfigAction } from "@/features/facturas/actions-fiscal-config"
import { FiscalConfigForm } from "@/features/facturas/components/fiscal-config-form"

/**
 * @description Página de configuración de Mi Empresa.
 * Server Component: obtiene los datos iniciales del servidor y los pasa
 * al formulario cliente, eliminando la necesidad de un fetch adicional.
 * Incluye, como sección dentro de la misma página, la configuración de
 * facturación fiscal cuando el plan del tenant tiene la feature
 * `facturacion-fiscal` (antes era una entrada separada del sidebar que
 * apuntaba a los mismos datos del emisor).
 *
 * @returns {Promise<JSX.Element>} Página de Mi Empresa
 */

export const metadata = {
  title: "Mi Empresa - FinanceMDM",
}

export default async function MiEmpresaConfigPage() {
  const [{ miEmpresa, cuentas }, user] = await Promise.all([
    getMiEmpresaPageData(),
    getCurrentUser(),
  ])

  const initialData = miEmpresa ? mapMiEmpresaApiToFormValues(miEmpresa) : undefined
  const activeCuentas = filterActiveCuentasBancarias(cuentas)

  const showFiscal = user ? hasFeature(user, "facturacion-fiscal") : false
  let fiscalInitial: {
    taxId: string | null
    razonSocial: string | null
    regimenFiscal: string | null
    codigoPostalFiscal: string | null
    fiscalActivado: boolean
  } | null = null
  if (showFiscal) {
    const r = await getFiscalConfigAction()
    fiscalInitial = r.success && r.data ? r.data : null
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi Empresa</h1>
        <p className="text-muted-foreground">
          Configura los datos que aparecen como beneficiario en facturas y documentos
        </p>
      </div>
      <MiEmpresaForm initialData={initialData} cuentas={activeCuentas} />

      {showFiscal && (
        <section id="facturacion-fiscal" className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Facturación fiscal</h2>
            <p className="text-sm text-muted-foreground">
              Datos del emisor usados por la capa fiscal de la jurisdicción del tenant.
            </p>
          </div>
          <FiscalConfigForm initial={fiscalInitial} />
        </section>
      )}
    </div>
  )
}
