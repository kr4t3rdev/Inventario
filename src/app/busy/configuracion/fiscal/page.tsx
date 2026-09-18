/**
 * @description Configuración fiscal del tenant (Gap 4): datos del emisor.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/server-actions';
import { hasFeature } from '@/lib/services/tenant-scope';
import { getFiscalConfigAction } from '@/features/facturas/actions-fiscal-config';
import { FiscalConfigForm } from '@/features/facturas/components/fiscal-config-form';

export const metadata = { title: 'Facturación fiscal - FinanceMDM' };

/**
 * @description Página de configuración de facturación fiscal.
 * @returns {Promise<JSX.Element>} Formulario de datos del emisor o redirección.
 */
export default async function ConfiguracionFiscalPage() {
	const user = await getCurrentUser();
	if (!user) redirect('/auth/signin');
	if (!hasFeature(user, 'facturacion-fiscal')) {
		redirect('/busy/configuracion/mi-empresa');
	}

	const r = await getFiscalConfigAction();
	const initial = r.success && r.data ? r.data : null;

	return (
		<div className="container mx-auto max-w-3xl py-6 space-y-4">
			<div>
				<h1 className="text-2xl font-bold">Facturación fiscal</h1>
				<p className="text-sm text-muted-foreground">
					Datos del emisor usados por la capa fiscal de la jurisdicción del tenant.
				</p>
			</div>
			<FiscalConfigForm initial={initial} />
		</div>
	);
}
