import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertDisposableDatabase } from '../../../../scripts/ci/disposable-database.mjs';
import { prisma } from '@/lib/prisma';
import { seedPlanContable } from '@/features/contabilidad-formal/services/seed-plan-contable';
import { PeriodoGuard } from '@/lib/services/periodo-contable-guard';
import { AccountingOperationsMutationService } from '@/features/contabilidad/services/accounting-operations-mutation-service';

assertDisposableDatabase(process.env);

const initialFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const prefix = `cta-transfer-${crypto.randomUUID()}`;
const actors = {
	transfer: `actor-${prefix}-transfer`,
	adjustment: `actor-${prefix}-adjustment-audit-rollback`,
	injection: `actor-${prefix}-injection-audit-rollback`,
	capitalPayment: `actor-${prefix}-capital-payment-audit-rollback`,
};
let tenantId = '';
let otherTenantId = '';
let sourceId = '';
let destinationId = '';
let fxAccountId = '';
let otherAccountId = '';
let trigger = '';
let auditTrigger = '';

const manager = (userId = actors.transfer) => ({
	userId, tenantId, tenantRole: 'manager',
	planFeatures: {
		'transferencias-bancarias': true, contabilidad: true, 'inyeccion-capital': true,
	},
}) as never;

/** @description Captura los efectos persistidos relevantes de los writers contables. */
async function snapshotWriterState(actorId: string) {
	const [accounts, adjustments, injections, payments, reconciliations, entries, auditLogs, periodCache] =
		await Promise.all([
			prisma.cuentaBancaria.findMany({ where: { tenantId }, orderBy: { cuentaId: 'asc' } }),
			prisma.ajusteBancario.findMany({ where: { tenantId }, orderBy: { ajusteId: 'asc' } }),
			prisma.inyeccionCapital.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
			prisma.pagoDeuda.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
			prisma.reconciliacionVenta.findMany({
				where: { tenantId }, orderBy: { reconciliacionId: 'asc' },
			}),
			prisma.asiento.findMany({
				where: { tenantId }, orderBy: { asientoId: 'asc' },
				include: { lineas: { orderBy: { orden: 'asc' } } },
			}),
			prisma.auditLog.findMany({
				where: {
					usuarioId: actorId,
					entidad: { in: ['AJUSTE_BANCARIO', 'INYECCION_CAPITAL', 'PAGO_DEUDA'] },
				},
				orderBy: { id: 'asc' },
			}),
			prisma.periodoCache.findMany({ where: { tenantId }, orderBy: { cacheKey: 'asc' } }),
		]);

	return JSON.parse(JSON.stringify({
		accounts, adjustments, injections, payments, reconciliations, entries, auditLogs, periodCache,
	}, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
}

/** @description Instala un rechazo real de PostgreSQL para una entidad/actor de auditoría. */
async function rejectAuditFor(actorId: string, entity: string, postedOrigin?: string) {
	auditTrigger = `cta_writer_audit_${crypto.randomUUID().replaceAll('-', '')}`;
	await prisma.$executeRawUnsafe(`CREATE FUNCTION "${auditTrigger}"() RETURNS trigger
		LANGUAGE plpgsql AS $$ BEGIN
			IF NEW."usuarioId" = '${actorId}' AND NEW."entidad" = '${entity}' THEN
				${postedOrigin ? `IF NOT EXISTS (
          SELECT 1 FROM "asientos" a WHERE a."tenantId" = '${tenantId}'
            AND a."origenTipo" = '${postedOrigin}' AND a."origenId" = NEW."entidadId"
        ) THEN
          RAISE EXCEPTION 'audit before posting' USING ERRCODE = '22023';
        END IF;` : ''}
				RAISE EXCEPTION 'audit rejected: ${entity}' USING ERRCODE = '22012';
			END IF;
			RETURN NEW;
		END $$`);
	await prisma.$executeRawUnsafe(`CREATE TRIGGER "${auditTrigger}" BEFORE INSERT ON "AuditLog"
		FOR EACH ROW EXECUTE FUNCTION "${auditTrigger}"()`);
}

/** @description Retira el trigger PostgreSQL temporal sin afectar otros casos. */
async function removeAuditRejection() {
	if (!auditTrigger) return;
	await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${auditTrigger}" ON "AuditLog"`);
	await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${auditTrigger}"()`);
	auditTrigger = '';
}

/** @description Prueba el writer compartido de transferencias en PostgreSQL aislado. */
describe('transferencia bancaria compartida — PostgreSQL aislado', { timeout: 90_000 }, () => {
	beforeAll(async () => {
		const identity = await prisma.$queryRaw<Array<{ db: string; port: number }>>`
			SELECT current_database() AS db, inet_server_port() AS port
		`;
		const target = new URL(process.env.DATABASE_URL ?? '');
		expect(identity[0]).toMatchObject({
			db: target.pathname.slice(1),
			port: Number(target.port),
		});
		process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
		const tenant = await prisma.tenant.create({ data: { nombre: prefix, slug: prefix } });
		tenantId = tenant.tenantId;
		const other = await prisma.tenant.create({ data: {
			nombre: `${prefix}-other`, slug: `${prefix}-other`,
		} });
		otherTenantId = other.tenantId;
		const plan = await prisma.plan.create({ data: {
			nombre: prefix, duracionDias: 365,
			features: {
				'contabilidad-formal': true,
				'transferencias-bancarias': true,
				contabilidad: true,
				'inyeccion-capital': true,
			},
		} });
		await prisma.tenantLicense.create({ data: {
			tenantId, planId: plan.planId, expiracion: new Date('2099-01-01'),
		} });
		// Política contable requerida por los writers y el guard fail-closed del motor.
		await prisma.tenantAccountingPolicy.create({
			data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: actors.transfer },
		});
		sourceId = (await prisma.cuentaBancaria.create({ data: {
			tenantId, nombreBanco: `${prefix}-src`, numeroCuenta: `${prefix}-src`,
			tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 1000,
		} })).cuentaId;
		destinationId = (await prisma.cuentaBancaria.create({ data: {
			tenantId, nombreBanco: `${prefix}-dst`, numeroCuenta: `${prefix}-dst`,
			tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 0,
		} })).cuentaId;
		fxAccountId = (await prisma.cuentaBancaria.create({ data: {
			tenantId, nombreBanco: `${prefix}-fx`, numeroCuenta: `${prefix}-fx`,
			tipoCuenta: 'CORRIENTE', moneda: 'USD', saldo: 100,
		} })).cuentaId;
		otherAccountId = (await prisma.cuentaBancaria.create({ data: {
			tenantId: otherTenantId, nombreBanco: `${prefix}-other`, numeroCuenta: `${prefix}-other`,
			tipoCuenta: 'CORRIENTE', moneda: 'CUP', saldo: 0,
		} })).cuentaId;
		await prisma.$transaction((tx) => seedPlanContable(tx, tenantId));
		const now = new Date();
		await prisma.periodoContable.create({ data: {
			tenantId, tipo: 'MENSUAL', estado: 'ABIERTO',
			fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
			fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
		} });
		await PeriodoGuard.assertWritable(now, tenantId, 'asiento', {
			actorId: actors.transfer, actorTipo: 'USUARIO',
			origen: { tipo: 'transferencia_bancaria', id: prefix },
		});
	});

	afterAll(async () => {
		if (initialFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
		else process.env.CONTABILIDAD_FORMAL_MODE = initialFormalMode;
		if (trigger) {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON "asientos"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${trigger}()`);
		}
		if (auditTrigger) {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${auditTrigger}" ON "AuditLog"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${auditTrigger}"()`);
		}
		const auditRows = await prisma.auditLog.findMany({
			where: { usuarioId: { in: Object.values(actors) } },
			select: { id: true },
		});
		if (auditRows.length > 0) {
			await prisma.auditLog.deleteMany({ where: { id: { in: auditRows.map(({ id }) => id) } } });
		}
		if (!tenantId) return;
		await prisma.asientoLinea.deleteMany({ where: { asiento: { tenantId } } });
		await prisma.asiento.deleteMany({ where: { tenantId } });
		await prisma.transferenciaBancaria.deleteMany({ where: { tenantId } });
		await prisma.ajusteBancario.deleteMany({ where: { tenantId } });
		await prisma.pagoDeuda.deleteMany({ where: { tenantId } });
		await prisma.inyeccionCapital.deleteMany({ where: { tenantId } });
		await prisma.cuentaRolTenant.deleteMany({ where: { tenantId } });
		await prisma.cuentaContable.deleteMany({ where: { tenantId } });
		await prisma.diario.deleteMany({ where: { tenantId } });
		await prisma.periodoCache.deleteMany({ where: { tenantId } });
		await prisma.periodoContable.deleteMany({ where: { tenantId } });
		await prisma.cuentaBancaria.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
		await prisma.tenantLicense.deleteMany({ where: { tenantId } });
		await prisma.tenantAccountingPolicy.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
		await prisma.tenant.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
		await prisma.plan.deleteMany({ where: { nombre: prefix } });
	});

	it('confirma un asiento por transferencia y mantiene origen/destino dentro del tenant', async () => {
		const result = await AccountingOperationsMutationService.createBankTransfer({
			input: {
				cuentaOrigenId: sourceId, cuentaDestinoId: destinationId,
				montoOrigen: 100, motivo: 'Rebalanceo interno',
			},
			user: manager(),
		});

		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: sourceId } }))
			.saldo.toString()).toBe('900');
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: destinationId } }))
			.saldo.toString()).toBe('100');
		const asientos = await prisma.asiento.findMany({ where: {
			tenantId, origenTipo: 'transferencia_bancaria', origenId: result.transferencia.transferenciaId,
		}, include: { lineas: true } });
		expect(asientos).toHaveLength(1);
		expect(asientos[0].lineas.reduce((sum, line) => sum + Number(line.debe), 0))
			.toBe(asientos[0].lineas.reduce((sum, line) => sum + Number(line.haber), 0));
	});

	it('revierte transferencia y asiento si falla la auditoría transaccional', async () => {
		auditTrigger = `cta_transfer_audit_${crypto.randomUUID().replaceAll('-', '')}`;
		await prisma.$executeRawUnsafe(`CREATE FUNCTION "${auditTrigger}"() RETURNS trigger
			LANGUAGE plpgsql AS $$ BEGIN
				IF NEW."usuarioId" = '${actors.transfer}' AND NEW."entidad" = 'TRANSFERENCIA' THEN
					RAISE EXCEPTION 'transfer audit rejected' USING ERRCODE = '22012';
				END IF;
				RETURN NEW;
			END $$`);
		await prisma.$executeRawUnsafe(`CREATE TRIGGER "${auditTrigger}" BEFORE INSERT ON "AuditLog"
			FOR EACH ROW EXECUTE FUNCTION "${auditTrigger}"()`);
		const sourceBefore = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: sourceId },
		})).saldo;
		const destinationBefore = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: destinationId },
		})).saldo;
		const transfersBefore = await prisma.transferenciaBancaria.count({ where: { tenantId } });
		const entriesBefore = await prisma.asiento.count({ where: { tenantId } });

		try {
			await expect(AccountingOperationsMutationService.createBankTransfer({
				input: {
					cuentaOrigenId: sourceId, cuentaDestinoId: destinationId,
					montoOrigen: 20, motivo: 'Falla de auditoría',
				},
				user: manager(),
			})).rejects.toThrow(/transfer audit rejected/);

			expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: sourceId } })).saldo)
				.toEqual(sourceBefore);
			expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: destinationId } })).saldo)
				.toEqual(destinationBefore);
			expect(await prisma.transferenciaBancaria.count({ where: { tenantId } })).toBe(transfersBefore);
			expect(await prisma.asiento.count({ where: { tenantId } })).toBe(entriesBefore);
		} finally {
			await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${auditTrigger}" ON "AuditLog"`);
			await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${auditTrigger}"()`);
			auditTrigger = '';
		}
	});

	it('rechaza la cuenta de otro tenant antes de transacción', async () => {
		await expect(AccountingOperationsMutationService.createBankTransfer({
			input: {
				cuentaOrigenId: sourceId, cuentaDestinoId: otherAccountId,
				montoOrigen: 10, motivo: 'No debe cruzar tenant',
			},
			user: manager(),
		})).rejects.toMatchObject({ code: 'NOT_FOUND' });
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: sourceId } }))
			.saldo.toString()).toBe('900');
		expect(await prisma.transferenciaBancaria.count({ where: { tenantId } })).toBe(1);
	});

	it('registra ajuste CUP con permiso, saldo tenant-scoped y asiento único', async () => {
		const result = await AccountingOperationsMutationService.createBankAdjustment({
			input: {
				cuentaId: sourceId,
				tipo: 'ingreso',
				monto: 20,
				moneda: 'CUP',
				descripcion: 'Ajuste controlado',
				motivo: 'Prueba integración',
				fechaOperacion: new Date(),
			},
			user: manager(),
		});

		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: sourceId } }))
			.saldo.toString()).toBe('920');
		const asientos = await prisma.asiento.findMany({ where: {
			tenantId, origenTipo: 'ajuste_bancario', origenId: result.ajuste.ajusteId,
		}, include: { lineas: true } });
		expect(asientos).toHaveLength(1);
	});

	it('ajuste USD persiste fingerprint y hereda tasa funcional al asiento', async () => {
		const result = await AccountingOperationsMutationService.createBankAdjustment({
			input: {
				cuentaId: fxAccountId,
				tipo: 'ingreso',
				monto: 10,
				moneda: 'USD',
				tasaCambio: 24,
				descripcion: 'Ajuste USD',
				motivo: 'Prueba FX',
			},
			user: manager(),
		});
		const ajuste = await prisma.ajusteBancario.findUniqueOrThrow({
			where: { ajusteId: result.ajuste.ajusteId },
		});
		expect(ajuste.montoConvertido?.toString()).toBe('240');
		expect(ajuste.fxEvidenceFingerprint).toBeTruthy();
		expect(ajuste.rateEffectiveAt).toBeInstanceOf(Date);
		const asientos = await prisma.asiento.findMany({ where: {
			tenantId, origenTipo: 'ajuste_bancario', origenId: ajuste.ajusteId,
		}, include: { lineas: true } });
		expect(asientos).toHaveLength(1);
		expect(asientos[0].lineas.some((line) =>
			line.fxEvidenceFingerprint === ajuste.fxEvidenceFingerprint
			&& line.tasaCambio?.toString() === '24')).toBe(true);
	});

	it('transferencia USD→CUP persiste monto funcional y evidencia FX heredada', async () => {
		const result = await AccountingOperationsMutationService.createBankTransfer({
			input: {
				cuentaOrigenId: fxAccountId, cuentaDestinoId: destinationId,
				montoOrigen: 10, montoDestino: 240, tasaCambio: 24,
				motivo: 'Conversión USD a CUP',
			},
			user: manager(),
		});
		const transferencia = await prisma.transferenciaBancaria.findUniqueOrThrow({
			where: { transferenciaId: result.transferencia.transferenciaId },
		});
		expect(transferencia.montoConvertido?.toString()).toBe('240');
		expect(transferencia.fxEvidenceFingerprint).toBeTruthy();
		const asientos = await prisma.asiento.findMany({ where: {
			tenantId,
			origenTipo: 'transferencia_bancaria',
			origenId: transferencia.transferenciaId,
		}, include: { lineas: true } });
		expect(asientos).toHaveLength(1);
		expect(asientos[0].lineas.every((line) =>
			line.fxEvidenceFingerprint === transferencia.fxEvidenceFingerprint
			&& line.tasaCambio?.toString() === '24')).toBe(true);
	});

	it('inyección de capital USD conserva FX y la hereda al asiento', async () => {
		const result = await AccountingOperationsMutationService.createCapitalInjection({
			input: {
				montoRecibido: 50, moneda: 'USD', tasaCambio: 24,
				tipo: 'CAPITAL_SOCIAL', cuentaId: fxAccountId, socio: 'Socio USD',
				idempotencyKey: 'accounting-bank-transfer-capital-usd',
			},
			user: manager(),
		});
		const injection = await prisma.inyeccionCapital.findUniqueOrThrow({ where: { id: result.id } });
		expect(injection.montoConvertido?.toString()).toBe('1200');
		expect(injection.fxEvidenceFingerprint).toBeTruthy();
		const asientos = await prisma.asiento.findMany({ where: {
			tenantId, origenTipo: 'inyeccion_capital', origenId: injection.id,
		}, include: { lineas: true } });
		expect(asientos).toHaveLength(1);
		expect(asientos[0].lineas.some((line) =>
			line.fxEvidenceFingerprint === injection.fxEvidenceFingerprint
			&& line.tasaCambio?.toString() === '24')).toBe(true);
	});

	it('pago de deuda de capital USD conserva FX y la hereda al asiento', async () => {
		const injection = await AccountingOperationsMutationService.createCapitalInjection({
			input: {
				montoRecibido: 100, moneda: 'USD', tasaCambio: 24,
				tipo: 'DEUDA_EXTERNA', cuentaId: fxAccountId,
				entidadPrestamista: 'Prestamista USD',
				idempotencyKey: 'accounting-bank-transfer-debt-usd',
			},
			user: manager(),
		});
		const pago = await AccountingOperationsMutationService.registerCapitalPayment({
			input: {
				inyeccionId: injection.id, monto: 10, cuentaBancariaId: fxAccountId,
				tipoPagoId: 'compat-tipo-no-persistido', moneda: 'USD', tasaCambio: 25,
			},
			user: manager(),
		});
		const payment = await prisma.pagoDeuda.findUniqueOrThrow({ where: { id: pago.id } });
		expect(payment.montoConvertido?.toString()).toBe('250');
		expect(payment.fxEvidenceFingerprint).toBeTruthy();
		const asientos = await prisma.asiento.findMany({ where: {
			tenantId, origenTipo: 'pago_deuda_capital', origenId: payment.id,
		}, include: { lineas: true } });
		expect(asientos).toHaveLength(1);
		expect(asientos[0].lineas.some((line) =>
			line.fxEvidenceFingerprint === payment.fxEvidenceFingerprint
			&& line.tasaCambio?.toString() === '25')).toBe(true);
	});

	it('revierte ajuste, saldo y asiento si AuditLog rechaza AJUSTE_BANCARIO', async () => {
		const actorId = actors.adjustment;
		const balanceBefore = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: sourceId },
		})).saldo.toString();
		const result = await AccountingOperationsMutationService.createBankAdjustment({
			input: {
				cuentaId: sourceId, tipo: 'ingreso', monto: 7, moneda: 'CUP',
				descripcion: 'Auditoría persistida de ajuste', motivo: 'Caso feliz rollback',
			},
			user: manager(actorId),
		});
		const persisted = await prisma.ajusteBancario.findUniqueOrThrow({
			where: { ajusteId: result.ajuste.ajusteId },
		});
		expect(persisted.monto.toString()).toBe('7');
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: sourceId } }))
			.saldo.toString()).toBe(String(Number(balanceBefore) + 7));
		expect(await prisma.auditLog.count({
			where: { usuarioId: actorId, entidad: 'AJUSTE_BANCARIO', entidadId: persisted.ajusteId },
		})).toBe(1);
		const happyEntries = await prisma.asiento.findMany({
			where: { tenantId, origenTipo: 'ajuste_bancario', origenId: persisted.ajusteId },
			include: { lineas: true },
		});
		expect(happyEntries).toHaveLength(1);
		expect(happyEntries[0].lineas.length).toBeGreaterThan(0);

		await rejectAuditFor(actorId, 'AJUSTE_BANCARIO');
		try {
			const beforeFailure = await snapshotWriterState(actorId);
			await expect(AccountingOperationsMutationService.createBankAdjustment({
				input: {
					cuentaId: sourceId, tipo: 'ingreso', monto: 11, moneda: 'CUP',
					descripcion: 'Debe revertirse', motivo: 'Falla real de auditoría',
				},
				user: manager(actorId),
			})).rejects.toMatchObject({
				message: expect.stringMatching(/22012[\s\S]*audit rejected: AJUSTE_BANCARIO/),
			});
			expect(await snapshotWriterState(actorId)).toEqual(beforeFailure);
		} finally {
			await removeAuditRejection();
		}
	});

	it.each(['CAPITAL_SOCIAL', 'DEUDA_EXTERNA'] as const)(
    'revierte alta %s, saldo y asiento si AuditLog rechaza INYECCION_CAPITAL', async (tipo) => {
		const actorId = actors.injection;
		const balanceBefore = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: fxAccountId },
		})).saldo.toString();
		const result = await AccountingOperationsMutationService.createCapitalInjection({
			input: {
				montoRecibido: 5, moneda: 'USD', tasaCambio: 24,
				tipo, cuentaId: fxAccountId, socio: 'Socio auditoría',
        entidadPrestamista: tipo === 'DEUDA_EXTERNA' ? 'Prestamista auditoría' : undefined,
        tasaInteres: tipo === 'DEUDA_EXTERNA' ? 10 : undefined,
				idempotencyKey: `audit-rollback-injection-happy-${tipo}`,
			},
			user: manager(actorId),
		});
		const persisted = await prisma.inyeccionCapital.findUniqueOrThrow({ where: { id: result.id } });
		expect(persisted.montoRecibido.toString()).toBe('5');
		expect(persisted.tipo).toBe(tipo);
    if (tipo === 'DEUDA_EXTERNA') {
      expect(persisted.montoInteres?.toString()).toBe('0.5');
      expect(persisted.montoTotalDeuda?.toString()).toBe('5.5');
      expect(persisted.saldoPendiente?.toString()).toBe('5.5');
      expect(persisted.estado).toBe('ACTIVA');
    }
		expect(persisted.montoConvertido?.toString()).toBe('120');
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: fxAccountId } }))
			.saldo.toString()).toBe(String(Number(balanceBefore) + 5));
		expect(await prisma.auditLog.count({
			where: { usuarioId: actorId, entidad: 'INYECCION_CAPITAL', entidadId: persisted.id },
		})).toBe(1);
		const happyEntries = await prisma.asiento.findMany({
			where: { tenantId,
        origenTipo: tipo === 'DEUDA_EXTERNA' ? 'deuda_cash' : 'inyeccion_capital',
        origenId: persisted.id },
			include: { lineas: true },
		});
		expect(happyEntries).toHaveLength(1);
		expect(happyEntries[0].lineas.length).toBeGreaterThan(0);

		await rejectAuditFor(actorId, 'INYECCION_CAPITAL',
      tipo === 'DEUDA_EXTERNA' ? 'deuda_cash' : 'inyeccion_capital');
		try {
			const beforeFailure = await snapshotWriterState(actorId);
			await expect(AccountingOperationsMutationService.createCapitalInjection({
				input: {
					montoRecibido: 9, moneda: 'USD', tasaCambio: 24,
					tipo, cuentaId: fxAccountId, socio: 'Debe revertirse',
          entidadPrestamista: tipo === 'DEUDA_EXTERNA' ? 'Deuda que debe revertirse' : undefined,
          tasaInteres: tipo === 'DEUDA_EXTERNA' ? 10 : undefined,
					idempotencyKey: `audit-rollback-injection-failure-${tipo}`,
				},
				user: manager(actorId),
			})).rejects.toMatchObject({
				message: expect.stringMatching(/22012[\s\S]*audit rejected: INYECCION_CAPITAL/),
			});
			expect(await snapshotWriterState(actorId)).toEqual(beforeFailure);
		} finally {
			await removeAuditRejection();
		}
	});

	it('revierte pago, saldo pendiente, banco y asiento si AuditLog rechaza PAGO_DEUDA', async () => {
		const actorId = actors.capitalPayment;
		const debt = await AccountingOperationsMutationService.createCapitalInjection({
			input: {
				montoRecibido: 100, moneda: 'USD', tasaCambio: 24,
				tipo: 'DEUDA_EXTERNA', cuentaId: fxAccountId,
				entidadPrestamista: 'Prestamista válido',
				idempotencyKey: 'audit-rollback-payment-debt',
			},
			user: manager(actorId),
		});
		const debtBefore = await prisma.inyeccionCapital.findUniqueOrThrow({ where: { id: debt.id } });
		const balanceBefore = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: fxAccountId },
		})).saldo.toString();
		const paymentResult = await AccountingOperationsMutationService.registerCapitalPayment({
			input: {
				inyeccionId: debt.id, monto: 10, cuentaBancariaId: fxAccountId,
				tipoPagoId: 'compat-tipo-no-persistido', moneda: 'USD', tasaCambio: 25,
			},
			user: manager(actorId),
		});
		const payment = await prisma.pagoDeuda.findUniqueOrThrow({ where: { id: paymentResult.id } });
		const debtAfterHappy = await prisma.inyeccionCapital.findUniqueOrThrow({ where: { id: debt.id } });
		expect(payment.montoPagado.toString()).toBe('10');
		expect(payment.montoConvertido?.toString()).toBe('250');
		expect(debtAfterHappy.saldoPendiente?.toString()).toBe('90');
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: fxAccountId } }))
			.saldo.toString()).toBe(String(Number(balanceBefore) - 10));
		expect(await prisma.auditLog.count({
			where: { usuarioId: actorId, entidad: 'PAGO_DEUDA', entidadId: payment.id },
		})).toBe(1);
		const happyEntries = await prisma.asiento.findMany({
			where: { tenantId, origenTipo: 'pago_deuda_capital', origenId: payment.id },
			include: { lineas: true },
		});
		expect(happyEntries).toHaveLength(1);
		expect(happyEntries[0].lineas.length).toBeGreaterThan(0);

		await rejectAuditFor(actorId, 'PAGO_DEUDA');
		try {
			const beforeFailure = await snapshotWriterState(actorId);
			await expect(AccountingOperationsMutationService.registerCapitalPayment({
				input: {
					inyeccionId: debt.id, monto: 7, cuentaBancariaId: fxAccountId,
					tipoPagoId: 'compat-tipo-no-persistido', moneda: 'USD', tasaCambio: 25,
				},
				user: manager(actorId),
			})).rejects.toMatchObject({
				message: expect.stringMatching(/22012[\s\S]*audit rejected: PAGO_DEUDA/),
			});
			expect(await snapshotWriterState(actorId)).toEqual(beforeFailure);
		} finally {
			await removeAuditRejection();
		}
		expect(debtBefore.tipo).toBe('DEUDA_EXTERNA');
	});

	it('revierte ambas cuentas y la transferencia ante error SQL en postEvento', async () => {
		trigger = `cta_transfer_${crypto.randomUUID().replaceAll('-', '')}`;
		await prisma.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger
			LANGUAGE plpgsql AS $$ BEGIN
				RAISE EXCEPTION 'fallo posteo transferencia' USING ERRCODE = '22012';
				RETURN NEW;
			END $$`);
		await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON "asientos"
			FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION ${trigger}()`);
		const sourceBefore = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: sourceId },
		})).saldo.toString();
		const destinationBefore = (await prisma.cuentaBancaria.findUniqueOrThrow({
			where: { cuentaId: destinationId },
		})).saldo.toString();
		const transfersBefore = await prisma.transferenciaBancaria.count({ where: { tenantId } });
		const asientosBefore = await prisma.asiento.count({ where: { tenantId } });

		await expect(AccountingOperationsMutationService.createBankTransfer({
			input: {
				cuentaOrigenId: sourceId, cuentaDestinoId: destinationId,
				montoOrigen: 10, motivo: 'Falla simulada',
			},
			user: manager(),
		})).rejects.toThrow('fallo posteo transferencia');

		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: sourceId } }))
			.saldo.toString()).toBe(sourceBefore);
		expect((await prisma.cuentaBancaria.findUniqueOrThrow({ where: { cuentaId: destinationId } }))
			.saldo.toString()).toBe(destinationBefore);
		expect(await prisma.transferenciaBancaria.count({ where: { tenantId } })).toBe(transfersBefore);
		expect(await prisma.asiento.count({ where: { tenantId } })).toBe(asientosBefore);
	});
});
