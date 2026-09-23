/**
 * @description Contratos del backfill histórico (CTA-4): clasificación de
 * fuentes operativas por período (plan dry-run) y ejecución cronológica
 * con replayEvento sobre el período explícito, idempotente.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ejecutarBackfillPeriodo,
	planBackfillContable,
} from '@/features/contabilidad-formal/services/replay-backfill-service';

const TENANT = 'tenant-backfill';
const FECHA_SET = new Date('2026-09-15T12:00:00Z');

const replayMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/contabilidad-formal/services/posting-engine', () => ({
	replayEvento: replayMock,
}));

const prismaMock = vi.hoisted(() => ({
	reconciliacionVenta: { findMany: vi.fn() },
	reconciliacionGasto: { findMany: vi.fn() },
	reconciliacionServicio: { findMany: vi.fn() },
	ajusteBancario: { findMany: vi.fn() },
	transferenciaBancaria: { findMany: vi.fn() },
	inyeccionCapital: { findMany: vi.fn() },
	pagoDeuda: { findMany: vi.fn() },
	merma: { findMany: vi.fn() },
	compraDocumento: { findMany: vi.fn() },
	factura: { findMany: vi.fn() },
	anticipo: { findMany: vi.fn() },
	anticipoMovimiento: { findMany: vi.fn() },
	periodoContable: {
		findMany: vi.fn(),
		findFirst: vi.fn(),
	},
	asiento: { findMany: vi.fn() },
	cuentaBancaria: { findUnique: vi.fn() },
	$transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const PERIODO_SEP = {
	periodoId: 'p-sep',
	codigo: 'M-2026-09',
	fechaInicio: new Date('2026-09-01T00:00:00Z'),
	fechaFin: new Date('2026-09-30T23:59:59Z'),
};

function reconVenta(over: Record<string, unknown> = {}) {
	return {
		reconciliacionId: 'rv-1',
		ventaId: 'v-1',
		venta: { factura: null },
		prestamoCashId: null,
		deudaCashId: null,
		tipoReconciliacion: null,
		monto: 100,
		moneda: 'CUP',
		montoConvertido: 100,
		tasaCambio: null,
		fxEvidenceFingerprint: null,
		fechaReconciliacion: FECHA_SET,
		cuentaId: 'cta-bank-1',
		...over,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	replayMock.mockResolvedValue({ estado: 'CONTABILIZADO', asientoId: 'ast-new' });
	prismaMock.periodoContable.findMany.mockResolvedValue([PERIODO_SEP]);
	prismaMock.periodoContable.findFirst.mockResolvedValue(PERIODO_SEP);
	prismaMock.asiento.findMany.mockResolvedValue([]);
	prismaMock.reconciliacionVenta.findMany.mockResolvedValue([]);
	prismaMock.reconciliacionGasto.findMany.mockResolvedValue([]);
	prismaMock.reconciliacionServicio.findMany.mockResolvedValue([]);
	prismaMock.ajusteBancario.findMany.mockResolvedValue([]);
	prismaMock.transferenciaBancaria.findMany.mockResolvedValue([]);
	prismaMock.inyeccionCapital.findMany.mockResolvedValue([]);
	prismaMock.pagoDeuda.findMany.mockResolvedValue([]);
	prismaMock.merma.findMany.mockResolvedValue([]);
	prismaMock.compraDocumento.findMany.mockResolvedValue([]);
	prismaMock.factura.findMany.mockResolvedValue([]);
	prismaMock.anticipo.findMany.mockResolvedValue([]);
	prismaMock.anticipoMovimiento.findMany.mockResolvedValue([]);
	prismaMock.cuentaBancaria.findUnique.mockResolvedValue({ cuentaId: 'cta-bank-1', tipoCuenta: 'AHORROS' });
});

describe('planBackfillContable (dry-run)', () => {
	it('clasifica eventos replayables y los ya posteados por período', async () => {
		prismaMock.reconciliacionVenta.findMany.mockResolvedValue([
			reconVenta({ reconciliacionId: 'rv-1' }),
			reconVenta({ reconciliacionId: 'rv-2', ventaId: 'v-2', venta: { factura: { idFactura: 'f-1' } } }),
			reconVenta({
				reconciliacionId: 'rv-3',
				fechaReconciliacion: new Date('2026-08-15T10:00:00Z'),
			}),
		]);
		prismaMock.asiento.findMany.mockResolvedValue([{ origenTipo: 'reconciliacion_venta', origenId: 'rv-2' }]);

		const plan = await planBackfillContable(TENANT);

		expect(plan.totalEvaluados).toBe(3);
		const sep = plan.periodos.find((p) => p.periodoId === 'p-sep')!;
		expect(sep.replayables).toBe(1); // rv-1 (sin asiento); rv-2 ya estaba posteado
		expect(sep.yaPosteados).toBe(1);
		// rv-3 cae en agosto sin período para agosto
		expect(plan.sinPeriodo).toBe(1);
	});

	it('todo reconciliación fuera de período contado como sinPeríodo', async () => {
		prismaMock.reconciliacionVenta.findMany.mockResolvedValue([
			reconVenta({ reconciliacionId: 'rv-x', fechaReconciliacion: new Date('2026-01-10T10:00:00Z') }),
		]);
		const plan = await planBackfillContable(TENANT);
		expect(plan.sinPeriodo).toBe(1);
	});
});

describe('ejecutarBackfillPeriodo', () => {
	it('replay de eventos en orden cronológico con período explícito', async () => {
		prismaMock.reconciliacionGasto.findMany.mockResolvedValue([
			{
				reconciliacionId: 'rg-2',
				tipoGasto: 'gasto',
				gastosDEId: 'g-2',
				pgId: null,
				gastoCompraId: null,
				cuentaPorPagarId: null,
				monto: 50,
				moneda: 'CUP',
				montoConvertido: 50,
				tasaCambio: null,
				fxEvidenceFingerprint: null,
				fechaReconciliacion: new Date('2026-09-20T10:00:00Z'),
				cuentaId: 'cta-bank-1',
				descripcion: 'Tarde',
			},
			{
				reconciliacionId: 'rg-1',
				tipoGasto: 'gasto',
				gastosDEId: 'g-1',
				pgId: null,
				gastoCompraId: null,
				cuentaPorPagarId: null,
				monto: 80,
				moneda: 'CUP',
				montoConvertido: 80,
				tasaCambio: null,
				fxEvidenceFingerprint: null,
				fechaReconciliacion: new Date('2026-09-05T10:00:00Z'),
				cuentaId: 'cta-bank-1',
				descripcion: 'Temprano',
			},
		]);

		const resultado = await ejecutarBackfillPeriodo(TENANT, 'p-sep', 'actor-1');

		expect(resultado.contabilizados).toBe(2);
		expect(replayMock).toHaveBeenCalledTimes(2);
		const ordenOrigenes = replayMock.mock.calls.map(
			(call) => call[2].origen.id,
		);
		expect(ordenOrigenes).toEqual(['rg-1', 'rg-2']); // cronológico
		expect(replayMock.mock.calls[0][3]).toBe('p-sep'); // período forzado
	});

	it('no reposta lo ya posteado (idempotencia por segunda corrida)', async () => {
		prismaMock.reconciliacionVenta.findMany.mockResolvedValue([reconVenta({ reconciliacionId: 'rv-1' })]);
		prismaMock.asiento.findMany.mockResolvedValue([{ origenTipo: 'reconciliacion_venta', origenId: 'rv-1' }]);

		const resultado = await ejecutarBackfillPeriodo(TENANT, 'p-sep', 'actor-1');
		expect(resultado.contabilizados).toBe(0);
		expect(resultado.yaPosteados).toBe(1);
		expect(replayMock).not.toHaveBeenCalled();
	});
});
