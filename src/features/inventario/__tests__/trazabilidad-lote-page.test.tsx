/**
 * @description Pruebas de la ruta de trazabilidad de un lote.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/inventario/components/trazabilidad-lote-panel', () => ({
	TrazabilidadLotePanel: ({ loteId }: { loteId: string }) => <div>Panel de {loteId}</div>,
}));

import TrazabilidadLotePage from '@/app/busy/inventario/lotes/[loteId]/page';

describe('TrazabilidadLotePage', () => {
	it('renderiza el panel con el lote indicado en la ruta', async () => {
		const pagina = await TrazabilidadLotePage({
			params: Promise.resolve({ loteId: 'lote-1' }),
		});

		render(pagina);

		expect(screen.getByText('Panel de lote-1')).toBeInTheDocument();
	});
});
