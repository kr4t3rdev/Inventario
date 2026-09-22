/**
 * @description Contratos de las actions de libros (CTA-2 T5): feature guard,
 * tenant-scope y validación Zod de filtros.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
	cuentaContable: { findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const diarioMock = vi.hoisted(() => vi.fn());
const mayorMock = vi.hoisted(() => vi.fn());
const comprobacionMock = vi.hoisted(() => vi.fn());
const conciliacionMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/services/libro-diario-service', () => ({
	obtenerLibroDiario: diarioMock,
}));
vi.mock('@/features/contabilidad-formal/services/libro-mayor-service', () => ({
	obtenerLibroMayor: mayorMock,
}));
vi.mock('@/features/contabilidad-formal/services/balance-comprobacion-service', () => ({
	obtenerBalanceComprobacion: comprobacionMock,
}));
vi.mock('@/features/contabilidad-formal/services/conciliacion-cruzada-service', () => ({
	obtenerConciliacionCruzada: conciliacionMock,
}));

const usuarioBase = {
	userId: 'u1',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	role: 'user',
	isActive: true,
	name: 'Gestor',
	email: 'g@example.com',
	planFeatures: { 'contabilidad-formal': true },
};

let usuarioActual: typeof usuarioBase = usuarioBase;

vi.mock('@/lib/server-actions', () => ({
	ActionError: class ActionError extends Error {
		constructor(message: string, public readonly code: string) {
			super(message);
		}
	},
	withAction:
		(callback: (input: unknown, actor: typeof usuarioBase) => Promise<unknown>) =>
		(input: unknown) =>
			callback(input, usuarioActual)
				.then((data) => ({ success: true as const, data }))
				.catch((error: { message: string; code?: string; name?: string }) => ({
					success: false as const,
					error: {
						message: error.name === 'ZodError' ? 'Datos inválidos' : error.message,
						code: error.name === 'ZodError' ? 'VALIDATION_ERROR' : error.code,
					},
				})),
}));

describe('actions de libros (CTA-2)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		usuarioActual = usuarioBase;
		diarioMock.mockResolvedValue({ asientos: [], total: 0 });
		comprobacionMock.mockResolvedValue({ filas: [], totales: {} });
		conciliacionMock.mockResolvedValue({ rubros: [] });
	});

	it('libro diario: pasa filtros validados al servicio', async () => {
		const { getLibroDiarioAction } = await import('@/features/contabilidad-formal/actions-libros');
		const respuesta = await getLibroDiarioAction({ periodoId: 'per-1', page: 2, limit: 25 });
		expect(respuesta.success).toBe(true);
		expect(diarioMock).toHaveBeenCalledWith(
			'tenant-1',
			expect.objectContaining({ periodoId: 'per-1', page: 2, limit: 25 }),
		);
	});

	it('libro diario: rechaza sin tenant', async () => {
		usuarioActual = { ...usuarioBase, tenantId: null as unknown as string };
		const { getLibroDiarioAction } = await import('@/features/contabilidad-formal/actions-libros');
		const respuesta = await getLibroDiarioAction({});
		expect(respuesta.success).toBe(false);
		expect(diarioMock).not.toHaveBeenCalled();
	});

	it('libro mayor: exige cuentaId y fechas', async () => {
		const { getLibroMayorAction } = await import('@/features/contabilidad-formal/actions-libros');
		const invalida = await getLibroMayorAction({ cuentaId: '', fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' });
		expect(invalida.success).toBe(false);
		mayorMock.mockResolvedValue({ movimientos: [], saldoInicial: 0, saldoFinal: 0 });
		const valida = await getLibroMayorAction({
			cuentaId: 'cta-1',
			fechaDesde: '2026-09-01',
			fechaHasta: '2026-09-30',
		});
		expect(valida.success).toBe(true);
		expect(mayorMock).toHaveBeenCalledWith(
			'tenant-1',
			expect.objectContaining({ cuentaId: 'cta-1' }),
		);
	});

	it('comprobación y conciliación usan el feature guard', async () => {
		const { getBalanceComprobacionAction, getConciliacionCruzadaAction } = await import(
			'@/features/contabilidad-formal/actions-libros'
		);
		usuarioActual = { ...usuarioBase, planFeatures: {} };
		const sinFeature = await getBalanceComprobacionAction({});
		expect(sinFeature.success).toBe(false);
		expect(sinFeature.error?.code).toBe('FEATURE_NOT_AVAILABLE');
		usuarioActual = usuarioBase;
		const sinInput = await getConciliacionCruzadaAction();
		expect(sinInput.success).toBe(true);
		expect(conciliacionMock).toHaveBeenCalledWith('tenant-1', {});
	});

	it('getCuentasMayorablesAction devuelve solo hojas activas del tenant', async () => {
		prismaMock.cuentaContable.findMany.mockResolvedValue([
			{ cuentaContableId: 'cta-1', codigo: '1.1.01', nombre: 'Caja general', tipo: 'ACTIVO' },
		]);
		const { getCuentasMayorablesAction } = await import(
			'@/features/contabilidad-formal/actions-libros'
		);
		const respuesta = await getCuentasMayorablesAction();
		expect(respuesta.success).toBe(true);
		expect(prismaMock.cuentaContable.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					tenantId: 'tenant-1',
					aceptaMovimiento: true,
					activa: true,
				}),
			}),
		);
		expect(respuesta.data).toEqual([
			{ cuentaId: 'cta-1', codigo: '1.1.01', nombre: 'Caja general', tipo: 'ACTIVO' },
		]);
	});
});
