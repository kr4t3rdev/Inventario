/**
 * @description Página de cuadre completo de un período contable.
 * Muestra balance, operaciones, resumen diario y gráficos financieros.
 * Solo accesible para períodos en estado ABIERTO o REABIERTO.
 *
 * @param {Object} params - Parámetros de ruta.
 * @param {string} params.periodoId - ID del período contable.
 * @returns {Promise<JSX.Element>} Página de cuadre del período.
 */
import { obtenerPeriodoAction } from "@/features/contabilidad/actions-periodos";
import { CuadrePeriodoPageClient } from "@/features/contabilidad/components/cuadre/cuadre-periodo-page-client";
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ periodoId: string }>;
}

export default async function CuadrePeriodoPage({ params }: PageProps) {
  const { periodoId } = await params;

  const result = await obtenerPeriodoAction(periodoId);

  if (!result.success) {
    redirect("/busy/contabilidad/periodos");
  }

  const periodo = result.data?.periodo;

  if (!periodo) {
    redirect("/busy/contabilidad/periodos");
  }

  const estadosValidos = ["ABIERTO", "REABIERTO"];
  if (!estadosValidos.includes(periodo.estado)) {
    redirect("/busy/contabilidad/periodos");
  }

  return (
    <div className="container mx-auto p-6">
      <CuadrePeriodoPageClient
        periodoId={periodoId}
        initialPeriodo={{
          periodoId: periodo.periodoId,
          codigo: periodo.codigo,
          tipo: periodo.tipo,
          estado: periodo.estado,
          modoContable: periodo.modoContable,
          fechaInicio: periodo.fechaInicio instanceof Date
            ? periodo.fechaInicio.toISOString()
            : String(periodo.fechaInicio),
          fechaFin: periodo.fechaFin instanceof Date
            ? periodo.fechaFin.toISOString()
            : String(periodo.fechaFin),
        }}
      />
    </div>
  );
}
