/**
 * @description Página principal de cierres contables.
 * Obtiene la lista inicial desde Server Action y la entrega al manager client.
 *
 * @returns {Promise<JSX.Element>} Vista principal de cierres.
 */
import { getCierresAction } from "@/features/contabilidad/actions-cierres";
import { CierresManager } from "@/features/contabilidad/components/cierres/CierresManager";


export const metadata = {
  title: "Cierres - FinanceMDM",
}

export default async function CierresPage() {
  const result = await getCierresAction();
  // @ts-expect-error TODO: fix type cast for CierreContableItem array
  const cierres: CierreContableItem[] = (result.success ? (result.data ?? []) : []) as unknown as CierreContableItem[];

  return (
    <div className="container mx-auto p-6">
      <CierresManager cierres={cierres} />
    </div>
  );
}