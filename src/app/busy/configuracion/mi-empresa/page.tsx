import { MiEmpresaForm } from "@/features/mi-empresa/components/mi-empresa-form"
import { getMiEmpresaPageData } from "@/features/mi-empresa/server/data"
import {
  mapMiEmpresaApiToFormValues,
  filterActiveCuentasBancarias,
} from "@/features/mi-empresa/lib/miEmpresaUtils"

/**
 * @description Página de configuración de Mi Empresa.
 * Server Component: obtiene los datos iniciales del servidor y los pasa
 * al formulario cliente, eliminando la necesidad de un fetch adicional.
 *
 * @returns {Promise<JSX.Element>} Página de Mi Empresa
 */

export const metadata = {
  title: "Mi Empresa - FinanceTCP",
}

export default async function MiEmpresaConfigPage() {
  const { miEmpresa, cuentas } = await getMiEmpresaPageData()

  const initialData = miEmpresa ? mapMiEmpresaApiToFormValues(miEmpresa) : undefined
  const activeCuentas = filterActiveCuentasBancarias(cuentas)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi Empresa</h1>
        <p className="text-muted-foreground">
          Configura los datos que aparecen como beneficiario en facturas y documentos
        </p>
      </div>
      <MiEmpresaForm initialData={initialData} cuentas={activeCuentas} />
    </div>
  )
}
