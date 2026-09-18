import { getCurrentUser } from '@/lib/server-actions/get-current-user';
import { buildResumenCompleto } from '@/features/contabilidad/actions-resumen';
import { ResumenFinanciero } from '@/features/contabilidad/components/resumen-financiero';
import { getRangoPeriodo } from '@/features/contabilidad/lib/periodo-presets';

/**
 * @description Server Component que precarga el resumen del mes en curso y lo
 * entrega al panel interactivo. Si no hay sesión o el prefetch falla, degrada al
 * modo cliente (el componente traerá los datos vía server action).
 * Los cambios de período posteriores refrescan desde el cliente (1 request).
 * @returns {Promise<JSX.Element>} Panel de resumen con datos iniciales del servidor.
 */
export async function ResumenFinancieroServer(): Promise<React.JSX.Element> {
  const rango = getRangoPeriodo('mes', new Date());
  const propsBase = {
    periodo: rango.etiqueta,
    showPeriodSelector: true,
    page: 1,
    limit: 10,
  } as const;

  let initialData: unknown;

  const user = await getCurrentUser();
  if (user) {
    try {
      initialData = await buildResumenCompleto(
        { fechaInicio: rango.fechaInicio, fechaFin: rango.fechaFin },
        user,
      );
    } catch {
      initialData = undefined;
    }
  }

  return <ResumenFinanciero {...propsBase} initialData={initialData} />;
}
