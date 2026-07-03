/**
 * @description Página de gestión de períodos contables.
 * Obtiene la lista inicial desde Server Action y la entrega al componente cliente.
 *
 * @returns {Promise<JSX.Element>} Vista de períodos contables.
 */
import { redirect } from "next/navigation";
import { listarPeriodosAction } from "@/features/contabilidad/actions-periodos";
import { PeriodosPageClient } from "@/features/contabilidad/components/periodos/periodos-page-client";
import { hasPlanFeature } from "@/lib/plan-access";
import { getCurrentUser } from "@/lib/server-actions";

export const metadata = {
  title: "Períodos Contables - FinanceMDM",
};

export default async function PeriodosPage() {
  const user = await getCurrentUser();

  if (user?.role !== "admin" && !hasPlanFeature(user, "contabilidad")) {
    redirect("/busy/contabilidad");
  }

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
