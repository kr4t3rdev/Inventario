import { notFound } from "next/navigation";

import { getCierreByIdAction } from "@/features/contabilidad/actions-cierres";
import { CierreDetailsPageClient } from "@/features/contabilidad/components/cierres/CierreDetailsPageClient";


export const metadata = {
  title: "Detalle de Cierre - FinanceTCP",
}

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * @description Página de detalle de un cierre contable específico.
 * Resuelve el cierre en servidor y delega la interacción al cliente.
 *
 * @param {Props} props - Parámetros de ruta de la página.
 * @returns {Promise<JSX.Element>} Vista de detalle del cierre.
 */
export default async function CierreDetailsPage({ params }: Props) {
  const { id: cierreId } = await params;
  const result = await getCierreByIdAction(cierreId);

  if (!result.success || !result.data) {
    notFound();
  }

  const cierre = result.data;

  // @ts-expect-error
  return <CierreDetailsPageClient cierre={
  cierre
  } />;
}