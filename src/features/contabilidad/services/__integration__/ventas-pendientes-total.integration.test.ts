import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@/generated/prisma';
import { buildAppliedFxEvidence } from '@/features/contabilidad/domain/fx-evidence';

const db = vi.hoisted(() => ({
	current: null as Prisma.TransactionClient | null,
	transactionOptions: null as Record<string, unknown> | null,
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		$transaction: (
			callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
			options: Record<string, unknown>,
		) => {
			db.transactionOptions = options;
			if (!db.current) throw new Error('Integration transaction context is missing');
			return callback(db.current);
		},
	},
}));
vi.mock('@/lib/server-actions', () => ({
	withAction: (handler: (input: unknown, user: unknown) => unknown) =>
		(input: unknown) => handler(input, { userId: 'test-user', tenantId: 'test-tenant' }),
	ActionError: class ActionError extends Error {},
}));
vi.mock('@/lib/services/tenant-scope', () => ({
	requireFeature: () => undefined,
	requireTenant: (user: { tenantId: string }) => user.tenantId,
}));

import { getVentasPendientesAction } from '../../actions-reconciliacion';

interface ReconciliationSeed {
	reconciliacionId: string;
	tenantId: string;
	ventaId: string;
	amount: number;
	currency: string;
	functionalCurrency: string;
	rate?: number;
	convertedAmount: number;
	effectiveAt?: Date;
}

async function createTemporaryAccountingTables(tx: Prisma.TransactionClient): Promise<void> {
	await tx.$executeRawUnsafe(`CREATE TEMP TABLE "Venta" (
		"ventaId" text PRIMARY KEY, "tenantId" text, "total" numeric,
		"deletedAt" timestamptz, "createdAt" timestamptz, "puntoDeVentaId" text
	) ON COMMIT DROP`);
	await tx.$executeRawUnsafe(`CREATE TEMP TABLE "ReconciliacionVenta" (
		"reconciliacionId" text PRIMARY KEY, "tenantId" text, "ventaId" text,
		"monto" numeric, "montoConvertido" numeric, "moneda" text,
		"functionalCurrency" text, "tasaCambio" numeric, "rateEffectiveAt" timestamptz,
		"fxProvenanceKind" text, "fxProvenanceSource" text, "fxCatalogRateId" text,
		"fxEvidenceFingerprint" text, "fxEvidenceVersion" integer
	) ON COMMIT DROP`);
	await tx.$executeRawUnsafe(`CREATE TEMP TABLE "facturas" (
		"idFactura" text, "ventaId" text
	) ON COMMIT DROP`);
	await tx.$executeRawUnsafe(`CREATE TEMP TABLE "CuentaPorCobrar" (
		"facturaId" text, "tenantId" text, "estado" "EstadoCuentaPorCobrar"
	) ON COMMIT DROP`);
}

async function insertReconciliation(
	tx: Prisma.TransactionClient,
	seed: ReconciliationSeed,
): Promise<void> {
	const evidence = buildAppliedFxEvidence({
		originalAmount: seed.amount,
		originalCurrency: seed.currency,
		functionalCurrency: seed.functionalCurrency,
		exchangeRate: seed.rate,
		convertedAmount: seed.convertedAmount,
		rateEffectiveAt: seed.effectiveAt,
		source: 'integration-test',
	});
	await tx.$executeRaw`
		INSERT INTO "ReconciliacionVenta" (
			"reconciliacionId", "tenantId", "ventaId", "monto", "montoConvertido",
			"moneda", "functionalCurrency", "tasaCambio", "rateEffectiveAt",
			"fxProvenanceKind", "fxProvenanceSource", "fxCatalogRateId",
			"fxEvidenceFingerprint", "fxEvidenceVersion"
		) VALUES (
			${seed.reconciliacionId}, ${seed.tenantId}, ${seed.ventaId}, ${seed.amount},
			${seed.convertedAmount}, ${seed.currency}, ${seed.functionalCurrency},
			${seed.rate ?? null}, ${seed.effectiveAt ?? null}, ${evidence.fxProvenanceKind},
			${evidence.fxProvenanceSource}, ${evidence.fxCatalogRateId},
			${evidence.fxEvidenceFingerprint}, ${evidence.fxEvidenceVersion}
		)
	`;
}

async function withPostgresSnapshot<T>(
	run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
	const client = new PrismaClient();
	try {
		return await client.$transaction(async (tx) => {
			db.current = tx;
			await createTemporaryAccountingTables(tx);
			return run(tx);
		}, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
	} finally {
		db.current = null;
		await client.$disconnect();
	}
}

describe('totales de ventas pendientes en PostgreSQL', () => {
	afterEach(() => {
		db.current = null;
		db.transactionOptions = null;
	});

	it('página reconciliaciones por PK, respeta filtros/tenant y valida importes CUP y FX', async () => {
		await withPostgresSnapshot(async (tx) => {
			await tx.$executeRaw`INSERT INTO "Venta" ("ventaId", "tenantId", "total", "createdAt", "puntoDeVentaId")
				SELECT 'sale-' || n, 'test-tenant', 100, '2026-01-15'::timestamptz, 'pv-1'
				FROM generate_series(1, 250) AS n`;
			await tx.$executeRaw`INSERT INTO "facturas" VALUES ('invoice-1', 'sale-1'), ('invoice-2', 'sale-2')`;
			await tx.$executeRaw`INSERT INTO "CuentaPorCobrar" VALUES
				('invoice-1', 'test-tenant', 'PENDIENTE'), ('invoice-2', 'test-tenant', 'PARCIAL')`;
			await tx.$executeRaw`INSERT INTO "Venta" ("ventaId", "tenantId", "total", "createdAt", "puntoDeVentaId") VALUES
				('other-point', 'test-tenant', 300, '2026-01-15', 'pv-2'),
				('other-date', 'test-tenant', 500, '2026-02-15', 'pv-1'),
				('foreign-sale', 'other-tenant', 700, '2026-01-15', 'pv-1')`;

			const cupEvidence = buildAppliedFxEvidence({
				originalAmount: 0.01, originalCurrency: 'CUP',
				functionalCurrency: 'CUP', source: 'integration-test',
			});
			await tx.$executeRaw`
				INSERT INTO "ReconciliacionVenta" (
					"reconciliacionId", "tenantId", "ventaId", "monto", "montoConvertido",
					"moneda", "functionalCurrency", "tasaCambio", "rateEffectiveAt",
					"fxProvenanceKind", "fxProvenanceSource", "fxCatalogRateId",
					"fxEvidenceFingerprint", "fxEvidenceVersion"
				)
				SELECT 'cup-' || lpad(n::text, 4, '0'), 'test-tenant', 'sale-3', 0.01, 0.01,
					'CUP', 'CUP', NULL, NULL, ${cupEvidence.fxProvenanceKind},
					${cupEvidence.fxProvenanceSource}, NULL, ${cupEvidence.fxEvidenceFingerprint}, 1
				FROM generate_series(1, 1001) AS n
			`;
			await insertReconciliation(tx, {
				reconciliacionId: 'usd-valid', tenantId: 'test-tenant', ventaId: 'sale-4',
				amount: 2, currency: 'USD', functionalCurrency: 'CUP', rate: 25,
				convertedAmount: 50, effectiveAt: new Date('2026-01-15T00:00:00.000Z'),
			});
			await tx.$executeRaw`
				INSERT INTO "ReconciliacionVenta" ("reconciliacionId", "tenantId", "ventaId", "monto")
				VALUES ('foreign-invalid', 'other-tenant', 'foreign-sale', 99)
			`;
			const result = await getVentasPendientesAction({
				fechaInicio: '2026-01-01', fechaFin: '2026-01-31', puntoDeVentaId: 'pv-1',
				page: 4, limit: 100,
			}) as unknown as {
				pagination: { total: number };
				saldoPendienteTotal: number;
				ventas: unknown[];
			};
			expect(result.pagination.total).toBe(248);
			expect(result.saldoPendienteTotal).toBeCloseTo(24_739.99, 2);
			expect(result.ventas).toEqual([]);
			expect(db.transactionOptions).toMatchObject({
				isolationLevel: 'RepeatableRead', timeout: 30_000,
			});
		});
	});

	it('rechaza pagos aplicados con campos FX NULL aunque el saldo ya esté cubierto', async () => {
		await withPostgresSnapshot(async (tx) => {
			await tx.$executeRaw`INSERT INTO "Venta" ("ventaId", "tenantId", "total", "createdAt", "puntoDeVentaId")
				VALUES ('sale-invalid', 'test-tenant', 100, '2026-01-15', 'pv-1')`;
			await tx.$executeRaw`
				INSERT INTO "ReconciliacionVenta" (
					"reconciliacionId", "tenantId", "ventaId", "monto", "montoConvertido",
					"moneda", "functionalCurrency", "tasaCambio", "rateEffectiveAt",
					"fxProvenanceKind", "fxProvenanceSource", "fxEvidenceFingerprint",
					"fxEvidenceVersion"
				) VALUES ('invalid-null-fx', 'test-tenant', 'sale-invalid', 100, 100,
					'CUP', 'CUP', NULL, NULL, 'SAME_CURRENCY', 'integration-test', NULL, 1)
			`;

			await expect(getVentasPendientesAction()).rejects.toMatchObject({
				message: expect.stringContaining('sin evidencia FX verificable'),
			});
		});
	});
});
