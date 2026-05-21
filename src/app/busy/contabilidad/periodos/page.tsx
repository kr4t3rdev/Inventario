/**
 * @description Página de gestión de períodos contables.
 * Obtiene la lista inicial desde Server Action y la entrega al componente cliente.
 *
 * @returns {Promise<JSX.Element>} Vista de períodos contables.
 */
import { listarPeriodosAction } from "@/features/contabilidad/actions-periodos";
import { PeriodosPageClient } from "@/features/contabilidad/components/periodos/periodos-page-client";

export const metadata = {
  title: "Períodos Contables - FinanceTCP",
};

export default async function PeriodosPage() {
  const result = await listarPeriodosAction({ limit: 100 });
  const periodos = result.success ? (result.data?.periodos ?? []) : [];
  const pagination = result.success ? (result.data?.pagination ?? null) : null;

  return (
    <div className="container mx-auto p-6">
      <PeriodosPageClient
        initialPeriodos={periodos}
        initialPagination={pagination}
      />
    </div>
  );
}
