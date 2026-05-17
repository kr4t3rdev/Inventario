/**
 * @description Página de edición de Gasto de Explotación (Server Component).
 *
 * Resuelve en el servidor:
 * - Datos del gasto a editar
 * - Lista de proveedores (vendors) para el formulario
 *
 * El formulario (GastoDEForm) es un Client Component que recibe los datos iniciales.
 */
import { getGastoDEByIdAction } from "@/features/gastosDE/actions"
import { getVendorsAction } from "@/features/vendors/actions"
import { GastoDEForm } from "@/features/gastosDE"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { notFound } from "next/navigation"


export const metadata = {
  title: "Editar Gasto D/E - FinanceTCP",
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarGastoDEPage({ params }: Props) {
  const { id: gastosDEId } = await params

  // ── Resolver datos en paralelo en el servidor ──
  const [gastoDEResult, vendorsResult] = await Promise.all([
    getGastoDEByIdAction(gastosDEId),
    getVendorsAction(),
  ])

  if (!gastoDEResult.success || !gastoDEResult.data) {
    notFound()
  }

  const gastoDE = gastoDEResult.data
  const initialVendors = vendorsResult.success ? vendorsResult.data ?? [] : []

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto py-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Editar Gasto de Explotación</h1>
            <p className="text-muted-foreground">Modifique los datos de los Gasto de Explotación</p>
          </div>
          <GastoDEForm 
            initialData={{
              gastosDEId: gastoDE.gastosDEId,
              tipo: gastoDE.tipo,
              conceptoId: gastoDE.conceptoId,
              elementoId: gastoDE.elementoId,
              numeroFactura: gastoDE.numeroFactura,
              proveedor: gastoDE.proveedor,
              monto: gastoDE.monto,
              descripcion: gastoDE.descripcion,
              periodo: gastoDE.periodo,
            }}
            initialVendors={initialVendors}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
