import SeriesFacturacionTable from "@/components/series-facturacion/series-facturacion-table"

/**
 * @description Página de gestión de series de facturación
 * @returns {JSX.Element} Página de series de facturación
 */
export default function SeriesFacturacionPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Series de Facturación</h1>
        <p className="text-muted-foreground">
          Gestiona las series de facturación para diferentes tipos de documentos (ventas, servicios, notas de crédito)
        </p>
      </div>
      <SeriesFacturacionTable />
    </div>
  )
}