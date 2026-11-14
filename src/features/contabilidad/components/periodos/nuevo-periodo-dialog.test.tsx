import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openPeriodMock = vi.hoisted(() => vi.fn());
vi.mock('@/features/contabilidad/actions-periodos', () => ({
	abrirPeriodoAction: openPeriodMock,
}));

import { NuevoPeriodoDialog } from './nuevo-periodo-dialog';

describe('NuevoPeriodoDialog', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('opens the period through the automatic continuity action', async () => {
		openPeriodMock.mockResolvedValue({ success: true, data: { periodo: { periodoId: 'p-2' } } });
		const onOpenChange = vi.fn();
		const onSuccess = vi.fn();
		const user = userEvent.setup();
		render(<NuevoPeriodoDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />);

		expect(screen.getByRole('dialog')).toHaveTextContent(/continuidad de CxC, CxP, bancos/);
		await user.selectOptions(screen.getByLabelText('Tipo de período'), 'MENSUAL');
		await user.type(screen.getByLabelText('Fecha de inicio'), '2026-05-01');
		await user.type(screen.getByLabelText('Fecha de fin'), '2026-05-31');
		await user.click(screen.getByRole('button', { name: 'Abrir período y trasladar saldos' }));

		expect(openPeriodMock).toHaveBeenCalledWith(expect.objectContaining({
			tipo: 'MENSUAL',
			fechaInicio: '2026-05-01T00:00:00.000Z',
			fechaFin: '2026-05-31T23:59:59.999Z',
			categoria: 'ORDINARIO',
			modoContable: 'CAJA',
		}));
		expect(onSuccess).toHaveBeenCalledOnce();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('keeps the dialog open and shows the server error when opening fails', async () => {
		openPeriodMock.mockResolvedValue({ success: false, error: { message: 'Moneda funcional no configurada' } });
		const user = userEvent.setup();
		render(<NuevoPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		await user.type(screen.getByLabelText('Fecha de inicio'), '2026-05-01');
		await user.type(screen.getByLabelText('Fecha de fin'), '2026-05-31');
		await user.click(screen.getByRole('button', { name: 'Abrir período y trasladar saldos' }));

		expect(await screen.findByText('Moneda funcional no configurada')).toBeInTheDocument();
	});
});
