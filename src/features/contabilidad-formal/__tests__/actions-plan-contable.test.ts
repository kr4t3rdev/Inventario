/**
 * @description Contratos de las server actions de activación del plan de
 * cuentas (CTA-0 T4). El seed se ejecuta dentro de una transacción y la
 * lectura de estado siempre filtra por el tenant del usuario autenticado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const usuarioSinFeature = {
	userId: 'user-1',
	tenantId: 'tenant-1',
	tenantRole: 'manager',
	role: 'user',
	isActive: true,
	name: 'Manager',
	email: 'm@example.com',
	planFeatures: {},
};

const usuarioConFeature = {
	...usuarioSinFeature,
	planFeatures: { 'contabilidad-formal': true },
};

let usuarioActual = usuarioConFeature;

const seedPlanMock = vi.hoisted(() => vi.fn());
const seedPlantillasMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
	cuentaContable: { count: vi.fn() },
	cuentaRolTenant: { count: vi.fn() },
	diario: { count: vi.fn() },
	$transaction: vi.fn(),
}));

vi.mock('@/lib/server-actions', () => ({
	ActionError: class ActionError extends Error {
		constructor(
			message: string,
			public readonly code: string,
		) {
			super(message);
		}
	},
	withAction:
		(callback: (input: unknown, actor: typeof usuarioConFeature) => Promise<unknown>) =>
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

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock(
	'@/features/contabilidad-formal/services/seed-plan-contable',
	() => ({
		seedPlanContable: seedPlanMock,
		seedPlantillasGlobales: seedPlantillasMock,
	}),
);

describe('inicializarPlanContableAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		usuarioActual = usuarioConFeature;
		seedPlanMock.mockResolvedValue({ diarios: 7, cuentas: 33, roles: 23 });
		seedPlantillasMock.mockResolvedValue({ plantillas: 82 });
		prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
	});

	it('siembra plan y plantillas dentro de una transacción y devuelve conteos', async () => {
		const { inicializarPlanContableAction } = await import(
			'@/features/contabilidad-formal/actions'
		);

		const respuesta = await inicializarPlanContableAction(undefined);

		expect(respuesta.success).toBe(true);
		// Una transacción para las plantillas globales y otra para el plan del tenant.
		expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
		expect(seedPlanMock).toHaveBeenCalledWith(prismaMock, 'tenant-1');
		expect(seedPlantillasMock).toHaveBeenCalledWith(prismaMock);
		expect(respuesta.data).toMatchObject({ diarios: 7, cuentas: 33, roles: 23, plantillas: 82 });
	});

	it('rechaza sin tenant en contexto', async () => {
		usuarioActual = { ...usuarioConFeature, tenantId: null as unknown as string };
		const { inicializarPlanContableAction } = await import(
			'@/features/contabilidad-formal/actions'
		);

		const respuesta = await inicializarPlanContableAction(undefined);

		expect(respuesta.success).toBe(false);
		expect(seedPlanMock).not.toHaveBeenCalled();
	});

	it('rechaza sin el feature contabilidad-formal', async () => {
		usuarioActual = usuarioSinFeature;
		const { inicializarPlanContableAction } = await import(
			'@/features/contabilidad-formal/actions'
		);

		const respuesta = await inicializarPlanContableAction(undefined);

		expect(respuesta.success).toBe(false);
		expect(respuesta.error?.code).toBe('FEATURE_NOT_AVAILABLE');
		expect(seedPlanMock).not.toHaveBeenCalled();
	});

	it('propaga errores del seed sin romper el contrato de respuesta', async () => {
		seedPlanMock.mockRejectedValue(new Error('fallo de conexión'));
		const { inicializarPlanContableAction } = await import(
			'@/features/contabilidad-formal/actions'
		);

		const respuesta = await inicializarPlanContableAction(undefined);

		expect(respuesta.success).toBe(false);
	});
});

describe('obtenerEstadoPlanContableAction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		usuarioActual = usuarioConFeature;
		prismaMock.cuentaContable.count.mockResolvedValue(33);
		prismaMock.cuentaRolTenant.count.mockResolvedValue(23);
		prismaMock.diario.count.mockResolvedValue(7);
	});

	it('devuelve conteos filtrados por el tenant del usuario', async () => {
		const { obtenerEstadoPlanContableAction } = await import(
			'@/features/contabilidad-formal/actions'
		);

		const respuesta = await obtenerEstadoPlanContableAction(undefined);

		expect(respuesta.success).toBe(true);
		expect(respuesta.data).toEqual({
			inicializado: true,
			cuentas: 33,
			roles: 23,
			diarios: 7,
		});
		expect(prismaMock.cuentaContable.count).toHaveBeenCalledWith({
			where: { tenantId: 'tenant-1' },
		});
		expect(prismaMock.cuentaRolTenant.count).toHaveBeenCalledWith({
			where: { tenantId: 'tenant-1' },
		});
	});

	it('reporta no inicializado cuando no hay cuentas', async () => {
		prismaMock.cuentaContable.count.mockResolvedValue(0);
		const { obtenerEstadoPlanContableAction } = await import(
			'@/features/contabilidad-formal/actions'
		);

		const respuesta = await obtenerEstadoPlanContableAction(undefined);

		expect(respuesta.success).toBe(true);
		expect(respuesta.data).toMatchObject({ inicializado: false, cuentas: 0 });
	});
});
