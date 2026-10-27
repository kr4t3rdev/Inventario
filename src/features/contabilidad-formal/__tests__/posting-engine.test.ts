/**
 * @description Contratos del motor de asientos (CTA-1 T1/T2).
 * El motor corre dentro de la transacción del writer, con los servicios de
 * período y lock mockeados: plantillas y roles se alimentan desde los datos
 * reales por defecto para ejercitar el mapeo completo (evento → líneas).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { withReplayPostingCapability } from '@/features/contabilidad-formal/services/replay-posting-capability';
import { computeReplayPreflightDigest } from '@/features/contabilidad-formal/services/replay-preflight-digest';

import {
	PLANTILLAS_DEFAULT,
	ROLES_CUENTA_DEFAULT,
	type PlantillaLineaDefault,
	type TipoEventoClave,
} from '@/features/contabilidad-formal/lib/plan-default';
import {
	construirHashAsientoV2,
	postEvento,
	replayEvento,
	type AuxiliaresEvento,
	type EventoContableInput,
	type PostingTx,
} from '@/features/contabilidad-formal/services/posting-engine';

const TENANT = 'tenant-motor';
const MODO_ENV = 'CONTABILIDAD_FORMAL_MODE';

const guardMock = vi.hoisted(() => vi.fn());
const resolverMock = vi.hoisted(() => vi.fn());
const lockMock = vi.hoisted(() => vi.fn());
const intentoShadowMock = vi.hoisted(() => vi.fn());
const registrarShadowMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/services/shadow-savepoint', () => ({
  intentarPosteoShadow: intentoShadowMock,
}));
vi.mock('@/features/contabilidad-formal/services/shadow-outbox', () => ({
  registrarResultadoShadow: registrarShadowMock,
}));

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
	ultimoAsiento: { hash: string; tenantSequence?: bigint | null } | null;
	setHistorial: (rows: unknown[]) => void;
	rolesVacios: boolean;
	licencia: ReturnType<typeof vi.fn>;
}

/**
 * @description Construye el tx mockeado con las fixtures configurables del caso.
 */
function crearFixture(): CtxFixture {
	const state = {
		unicoAsiento: null as { asientoId: string } | null,
		maxNumero: null as number | null,
		ultimoAsiento: null as { hash: string; tenantSequence?: bigint | null } | null,
		historial: [] as unknown[],
		rolesVacios: false,
		plantillas: PLANTILLAS_DEFAULT,
	};

	const crearAsiento = vi.fn(async () => ({ asientoId: 'ast-nuevo' }));
	const licencia = vi.fn(async () => ({
		plan: { features: { 'contabilidad-formal': true } },
		featureOverrides: null,
		features: null,
	}));

	const tx: PostingTx = {
		tenantLicense: { findFirst: licencia },
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
			findMany: vi.fn(async () => state.historial),
			aggregate: vi.fn(async () => ({ _max: { numero: state.maxNumero } })),
			findFirst: vi.fn(async (args?: { where?: { hashVersion?: string | null; OR?: unknown } }) =>
				args?.where?.OR && state.ultimoAsiento ? null : state.ultimoAsiento),
			create: crearAsiento,
		},
		tenantAccountingPolicy: {
			findUnique: vi.fn(async () => ({ functionalCurrencyCode: 'CUP' })),
		},
	} as unknown as PostingTx;

	return {
		tx,
		crearAsiento,
		licencia,
		setModo: (modo: string) => {
			process.env[MODO_ENV] = modo;
		},
		setHistorial: (rows: unknown[]) => { state.historial = rows; },
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

type LineaCreada = { cuentaId: string; debe: Prisma.Decimal; haber: Prisma.Decimal; montoOriginal?: unknown; tasaCambio?: unknown };

function lineasDe(crearAsiento: ReturnType<typeof vi.fn>): LineaCreada[] {
	const data = crearAsiento.mock.calls[0][0].data as {
		tenantId: string;
		lineas: { create: Array<Record<string, unknown>> };
	};
	return data.lineas.create.map((linea) => {
		const cuenta = linea.cuenta as {
			connect: { tenantId_cuentaContableId: { cuentaContableId: string } };
		};
		return {
			...linea,
			tenantId: data.tenantId,
			cuentaId: cuenta.connect.tenantId_cuentaContableId.cuentaContableId,
		} as unknown as LineaCreada;
	});
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
    intentoShadowMock.mockImplementation(async (_tx: unknown, intento: () => Promise<unknown>) => {
      await intento();
      return { ok: true };
    });
    registrarShadowMock.mockResolvedValue(undefined);
	});

	it('modo off: no toca la base de datos', async () => {
		fixture.setModo('off');
		const resultado = await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({
				moneda: null as never,
				montoFuncional: null as never,
				monedaFuncional: null as never,
			}),
		);
		expect(resultado.estado).toBe('OMITIDO');
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
		expect(fixture.licencia).not.toHaveBeenCalled();
		expect(lockMock).not.toHaveBeenCalled();
		expect(guardMock).not.toHaveBeenCalled();
		expect(fixture.tx.cuentaRolTenant.findMany).not.toHaveBeenCalled();
		expect(fixture.tx.plantillaAsiento.findMany).not.toHaveBeenCalled();
		expect(fixture.tx.diario.findFirst).not.toHaveBeenCalled();
		expect(fixture.tx.asiento.findUnique).not.toHaveBeenCalled();
		expect(fixture.tx.asiento.findMany).not.toHaveBeenCalled();
		expect(fixture.tx.asiento.aggregate).not.toHaveBeenCalled();
		expect(fixture.tx.asiento.findFirst).not.toHaveBeenCalled();
		expect(registrarShadowMock).not.toHaveBeenCalled();
	});

	it('valoración ausente falla cerrado en enforce antes de crear asiento', async () => {
		fixture.setModo('enforce');
		const evento = eventoBase({
			moneda: null as never,
			montoFuncional: null as never,
			monedaFuncional: null as never,
		});

		await expect(postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			evento,
		)).rejects.toMatchObject({ code: 'VALORACION_MONETARIA_AUSENTE' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('valoración ausente registra ERROR_SHADOW y no intenta asiento', async () => {
		fixture.setModo('shadow');
		const evento = eventoBase({
			moneda: null as never,
			montoFuncional: null as never,
			monedaFuncional: null as never,
		});

		const resultado = await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			evento,
		);
		expect(resultado.estado).toBe('ERROR_SHADOW');
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
		expect(registrarShadowMock).toHaveBeenCalledWith(fixture.tx, expect.objectContaining({
			estado: 'ERROR_SHADOW', tipoEvento: 'VENTA_CONTADO', origenId: 'venta-1',
		}));
	});

	it('rechaza evento con moneda funcional distinta a la política del tenant', async () => {
		fixture.setModo('enforce');
		(fixture.tx.tenantAccountingPolicy.findUnique as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ functionalCurrencyCode: 'USD' });
		await expect(postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		)).rejects.toMatchObject({ code: 'MONEDA_FUNCIONAL_INCONSISTENTE' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('sin política contable falla cerrado en enforce (fail-closed)', async () => {
		fixture.setModo('enforce');
		(fixture.tx.tenantAccountingPolicy.findUnique as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(null);
		await expect(postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		)).rejects.toMatchObject({ code: 'MONEDA_FUNCIONAL_INCONSISTENTE' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('política sin moneda funcional configurada falla cerrado en enforce', async () => {
		fixture.setModo('enforce');
		(fixture.tx.tenantAccountingPolicy.findUnique as unknown as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce({ functionalCurrencyCode: '  ' });
		await expect(postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		)).rejects.toMatchObject({ code: 'MONEDA_FUNCIONAL_INCONSISTENTE' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('sin licencia o flag formal omite sin bloquear caja aunque env sea enforce', async () => {
		fixture.setModo('enforce');
		fixture.licencia.mockResolvedValueOnce(null).mockResolvedValueOnce({
			plan: { features: { 'contabilidad-formal': true } },
			featureOverrides: { 'contabilidad-formal': false },
			features: null,
		});
		for (let i = 0; i < 2; i++) {
			const resultado = await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase());
			expect(resultado.estado).toBe('OMITIDO');
		}
		expect(fixture.licencia).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({ tenantId: TENANT, activa: true }),
		}));
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
		expect(fixture.tx.asiento.findUnique).not.toHaveBeenCalled();
	});

	it('tenant habilitado sin plan falla cerrado en enforce', async () => {
		fixture.setModo('enforce');
		fixture.rolesVacios = true;
		await expect(postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		)).rejects.toMatchObject({ code: 'PLAN_NO_INICIALIZADO' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('shadow informa error de plan sin afectar writer ni escribir asientos', async () => {
		fixture.setModo('shadow');
		fixture.rolesVacios = true;
		const resultado = await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase());
		expect(resultado.estado).toBe('ERROR_SHADOW');
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
		expect(registrarShadowMock).toHaveBeenCalledOnce();
		expect(registrarShadowMock).toHaveBeenCalledWith(fixture.tx, expect.objectContaining({
		tenantId: TENANT,
		tipoEvento: 'VENTA_CONTADO',
		origenTipo: 'venta',
		origenId: 'venta-1',
		estado: 'ERROR_SHADOW',
		causa: 'El plan contable no está inicializado',
		duracionMs: expect.any(Number),
	}));
	});

	it('shadow intenta postear bajo savepoint y registra evidencia, sin anunciar asiento', async () => {
		fixture.setModo('shadow');
		const resultado = await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase());
		expect(resultado.estado).toBe('SIMULADO');
		expect(intentoShadowMock).toHaveBeenCalledOnce();
        expect(fixture.crearAsiento).toHaveBeenCalledOnce();
        expect(registrarShadowMock).toHaveBeenCalledWith(fixture.tx, expect.objectContaining({
          estado: 'SIMULADO', tipoEvento: 'VENTA_CONTADO', origenId: 'venta-1',
        }));
	});

    it('shadow registra el fallo SQL del intento y no rompe el writer', async () => {
      fixture.setModo('shadow');
      intentoShadowMock.mockResolvedValueOnce({ ok: false, error: new Error('division by zero') });
      const resultado = await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase());
      expect(resultado.estado).toBe('ERROR_SHADOW');
      expect(registrarShadowMock).toHaveBeenCalledWith(fixture.tx, expect.objectContaining({
        estado: 'ERROR_SHADOW', causa: 'division by zero',
      }));
    });

	it('shadow no oculta un fallo crítico de auditoría del período', async () => {
		fixture.setModo('shadow');
		const fallo = new ActionError('No se pudo persistir la auditoría', 'AUDITORIA_FALLIDA');
		guardMock.mockRejectedValueOnce(fallo);
		await expect(postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		)).rejects.toBe(fallo);
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
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
		expect(guardMock).toHaveBeenCalledWith(
			eventoBase().fecha, TENANT, 'asiento',
			{ actorId: 'u1', actorTipo: 'USUARIO', origen: eventoBase().origen },
		);

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

		const debe = lineasDe(fixture.crearAsiento).find((l) => l.debe.gt(0));
		const haber = lineasDe(fixture.crearAsiento).find((l) => l.haber.gt(0));
		expect(debe?.cuentaId).toBe('cta-1.1.01');
		expect(haber?.cuentaId).toBe('cta-4.1');
		expect(String(debe?.debe)).toBe('1000');
		expect(String(haber?.haber)).toBe('1000');
		expect(lockMock).toHaveBeenCalledOnce();
	});

	it('conserva fracciones funcionales exactas sin redondear', async () => {
		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' },
			eventoBase({ montoFuncional: new Prisma.Decimal('1.0001'), monto: 1.0001 }));
		const lineas = lineasDe(fixture.crearAsiento);
		expect(String(lineas[0].debe)).toBe('1.0001');
		expect(String(lineas[1].haber)).toBe('1.0001');
	});

	it('rechaza montos funcionales negativos antes de insertar', async () => {
		await expect(postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' },
			eventoBase({ montoFuncional: new Prisma.Decimal('-1') })))
			.rejects.toMatchObject({ code: 'MONTO_FUNCIONAL_INVALIDO' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it.each([
		['tasa', { tasaCambio: null, fxEvidenceFingerprint: 'fx-source-1' }],
		['fingerprint', { tasaCambio: '44', fxEvidenceFingerprint: null }],
	])('rechaza valoración entre monedas sin %s', async (_field, fx) => {
		await expect(postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase({
			moneda: 'USD', monedaFuncional: 'CUP', ...fx,
		}))).rejects.toMatchObject({ code: 'VALORACION_FX_INCOMPLETA' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('ninguna línea mezcla debe y haber y cada moneda original identifica su valoración', async () => {
		fixture.setPlantillas([
			{ evento: 'VENTA_CONTADO', orden: 1, lado: 'DEBE', rolCuenta: 'CAJA_PRINCIPAL', montoRegla: 'TOTAL' },
			{ evento: 'VENTA_CONTADO', orden: 2, lado: 'HABER', rolCuenta: 'VENTAS_PRODUCTOS', montoRegla: 'MONTO_PAGADO' },
		]);
		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase({
			moneda: 'USD', monto: '10', montoFuncional: '440', monedaFuncional: 'CUP',
			tasaCambio: '44', fxEvidenceFingerprint: 'fx-source-1', auxiliares: { montoPagado: '440' },
		}));
		const lineas = fixture.crearAsiento.mock.calls[0][0].data.lineas.create;
		expect(lineas.every((linea: { debe: Prisma.Decimal; haber: Prisma.Decimal }) =>
			!(linea.debe.gt(0) && linea.haber.gt(0)))).toBe(true);
		expect(lineas[0]).toMatchObject({ monedaOriginal: 'USD', fxEvidenceFingerprint: 'fx-source-1' });
		expect(lineas[1]).toMatchObject({ monedaOriginal: 'CUP', fxEvidenceFingerprint: null });
		expect(fixture.crearAsiento.mock.calls[0][0].data.tenantId).toBe(TENANT);
		expect(lineas.every((linea: { cuenta: { connect: { tenantId_cuentaContableId: { tenantId: string } } } }) =>
			linea.cuenta.connect.tenantId_cuentaContableId.tenantId === TENANT)).toBe(true);
	});

	it('rechaza rol sin mapear en enforce sin insertar', async () => {
		fixture.setPlantillas([
			{ evento: 'VENTA_CONTADO', orden: 1, lado: 'DEBE', rolCuenta: 'ROL_AUSENTE' as never, montoRegla: 'TOTAL' },
			{ evento: 'VENTA_CONTADO', orden: 2, lado: 'HABER', rolCuenta: 'VENTAS_PRODUCTOS', montoRegla: 'TOTAL' },
		]);
		await expect(postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase()))
			.rejects.toMatchObject({ code: 'CUENTA_SIN_MAPEAR' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('rechaza evento sin plantilla activa en enforce', async () => {
		fixture.setPlantillas([]);
		await expect(postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase()))
			.rejects.toMatchObject({ code: 'PLANTILLA_NO_ENCONTRADA' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('acepta evidencia de monto y tasa como Decimal sin pérdida de texto', async () => {
		const evidencia: EventoContableInput = eventoBase({
			monto: new Prisma.Decimal('9007199254740993.125'),
			moneda: 'USD',
			tasaCambio: new Prisma.Decimal('0.00000001'),
			montoFuncional: new Prisma.Decimal('90071992.5474'),
			fxEvidenceFingerprint: 'fx-decimal-source',
		});

		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, evidencia);

		const total = lineasDe(fixture.crearAsiento)[0];
		expect(String(total.montoOriginal)).toBe('9007199254740993.125');
		const { serializarDecimalEntrada } = await import('@/features/contabilidad-formal/services/posting-engine');
		expect(serializarDecimalEntrada(total.tasaCambio! as Prisma.Decimal, 'TASA_CAMBIO')).toBe('0.00000001');
	});

	it.each([
		['NaN', new Prisma.Decimal('NaN')],
		['Infinity', new Prisma.Decimal('Infinity')],
		['zero', new Prisma.Decimal('0')],
		['negative', new Prisma.Decimal('-1')],
		['unsafe JS number', Number.MAX_SAFE_INTEGER + 1 as unknown as Prisma.Decimal],
		['outside Decimal(20,4)', new Prisma.Decimal('10000000000000000')],
	])('rejects invalid or unsafe original amount before persistence (%s)', async (_label, monto) => {
		await expect(postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({ monto }),
		)).rejects.toMatchObject({ code: 'MONTO_ORIGINAL_INVALIDO' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it.each([
		['NaN', new Prisma.Decimal('NaN')],
		['Infinity', new Prisma.Decimal('Infinity')],
		['zero', new Prisma.Decimal('0')],
		['negative', new Prisma.Decimal('-1')],
		['unsafe JS number', Number.MAX_SAFE_INTEGER + 1],
		['outside Decimal(20,10)', new Prisma.Decimal('10000000000')],
	])('rejects invalid or unsafe FX rate before persistence (%s)', async (_label, tasaCambio) => {
		await expect(postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({ moneda: 'USD', tasaCambio, fxEvidenceFingerprint: 'fx-invalid-rate-case' }),
		)).rejects.toMatchObject({ code: 'TASA_CAMBIO_INVALIDA' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('rejects direct replay without a runtime capability before ledger persistence', async () => {
		await expect(replayEvento(
			fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase(), 'per-1',
		)).rejects.toMatchObject({ code: 'INVALID_REPLAY_CAPABILITY' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('rejects detached replay after capability revocation at the final insert boundary', async () => {
		const event = eventoBase();
		const snapshot = {
			tenantId: TENANT,
			period: { periodId: 'per-1', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-30T23:59:59Z' },
			sources: [{
				identity: { sourceType: event.origen.tipo, sourceId: event.origen.id },
				classification: 'REPLAYABLE', omissionCause: null,
				semantics: {
					tipo: event.tipo, fecha: event.fecha, descripcion: event.descripcion,
					medioCobro: null, referencia: null,
					auxiliares: { costoFifo: null, intereses: null, montoPagado: null, diferenciaFx: null },
				},
				valuation: {
					originalAmount: '1000', originalCurrency: 'CUP', functionalAmount: '1000',
					functionalCurrency: 'CUP', fxRate: null, fxEvidenceFingerprint: null,
				},
			}],
		};
		const digest = computeReplayPreflightDigest(snapshot);
		const generatedAt = new Date();
		const run = {
			tenantId: TENANT, replayRunId: 'run', replayPreflightId: 'preflight',
			replayApprovalId: 'approval', startedByUserId: 'u1', status: 'RUNNING', digestVersion: 2, digest,
			preflight: {
				tenantId: TENANT, replayPreflightId: 'preflight', periodoId: 'per-1',
				requestedByUserId: 'requester', status: 'APPROVED', digestVersion: 2, digest,
				generatedAt, expiresAt: new Date(generatedAt.getTime() + 86_400_000), snapshot,
			},
			approval: {
				tenantId: TENANT, replayPreflightId: 'preflight', replayApprovalId: 'approval',
				requestedByUserId: 'requester', approvedByUserId: 'approver',
				status: 'APPROVED', digestVersion: 2, digest,
			},
		};
		let release!: () => void;
		const barrier = new Promise<void>((resolve) => { release = resolve; });
		const lookup = vi.fn().mockImplementationOnce(async () => { await barrier; return null; })
			.mockResolvedValue(null);
		const tx = {
			...fixture.tx, asiento: { ...fixture.tx.asiento, findUnique: lookup },
			replayRun: { findUnique: vi.fn().mockResolvedValue(run) },
			tenantMembership: { findFirst: vi.fn().mockResolvedValue({
				tenantRole: 'manager', isActive: true, user: { isActive: true }, customRole: null,
			}) },
		} as unknown as PostingTx;
		let detached!: ReturnType<typeof replayEvento>;
		await withReplayPostingCapability(tx, {
			tenantId: TENANT, userId: 'u1', periodoId: 'per-1', replayRunId: 'run',
		}, async (token) => {
			detached = replayEvento(tx, { tenantId: TENANT, userId: 'u1' }, event, 'per-1', token);
		});
		release();
		await expect(detached).rejects.toMatchObject({ code: 'INVALID_REPLAY_CAPABILITY' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('replayEvento applies source amount and rate validation before persistence', async () => {
		await expect(replayEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({ monto: new Prisma.Decimal('0') }),
			'per-1',
		)).rejects.toMatchObject({ code: 'MONTO_ORIGINAL_INVALIDO' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();

		await expect(replayEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({ moneda: 'USD', tasaCambio: new Prisma.Decimal('-1'), fxEvidenceFingerprint: 'fx-invalid-rate-case' }),
			'per-1',
		)).rejects.toMatchObject({ code: 'TASA_CAMBIO_INVALIDA' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('serializes exponent-form source decimals without changing the exact value', async () => {
		const { serializarDecimalEntrada } = await import('@/features/contabilidad-formal/services/posting-engine');
		expect(serializarDecimalEntrada('9.007199254740993125e+15')).toBe('9007199254740993.125');

		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase({
			monto: '9.007199254740993125e+15',
			montoFuncional: '9.007199254740993125e+15',
		}));
		const montoOriginal = lineasDe(fixture.crearAsiento)[0].montoOriginal;
		expect((montoOriginal as Prisma.Decimal).eq(new Prisma.Decimal('9007199254740993.125'))).toBe(true);
	});

	it('preserves Decimal auxiliaries through functional valuation', async () => {
		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase({
			montoFuncional: new Prisma.Decimal('1.2345'),
			auxiliares: { montoPagado: new Prisma.Decimal('1.2345') },
		}));
		const lineas = lineasDe(fixture.crearAsiento);
		expect(String(lineas[0].debe)).toBe('1.2345');
		expect(String(lineas[1].haber)).toBe('1.2345');
	});

	it('rechaza precisión funcional mayor que cuatro sin insertar', async () => {
		await expect(postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' },
			eventoBase({ montoFuncional: new Prisma.Decimal('1.00001') })))
			.rejects.toThrow('PRECISION_FUNCIONAL_INVALIDA');
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('rechaza descuadre de una diezmilésima sin tolerancia', async () => {
		fixture.setPlantillas([
			{ evento: 'VENTA_CONTADO', orden: 1, lado: 'DEBE', rolCuenta: 'CAJA_PRINCIPAL', montoRegla: 'TOTAL' },
			{ evento: 'VENTA_CONTADO', orden: 2, lado: 'HABER', rolCuenta: 'VENTAS_PRODUCTOS', montoRegla: 'MONTO_PAGADO' },
		]);
		await expect(postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' },
			eventoBase({ montoFuncional: new Prisma.Decimal('1.0001'), auxiliares: { montoPagado: 1 } })))
			.rejects.toMatchObject({ code: 'ASIENTO_DESCUADRADO' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});

	it('medio bancario sustituye CAJA_PRINCIPAL por BANCOS', async () => {
		await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({ medioCobro: 'BANCOS' }),
		);
		const debe = lineasDe(fixture.crearAsiento).find((l) => l.debe.gt(0));
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
		const totalDebe = lineas.reduce((acc, l) => acc.plus(l.debe), new Prisma.Decimal(0));
		const totalHaber = lineas.reduce((acc, l) => acc.plus(l.haber), new Prisma.Decimal(0));
		expect(totalDebe.eq(totalHaber)).toBe(true);
		expect(
			lineas.find((l) => l.cuentaId === 'cta-2.1.03' || l.cuentaId === 'cta-1.2.01')?.haber,
		).toEqual(new Prisma.Decimal(1000));
		expect(
			lineas.find((l) => l.cuentaId === 'cta-4.5')?.haber,
			'ingreso por diferencia cambiaria',
		).toEqual(new Prisma.Decimal(100));
		const lineaCxC = lineas.find((l) => l.cuentaId === 'cta-1.2.01');
		expect(lineaCxC?.haber).toEqual(new Prisma.Decimal(1000));
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
				fxEvidenceFingerprint: 'fx-cobro-perdida',
				montoFuncional: 950,
				auxiliares: { diferenciaFx: -50 },
			}),
		);
		const lineas = lineasDe(fixture.crearAsiento);
		expect(String(lineas.find((l) => l.cuentaId === 'cta-1.2.01')?.haber)).toBe('1000');
		expect(String(lineas.find((l) => l.cuentaId === 'cta-6.5')?.debe)).toBe('50');
		const totalDebe = lineas.reduce((acc, l) => acc.plus(l.debe), new Prisma.Decimal(0));
		const totalHaber = lineas.reduce((acc, l) => acc.plus(l.haber), new Prisma.Decimal(0));
		expect(totalDebe.eq(totalHaber)).toBe(true);
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
		expect(String(lineas.find((l) => l.cuentaId === 'cta-1.1.01')?.debe)).toBe('1200');
		expect(String(lineas.find((l) => l.cuentaId === 'cta-1.2.02')?.haber)).toBe('1000');
		expect(String(lineas.find((l) => l.cuentaId === 'cta-4.4')?.haber)).toBe('200');
	});

	it('cobro de préstamo descompone capital, interés ordinario y mora con el plan default', async () => {
		await postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase({
				tipo: 'COBRO_PRESTAMO',
				montoFuncional: 1200,
				monto: 1200,
				auxiliares: { intereses: 100, interesesMoratorios: 50 },
			}),
		);
		const lineas = lineasDe(fixture.crearAsiento);
		expect(String(lineas.find((l) => l.cuentaId === 'cta-1.2.02')?.haber)).toBe('1050');
		expect(String(lineas.find((l) => l.cuentaId === 'cta-4.4')?.haber)).toBe('100');
		expect(String(lineas.find((l) => l.cuentaId === 'cta-4.6')?.haber)).toBe('50');
	});

	it('pago de deuda descompone capital, interés ordinario y mora con el plan default', async () => {
		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase({
			tipo: 'PAGO_DEUDA', montoFuncional: 1200, monto: 1200,
			auxiliares: { intereses: 100, interesesMoratorios: 50 },
		}));
		const lineas = lineasDe(fixture.crearAsiento);
		expect(String(lineas.find((l) => l.cuentaId === 'cta-2.1.02')?.debe)).toBe('1050');
		expect(String(lineas.find((l) => l.cuentaId === 'cta-6.3')?.debe)).toBe('100');
		expect(String(lineas.find((l) => l.cuentaId === 'cta-6.6')?.debe)).toBe('50');
		expect(String(lineas.find((l) => l.cuentaId === 'cta-1.1.01')?.haber)).toBe('1200');
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

	it('propaga P2002 sin consultar dentro de la transacción abortada', async () => {
		const uniqueError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
		fixture.crearAsiento.mockRejectedValueOnce(uniqueError);

		await expect(postEvento(
			fixture.tx,
			{ tenantId: TENANT, userId: 'u1' },
			eventoBase(),
		)).rejects.toBe(uniqueError);
		// One preflight lookup plus the under-lock recheck; no lookup may follow
		// the failed INSERT because PostgreSQL has aborted this transaction.
		expect(fixture.tx.asiento.findUnique).toHaveBeenCalledTimes(2);
	});

	it('continúa una cadena v2 con Decimal(20,4) exacto en el hash previo', async () => {
		const importe = new Prisma.Decimal('123456789012345.0001');
		const data = {
			tenantId: TENANT, diarioId: 'dia-v', periodoId: 'per-v', numero: 1,
			fecha: new Date('2026-09-01T10:00:00Z'), origenTipo: 'venta', origenId: 'precision-previo',
			hashAnterior: null,
			lineas: [
				{ orden: 1, cuentaId: 'cta-1', debe: importe, haber: new Prisma.Decimal(0) },
				{ orden: 2, cuentaId: 'cta-2', debe: new Prisma.Decimal(0), haber: importe },
			],
		};
		const hash = construirHashAsientoV2({ ...data, tenantSequence: BigInt(1) });
		fixture.setHistorial([{
			...data, asientoId: 'ast-precision-previo', hash, hashVersion: 'canonical-v2', tenantSequence: BigInt(1),
		}]);
		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase());
		const created = fixture.crearAsiento.mock.calls[0][0].data;
		expect(created.hashAnterior).toBe(hash);
		expect(created.tenantSequence).toBe(BigInt(2));
	});

	it('inicia la cadena vacía con secuencia v2 inicial', async () => {
		await postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase());
		const data = fixture.crearAsiento.mock.calls[0][0].data;
		expect(data.hashAnterior).toBeNull();
		expect(data.hashVersion).toBe('canonical-v2');
		expect(data.tenantSequence).toBe(BigInt(1));
	});

	it('rechaza un hash histórico alterado antes de insertar', async () => {
		fixture.setHistorial([{
			asientoId: 'ast-corrupto', hash: 'tampered', hashAnterior: null,
			hashVersion: 'legacy-number-v1', tenantSequence: BigInt(1),
			tenantId: TENANT, diarioId: 'dia-v', periodoId: 'per-v', numero: 1,
			fecha: new Date('2026-09-01T10:00:00Z'), origenTipo: 'venta', origenId: 'v-1', lineas: [],
		}]);
		await expect(postEvento(fixture.tx, { tenantId: TENANT, userId: 'u1' }, eventoBase()))
			.rejects.toMatchObject({ code: 'HASH_CHAIN_INVALID' });
		expect(fixture.crearAsiento).not.toHaveBeenCalled();
	});
});
