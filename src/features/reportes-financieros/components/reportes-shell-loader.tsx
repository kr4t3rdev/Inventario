import { Skeleton } from "@/components/ui/skeleton";

interface ReportesShellLoaderProps {
  /** Cantidad de tarjetas KPI esqueleto en la fila intermedia (3 o 4). */
  kpis?: 3 | 4;
}

/**
 * @description Loader compartido para las páginas shell de reportes (inventario,
 *   venta diaria y contabilidad). Replica la estructura: encabezado, fila de
 *   badges/KPIs y contenido principal.
 * @param {ReportesShellLoaderProps} props - Variante del esqueleto.
 * @returns {JSX.Element} Esqueleto de página de reportes.
 */
export function ReportesShellLoader({ kpis = 3 }: ReportesShellLoaderProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-4 w-lg max-w-full" />
      </div>
      <div
        className={
          kpis === 4 ? "grid gap-4 md:grid-cols-4" : "grid gap-4 md:grid-cols-3"
        }
      >
        {Array.from({ length: kpis }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-160 w-full rounded-2xl" />
    </div>
  );
}
