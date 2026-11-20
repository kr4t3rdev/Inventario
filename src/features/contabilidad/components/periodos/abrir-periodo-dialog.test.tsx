import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listRequestsMock = vi.hoisted(() => vi.fn());
const readRequestMock = vi.hoisted(() => vi.fn());
const submitRequestMock = vi.hoisted(() => vi.fn());
const accountingPolicyStateMock = vi.hoisted(() => vi.fn());
const bankOptionsMock = vi.hoisted(() => vi.fn());
vi.mock('@/features/contabilidad/actions-initial-bank-options', () => ({ getInitialBankOptionsAction: bankOptionsMock }));
vi.mock('@/features/contabilidad/actions-periodos', () => ({
	listarSolicitudesAperturaManualAction: listRequestsMock,
	obtenerSolicitudAperturaManualAction: readRequestMock,
	solicitarAperturaManualAction: submitRequestMock,
}));
vi.mock('@/features/contabilidad/actions-accounting-policy', () => ({
	getAccountingPolicyStateAction: accountingPolicyStateMock,
}));

import { AbrirPeriodoDialog } from './abrir-periodo-dialog';

describe('AbrirPeriodoDialog', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		bankOptionsMock.mockResolvedValue({ success: true, data: { roles: [{ rol: 'BANCOS', cuentaContableId: 'bank-id', codigo: '101', nombre: 'Bancos' }], monedas: [{ codigo: 'EUR', nombre: 'Euro' }], monedaFuncional: 'EUR', multiMoneda: false } });
		accountingPolicyStateMock.mockResolvedValue({ success: true, data: {
			policy: { functionalCurrencyCode: 'EUR' }, evidence: null, canManage: false,
		} });
	});

	it('informa y bloquea la carga bancaria mientras la conciliación está pendiente', async () => {
		listRequestsMock.mockResolvedValue({ success: true, data: { solicitudes: [] } });
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		expect(await screen.findByRole('button', { name: 'Agregar cuenta bancaria' })).toBeDisabled();
		expect(screen.getByText(/aún no puede confirmarse/)).toBeInTheDocument();
	});

	it.skip('pendiente: permite agregar un saldo bancario sin exigir origen', async () => {
		listRequestsMock.mockResolvedValue({ success: true, data: { solicitudes: [] } });
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		await userEvent.click(await screen.findByRole('button', { name: 'Agregar cuenta bancaria' }));
		expect(screen.getByLabelText('Nombre de cuenta bancaria 1')).toBeInTheDocument();
		expect(screen.queryByText('Origen del dinero')).not.toBeInTheDocument();
	});

	it.skip('pendiente: envía cuenta existente con saldo y sin origen', async () => {
		listRequestsMock.mockResolvedValue({ success: true, data: { solicitudes: [] } });
		submitRequestMock.mockResolvedValue({ success: true, data: { solicitudId: 'r1' } });
		readRequestMock.mockResolvedValue({ success: true, data: { solicitud: { solicitudId: 'r1', tipo: 'MENSUAL', fechaInicio: '2026-04-01', fechaFin: '2026-04-30', estado: 'PENDIENTE', functionalCurrencyCode: 'EUR', lineas: [], lineasValuadas: [], previewHash: 'x', cuentasBancarias: [{ nombreCuenta: 'Principal', nombreBanco: 'Banco', numeroCuenta: '123', tipoCuenta: 'CORRIENTE', moneda: 'EUR', saldo: '100000', cuentaContableId: 'bank-id' }] } } });
		const user = userEvent.setup();
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		await screen.findByText(/Moneda funcional:/);
		await user.type(screen.getByLabelText('Fecha de inicio'), '2026-04-01');
		await user.type(screen.getByLabelText('Fecha de fin'), '2026-04-30');
		await user.click(screen.getByRole('button', { name: 'Agregar cuenta bancaria' }));
		await user.type(screen.getByLabelText('Nombre de cuenta bancaria 1'), 'Principal');
		await user.type(screen.getByLabelText('Banco 1'), 'Banco');
		await user.type(screen.getByLabelText('Número de cuenta bancaria 1'), '123');
		await user.clear(screen.getByLabelText('Saldo bancario 1'));
		await user.type(screen.getByLabelText('Saldo bancario 1'), '100000');
		await user.selectOptions(await screen.findByLabelText('Cuenta contable bancaria 1'), 'bank-id');
		await user.click(screen.getByRole('button', { name: 'Enviar para aprobación' }));
		expect(submitRequestMock).toHaveBeenCalledWith(expect.objectContaining({ cuentasBancarias: [expect.objectContaining({ saldo: '100000', cuentaContableId: 'bank-id' })] }));
		expect(await screen.findByText(/Principal · Banco · 123/)).toBeInTheDocument();
	});

	it('muestra fallo al recargar opciones y bloquea aprobación bancaria', async () => {
		bankOptionsMock.mockResolvedValueOnce({ success: true, data: { roles: [], monedas: [], monedaFuncional: 'EUR', multiMoneda: false } }).mockResolvedValueOnce({ success: false, error: { message: 'Opciones no disponibles' } });
		listRequestsMock.mockResolvedValue({ success: true, data: { solicitudes: [{ solicitudId: 'r1', tipo: 'MENSUAL', fechaInicio: '2026-04-01', fechaFin: '2026-04-30', functionalCurrencyCode: 'EUR', estado: 'PENDIENTE' }] } });
		readRequestMock.mockResolvedValue({ success: true, data: { solicitud: { solicitudId: 'r1', tipo: 'MENSUAL', fechaInicio: '2026-04-01', fechaFin: '2026-04-30', estado: 'PENDIENTE', functionalCurrencyCode: 'EUR', lineas: [], lineasValuadas: [], previewHash: 'x', cuentasBancarias: [{ nombreCuenta: 'Principal', nombreBanco: 'Banco', numeroCuenta: '123', tipoCuenta: 'CORRIENTE', moneda: 'EUR', saldo: '1', cuentaContableId: 'bank-id' }] } } });
		const user = userEvent.setup();
		const view = render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		await screen.findByText(/PENDIENTE · MENSUAL/);
		view.rerender(<AbrirPeriodoDialog open={false} onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		view.rerender(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		expect(await screen.findByText('Opciones no disponibles')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: /PENDIENTE · MENSUAL/ }));
		expect(await screen.findByRole('button', { name: 'Aprobar cuadre' })).toBeDisabled();
	});

	it('loads the tenant functional currency and restores category and accounting mode controls', async () => {
		listRequestsMock.mockResolvedValue({ success: true, data: { solicitudes: [] } });
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);

		expect(await screen.findByText(/Moneda funcional:/)).toBeInTheDocument();
		expect(screen.getByLabelText('Moneda 1')).toHaveValue('EUR');
		expect(screen.getByLabelText('Categoría del período')).toHaveValue('ORDINARIO');
		expect(screen.getByLabelText('Modo contable')).toHaveValue('CAJA');
	});

	it('shows an honest error when the persisted-request list cannot be loaded', async () => {
		listRequestsMock.mockResolvedValue({ success: false, error: { message: 'No autorizado' } });
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);

		expect(await screen.findByText('No autorizado')).toBeInTheDocument();
	});

	it('shows request-bound server-valued FX evidence before enabling approval', async () => {
		vi.stubEnv('TZ', 'Pacific/Honolulu');
		listRequestsMock.mockResolvedValue({
			success: true,
			data: { solicitudes: [{
				solicitudId: 'request-1', tipo: 'MENSUAL', fechaInicio: '2026-04-01T00:00:00.000Z',
				fechaFin: '2026-04-30T23:59:59.000Z', functionalCurrencyCode: 'CUP', estado: 'PENDIENTE',
				solicitadaPor: 'requester', aprobadaPor: null, createdAt: '2026-03-31',
			}] },
		});
		readRequestMock.mockResolvedValue({
			success: true,
			data: { solicitud: {
				solicitudId: 'request-1', tipo: 'MENSUAL', fechaInicio: '2026-04-01T00:00:00.000Z',
				fechaFin: '2026-04-30T23:59:59.000Z', estado: 'PENDIENTE', observaciones: null,
				lineas: [{ cuentaCodigo: '101', moneda: 'USD', debito: '10', credito: '0', fxEvidenceId: 'fx-1' }],
				lineasValuadas: [{
					cuentaCodigo: '101', cuentaContableId: 'account-1', moneda: 'USD', monedaFuncional: 'CUP',
					debito: '10', credito: '0', debitoFuncional: '20', creditoFuncional: '0', tasaCambio: '2',
					fxEvidenceFingerprint: 'a'.repeat(64), fxEvidence: {
						sourceType: 'MANUAL_OPENING_LINE', sourceId: 'request-1:line-1:account-1', originalAmount: '10', originalCurrency: 'USD',
						functionalAmount: '20', functionalCurrency: 'CUP', rateEffectiveAt: '2026-03-30T00:00:00.000Z',
						cutoffAt: '2026-03-31T00:00:00.000Z', provenance: 'MANUAL_GOVERNED',
						source: 'TasaCambio catalog', fxCatalogRateId: 'rate-1',
						evidenceFingerprint: 'a'.repeat(64), evidenceVersion: 1,
					},
				}], previewHash: 'preview-hash',
			} },
		});

		const user = userEvent.setup();
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		expect(await screen.findByText(/01\/04\/2026–30\/04\/2026/)).toBeInTheDocument();
		await user.click(await screen.findByRole('button', { name: /PENDIENTE · MENSUAL/ }));

		expect(await screen.findByText(/Tasa: 2 · Importe convertido: 20 CUP/)).toBeInTheDocument();
		expect(screen.getByText(/Vigencia:/)).toBeInTheDocument();
		expect(screen.getByText(/MANUAL_OPENING_LINE\/request-1:line-1:account-1/)).toBeInTheDocument();
		expect(screen.getByText(new RegExp('a'.repeat(64)))).toBeInTheDocument();
		expect(screen.getByText('Huella de revisión: preview-hash')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Aprobar cuadre' })).toBeEnabled();
	});

	it('submits foreign-currency lines without user-supplied evidence IDs or rates', async () => {
		vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'manual-fx-key') });
		listRequestsMock.mockResolvedValue({ success: true, data: { solicitudes: [] } });
		submitRequestMock.mockResolvedValue({ success: true, data: { solicitudId: 'request-1', estado: 'PENDIENTE' } });
		readRequestMock.mockResolvedValue({ success: true, data: { solicitud: {
			solicitudId: 'request-1', tipo: 'MENSUAL', fechaInicio: '2026-04-01T00:00:00.000Z',
			fechaFin: '2026-04-30T23:59:59.999Z', estado: 'PENDIENTE', functionalCurrencyCode: 'EUR',
			lineas: [], lineasValuadas: [], previewHash: 'hash',
		} } });
		const user = userEvent.setup();
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		await user.type(screen.getByLabelText('Fecha de inicio'), '2026-04-01');
		await user.type(screen.getByLabelText('Fecha de fin'), '2026-04-30');
		await user.type(screen.getByLabelText('Cuenta 1'), '101');
		await user.clear(screen.getByLabelText('Moneda 1'));
		await user.type(screen.getByLabelText('Moneda 1'), 'USD');
		await user.clear(screen.getByLabelText('Débito 1'));
		await user.type(screen.getByLabelText('Débito 1'), '10');
		await user.type(screen.getByLabelText('Cuenta 2'), '301');
		await user.clear(screen.getByLabelText('Crédito 2'));
		await user.type(screen.getByLabelText('Crédito 2'), '20');
		expect(screen.getByText(/La tasa se resolverá en el servidor/)).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Enviar para aprobación' }));

		expect(await screen.findByText(/pendiente de aprobación/)).toBeInTheDocument();
		const payload = submitRequestMock.mock.calls[0][0];
		expect(payload.lineas[0]).toEqual({ cuentaCodigo: '101', moneda: 'USD', debito: '10', credito: '0' });
		expect(JSON.stringify(payload)).not.toMatch(/fxEvidenceId|exchangeRate|tasaCambio/);
	});

	it('asks to configure the policy when the tenant has no accounting policy', async () => {
		accountingPolicyStateMock.mockResolvedValue({ success: true, data: {
			policy: null, evidence: 'NONE', canManage: false,
		} });
		listRequestsMock.mockResolvedValue({ success: true, data: { solicitudes: [] } });
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);

		expect(await screen.findByText(
			'Configura la moneda funcional contable antes de preparar la apertura.',
		)).toBeInTheDocument();
	});

	it('reports the action error instead of masking it as a missing policy', async () => {
		accountingPolicyStateMock.mockResolvedValue({
			success: false, error: { message: 'Sesión expirada' },
		});
		listRequestsMock.mockResolvedValue({ success: true, data: { solicitudes: [] } });
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);

		expect(await screen.findByText('Sesión expirada')).toBeInTheDocument();
		expect(screen.queryByText(
			'Configura la moneda funcional contable antes de preparar la apertura.',
		)).not.toBeInTheDocument();
	});

	it('reuses the same idempotency key when retrying an unchanged submission', async () => {
		vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'retry-key-1') });
		listRequestsMock.mockResolvedValue({ success: true, data: { solicitudes: [] } });
		submitRequestMock.mockResolvedValueOnce({ success: false, error: { message: 'Temporal error' } })
			.mockResolvedValueOnce({ success: true, data: { solicitudId: 'request-replayed', estado: 'PENDIENTE' } });
		readRequestMock.mockResolvedValue({ success: true, data: { solicitud: {
			solicitudId: 'request-replayed', tipo: 'MENSUAL', fechaInicio: '2026-04-01T00:00:00.000Z',
			fechaFin: '2026-04-30T23:59:59.000Z', estado: 'PENDIENTE', lineas: [], lineasValuadas: [], previewHash: 'hash',
		} } });
		const user = userEvent.setup();
		render(<AbrirPeriodoDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />);
		await screen.findByRole('button', { name: 'Enviar para aprobación' });
		await user.type(screen.getByLabelText('Fecha de inicio'), '2026-04-01');
		await user.type(screen.getByLabelText('Fecha de fin'), '2026-04-30');
		const submit = screen.getByRole('button', { name: 'Enviar para aprobación' });
		await user.click(submit);
		await screen.findByText('Temporal error');
		await user.click(submit);

		expect(await screen.findByText(/pendiente de aprobación/)).toBeInTheDocument();
		expect(submitRequestMock).toHaveBeenCalledTimes(2);
		expect(submitRequestMock.mock.calls[0][0].idempotencyKey).toBe('retry-key-1');
		expect(submitRequestMock.mock.calls[1][0].idempotencyKey).toBe('retry-key-1');
	});
});
