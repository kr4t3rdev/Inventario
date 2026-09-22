/**
 * @description Contratos del motor de asientos (CTA-1 T1/T2).
 * El motor corre dentro de la transacción del writer, con los servicios de
 * período y lock mockeados: plantillas y roles se alimentan desde los datos
 * reales por defecto para ejercitar el mapeo completo (evento → líneas).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	PLANTILLAS_DEFAULT,
	ROLES_CUENTA_DEFAULT,
	type PlantillaLineaDefault,
	type TipoEventoClave,
} from '@/features/contabilidad-formal/lib/plan-default';
import {
	postEvento,
	type AuxiliaresEvento,
	type EventoContableInput,
	type PostingTx,
} from '@/features/contabilidad-formal/services/posting-engine';

const TENANT = 'tenant-motor';
const MODO_ENV = 'CONTABILIDAD_FORMAL_MODE';

const guardMock = vi.hoisted(() => vi.fn());
const resolverMock = vi.hoisted(() => vi.fn());
const lockMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/periodo-contable-guard', () => ({
	PeriodoGuard: { assertWritable: guardMock },
}));

vi.mock('@/lib/services/periodo-contable-service', () => ({
	PeriodoContableService: { resolverPeriodoActivo: resolverMock },
}));

vi.mock('@/features/contabilidad/services/accounting-tenant-lock-service', () => ({
	withAccountingTenantLock: lockMock,
}));

interface CtxFixture {
	tx: PostingTx;
	crearAsiento: ReturnType<typeof vi.fn>;
	setModo: (modo: string) => void;
	setPlantillas: (lineas: PlantillaLineaDefault[]) => void;
	unicoAsiento: { asientoId: string } | null;
	maxNumero: number | null;
	ultimoAsiento: { hash: string } | null;
	rolesVacios: boolean;
}

/**
 * @description Construye el tx mockeado con las fixtures configurables del caso.
 */
function crearFixture(): CtxFixture {
	const state = {
		unicoAsiento: null as { asientoId: string } | null,
		maxNumero: null as number | null,
		ultimoAsiento: null as { hash: string } | null,
		rolesVacios: false,
		plantillas: PLANTILLAS_DEFAULT,
	};

	const crearAsiento = vi.fn(async () => ({ asientoId: 'ast-nuevo' }));

	const tx: PostingTx = {
		cuentaRolTenant: {
			findMany: vi.fn(async () => {
				if (state.rolesVacios) return [];
				return Object.entries(ROLES_CUENTA_DEFAULT).map(([rol, codigo]) => ({
					rol,
					cuenta: {
						cuentaContableId: `cta-${codigo}`,
						aceptaMovimiento: true,
						activa: true,
					},
				}));
			}),
		},
		plantillaAsiento: {
			findMany: vi.fn(async (args: { where: { evento: string; activa: boolean } }) =>
				state.plantillas
					.filter(
						(linea) => linea.evento === args.where.evento,
					)
					.sort((a, b) => a.orden - b.orden),
			),
		},
		diario: {
			findFirst: vi.fn(async (args: { where: { tipo: string } }) => ({
				diarioId: `dia-${args.where.tipo}`,
			})),
		},
		asiento: {
			findUnique: vi.fn(async () => state.unicoAsiento),
			aggregate: vi.fn(async () => ({ _max: { numero: state.maxNumero } })),
			findFirst: vi.fn(async () => state.ultimoAsiento),
			create: crearAsiento,
		},
	} as unknown as PostingTx;

	return {
		tx,
		crearAsiento,
		setModo: (modo: string) => {
			process.env[MODO_ENV] = modo;
		},
		setPlantillas: (lineas: PlantillaLineaDefault[]) => {
			state.plantillas = lineas;
		},
		get unicoAsiento() {
			return state.unicoAsiento;
		},
		set unicoAsiento(valor) {
			state.unicoAsiento = valor;
		},
		get maxNumero() {
			return state.maxNumero;
		},
		set maxNumero(valor) {
			state.maxNumero = valor;
		},
	get ultimoAsiento() {
			return state.ultimoAsiento;
		},
		set ultimoAsiento(valor) {
			state.ultimoAsiento = valor;
		},
		get rolesVacios() {
			return state.rolesVacios;
		},
		set rolesVacios(valor: boolean) {
			state.rolesVacios = valor;
		},
	};
}

/**
 * @description Evento base válido en moneda funcional.
 */
function eventoBase(extra: Partial<EventoContableInput> = {}): EventoContableInput {
	return {
		tipo: 'VENTA_CONTADO',
		fecha: new Date('2026-09-21T15:00:00Z'),
		descripcion: 'Venta mostrador 1001',
		origen: { tipo: 'venta', id: 'venta-1' },
		monto: 1000,
		moneda: 'CUP',
		monedaFuncional: 'CUP',
		tasaCambio: null,
		montoFuncional: 1000,
		...extra,
	};
}

type LineaCreada = { cuentaId: string; debe: number; haber: number };

function lineasDe(crearAsiento: ReturnType<typeof vi.fn>): LineaCreada[] {
	return crearAsiento.mock.calls[0][0].data.lineas.create;
}

describe('postEvento — modos y guardas', () => {
	let fixture: CtxFixture;

	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env[MODO_ENV];
		fixture = crearFixture();
		guardMock.mockResolvedValue({ permitido: true, modo: 'audit-only' });
		resolverMock.mockResolvedValue({
			estado: 'ABIERTO',
			esWritable: true,
			periodo: { periodoId: 'per-1' },
		});
		lockMock.mockImplementation(
			async (_tx: unknown, _tenant: string, operacion: () => Promise<unknown>) =>
				operacion(),
		);
	});

	it('modo off: no toca la base de datos', async () => {
		fixture.setModo('off');
		const resultado = await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		);
		expect(resultado.estado).toBe('OMITIDO');
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('tenant sin plan inicializado: se omite incluso en enforce', async () => {
		fixture.setModo('enforce');
		fixture.rolesVacios = true;
		const resultado = await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		);
		expect(resultado.estado).toBe('OMITIDO');
		expect(resultado.motivo).toBe('PLAN_NO_INICIALIZADO');
	});

	it('idempotencia: evento ya asentado no crea un segundo asiento', async () => {
		fixture.setModo('enforce');
		fixture.unicoAsiento = { asientoId: 'ast-previo' };
		const resultado = await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		);
		expect(resultado.estado).toBe('YA_EXISTENTE');
		expect(resultado.asientoId).toBe('ast-previo');
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('período cerrado: enforce rechaza con PERIODO_CERRADO y shadow solo registra', async () => {
		guardMock.mockResolvedValue({
			permitido: false,
			codigo: 'PERIODO_CERRADO',
			modo: 'enforce',
		});
		fixture.setModo('enforce');
		await expect(
			postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase()),
		).rejects.toMatchObject({ code: 'PERIODO_CERRADO' });

		fixture.setModo('shadow');
		const resultado = await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		);
		expect(resultado.estado).toBe('ERROR_SHADOW');
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('asiento descuadrado: enforce lanza ASIENTO_DESCUADRADO y shadow no persiste', async () => {
		fixture.setPlantillas([
			{
				evento: 'VENTA_CONTADO',
				orden: 1,
				lado: 'DEBE',
				rolCuenta: 'CAJA_PRINCIPAL',
				montoRegla: 'TOTAL',
			},
			{
				evento: 'VENTA_CONTADO',
				orden: 2,
				lado: 'HABER',
				rolCuenta: 'VENTAS_PRODUCTOS',
				montoRegla: 'MONTO_PAGADO',
			},
		]);
		fixture.setModo('enforce');
		await expect(
			postEvento(
				fixture.tx,
				{ tenantId: TENANT, userId: 'u1' },
				eventoBase({ auxiliares: { montoPagado: 700 } }),
			),
		).rejects.toMatchObject({ code: 'ASIENTO_DESCUADRADO' });

		fixture.setModo('shadow');
		const resultado = await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({ auxiliares: { montoPagado: 700 } }),
		);
		expect(resultado.estado).toBe('ERROR_SHADOW');
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});
});

describe('postEvento — generación de líneas', () => {
	let fixture: CtxFixture;

	beforeEach(() => {
		vi.clearAllMocks();
		fixture = crearFixture();
		fixture.setModo('enforce');
		guardMock.mockResolvedValue({ permitido: true, modo: 'enforce' });
		resolverMock.mockResolvedValue({
			estado: 'ABIERTO',
			esWritable: true,
			periodo: { periodoId: 'per-1' },
		});
		lockMock.mockImplementation(
			async (_tx: unknown, _tenant: string, operacion: () => Promise<unknown>) =>
				operacion(),
		);
	});

	it('venta al contado: asiento cuadrado en diario de ventas con numeración 1', async () => {
		const resultado = await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		);

		expect(resultado.estado).toBe('CONTABILIZADO');
		expect(resultado.asientoId).toBe('ast-nuevo');

		const data = fixture.crearAsiento.mock.calls[0][0].data;
		expect(data.numero).toBe(1);
		expect(data.diarioId).toBe('dia-VENTAS');
		expect(data.periodoId).toBe('per-1');
		expect(data.tenantId).toBe(TENANT);
		expect(data.origenTipo).toBe('venta');
		expect(data.origenId).toBe('venta-1');
		expect(/^[0-9a-f]{64}$/.test(data.hash)).toBe(true);
		expect(data.hashAnterior).toBeNull();

		const debe = lineasDe(fixture.crearAsiento).find((l) => l.debe > 0);
		const haber = lineasDe(fixture.crearAsiento).find((l) => l.haber > 0);
		expect(debe?.cuentaId).toBe('cta-1.1.01');
		expect(haber?.cuentaId).toBe('cta-4.1');
		expect(debe?.debe).toBe(1000);
		expect(haber?.haber).toBe(1000);
		expect(lockMock).toHaveBeenCalledOnce();
	});

	it('medio bancario sustituye CAJA_PRINCIPAL por BANCOS', async () => {
		await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({ medioCobro: 'BANCOS' }),
		);
		const debe = lineasDe(fixture.crearAsiento).find((l) => l.debe > 0);
		expect(debe?.cuentaId).toBe('cta-1.1.02');
	});

	it('cobro con diferencia cambiaria favorable genera línea de ingreso cambiario', async () => {
		const auxiliares: AuxiliaresEvento = { diferenciaFx: 100 };
		await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({
				tipo: 'COBRO_CXC',
				origen: { tipo: 'reconciliacion_venta', id: 'rec-9' },
				monto: 25,
				moneda: 'USD',
				tasaCambio: 44,
				montoFuncional: 1100,
				fxEvidenceFingerprint: 'fp-1',
				auxiliares,
			}),
		);

		const lineas = lineasDe(fixture.crearAsiento);
		const totalDebe = lineas.reduce((acc, l) => acc + l.debe, 0);
		const totalHaber = lineas.reduce((acc, l) => acc + l.haber, 0);
		expect(totalDebe).toBe(totalHaber);
		expect(
			lineas.find((l) => l.cuentaId === 'cta-2.1.03' || l.cuentaId === 'cta-1.2.01')?.haber,
		).toBe(1000);
		expect(
			lineas.find((l) => l.cuentaId === 'cta-4.5')?.haber,
			'ingreso por diferencia cambiaria',
		).toBe(100);
		const lineaCxC = lineas.find((l) => l.cuentaId === 'cta-1.2.01');
		expect(lineaCxC?.haber).toBe(1000);
	});

	it('cobro con diferencia cambiaria desfavorable genera línea de gasto', async () => {
		await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({
				tipo: 'COBRO_CXC',
				monto: 25,
				moneda: 'USD',
				tasaCambio: 38,
				montoFuncional: 950,
				auxiliares: { diferenciaFx: -50 },
			}),
		);
		const lineas = lineasDe(fixture.crearAsiento);
		expect(lineas.find((l) => l.cuentaId === 'cta-1.2.01')?.haber).toBe(1000);
		expect(lineas.find((l) => l.cuentaId === 'cta-6.5')?.debe).toBe(50);
		const totalDebe = lineas.reduce((acc, l) => acc + l.debe, 0);
		const totalHaber = lineas.reduce((acc, l) => acc + l.haber, 0);
		expect(totalDebe).toBe(totalHaber);
	});

	it('cobro de préstamo descompone capital e intereses', async () => {
		await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({
				tipo: 'COBRO_PRESTAMO',
				montoFuncional: 1200,
				monto: 1200,
				auxiliares: { intereses: 200 },
			}),
		);
		const lineas = lineasDe(fixture.crearAsiento);
		expect(lineas.find((l) => l.cuentaId === 'cta-1.1.01')?.debe).toBe(1200);
		expect(lineas.find((l) => l.cuentaId === 'cta-1.2.02')?.haber).toBe(1000);
		expect(lineas.find((l) => l.cuentaId === 'cta-4.4')?.haber).toBe(200);
	});

	it('el costo FIFO se omite cuando el evento no lo trae (devolución sin costo)', async () => {
		await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({ tipo: 'DEVOLUCION_VENTA' }),
		);
		const lineas = lineasDe(fixture.crearAsiento);
		expect(lineas).toHaveLength(2);
		expect(lineas.find((l) => l.cuentaId === 'cta-5.1')).toBeUndefined();
	});

	it('la numeración continúa el máximo del diario+período bajo lock', async () => {
		fixture.maxNumero = 41;
		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase());
		const data = fixture.crearAsiento.mock.calls[0][0].data;
		expect(data.numero).toBe(42);
	});

	it('doble posteo concurrente: P2002 en el insert se resuelve como YA_EXISTENTE', async () => {
		// El findUnique post-error encuentra al ganador de la carrera
		let postError = false;
		(fixture.tx.asiento.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
			async () => (postError ? { asientoId: 'ast-ganador' } : null),
		);
		fixture.crearAsiento.mockImplementationOnce(() => {
			postError = true;
			throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
		});

		const resultado = await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		);
		expect(resultado.estado).toBe('YA_EXISTENTE');
		expect(resultado.asientoId).toBe('ast-ganador');
	});

	it('la cadena de hash enlaza con el último asiento del tenant', async () => {
		fixture.ultimoAsiento = { hash: 'abc123previo' };
		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase());
		const data = fixture.crearAsiento.mock.calls[0][0].data;
		expect(data.hashAnterior).toBe('abc123previo');
		expect(data.hash).not.toBe('abc123previo');

		fixture.crearAsiento.mockClear();
		fixture.ultimoAsiento = { hash: 'otro-hash' };
		await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({ origen: { tipo: 'venta', id: 'venta-2' } }),
		);
		const data2 = fixture.crearAsiento.mock.calls[0][0].data;
		expect(data2.hashAnterior).toBe('otro-hash');
		expect(data2.hash).not.toBe(data.hash);
	});
});
