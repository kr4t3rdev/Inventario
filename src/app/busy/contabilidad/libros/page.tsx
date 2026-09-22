import type { Metadata } from 'next';

import { LibrosPageClient } from '@/features/contabilidad-formal/components/libros-page-client';

export const metadata: Metadata = {
	title: 'Libros contables',
	description:
		'Libro diario, libro mayor, balance de comprobación y conciliación entre la base caja y los asientos contables.',
};

/**
 * @description Página de libros contables formales (capa contabilidad-formal).
 * @returns {JSX.Element} Vista de libros.
 */
export default function LibrosContablesPage(): JSX.Element {
	return <LibrosPageClient />;
}
