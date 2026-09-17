/**
 * @description Página del reporte mensual de comisiones (Gap 5 / CMV-T3).
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-actions';
import { hasPermission } from '@/lib/services/tenant-scope';
import { ComisionesMesClient } from '@/features/empleados/components/comisiones-mes';

export const metadata = { title: 'Comisiones del mes — FinanceMDM' };

/**
 * @description Reporte mensual de comisiones por empleado. Solo accesible al
 * manager (permiso rrhh.comisiones.gestionar).
 * @returns {Promise<JSX.Element>} Página o redirección.
 */
export default async function ComisionesMesPage() {
	const user = await getCurrentUser();
	if (!user) redirect('/auth/signin');
	if (!hasPermission(user, 'rrhh.comisiones.gestionar')) {
		redirect('/busy/empleados');
	}
	return <ComisionesMesClient />;
}
