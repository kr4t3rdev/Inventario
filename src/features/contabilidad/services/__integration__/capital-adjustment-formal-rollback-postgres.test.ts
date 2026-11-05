import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { withTestTenant } from '@/lib/db/tenant-context';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import { AccountingOperationsMutationService } from '../accounting-operations-mutation-service';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_capital_${suffix}`;
const bankId = `formal_capital_bank_${suffix}`;
const userId = `formal_user_${suffix}`;
const auditFailUserId = `formal_audit_fail_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const auditFailureFunction = `formal_capital_audit_failure_${suffix}`;
const auditFailureTrigger = `formal_capital_audit_trigger_${suffix}`;
const ledgerFailureFunction = `formal_capital_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_capital_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;
const operationDate = new Date('2025-01-15T12:00:00.000Z');

/**
 * @description Construye el actor autenticado de la prueba para el tenant aislado.
 * @param {string} actorId - Identificador del actor (marca el failpoint cuando hace falta).
 * @returns {AuthenticatedUser} Actor con tenant fijo.
 */
function userFor(actorId: string): AuthenticatedUser {
  return { userId: actorId, tenantId, tenantRole: 'manager' } as AuthenticatedUser;
}

/**
 * @description Invoca el writer de ajustes bancarios dentro del contexto del tenant.
 * @param {Record<string, unknown>} input - Payload del ajuste.
 * @param {string} actorId - Actor que ejecuta la operación.
 * @returns {Promise<unknown>} Resultado del writer.
 */
function createAdjustment(input: Record<string, unknown>, actorId = userId) {
  return withTestTenant(tenantId, () =>
    AccountingOperationsMutationService.createBankAdjustment({
      input: input as never,
      user: userFor(actorId),
    }),
  );
}

/**
 * @description Invoca el writer de inyecciones de capital dentro del contexto del tenant.
 * @param {Record<string, unknown>} input - Payload de la inyección.
 * @param {string} actorId - Actor que ejecuta la operación.
 * @returns {Promise<unknown>} Resultado del writer.
 */
function createCapital(input: Record<string, unknown>, actorId = userId) {
  return withTestTenant(tenantId, () =>
    AccountingOperationsMutationService.createCapitalInjection({
      input: input as never,
      user: userFor(actorId),
    }),
  );
}

/**
 * @description Captura el estado operativo y el libro mayor para comparar antes/después.
 * @param {string} actorId - Actor cuyas auditorías se cuentan.
 * @returns {Promise<object>} Fotografía del estado persistido del tenant.
 */
async function readSnapshot(actorId: string) {
  const [bank, ajustes, inyecciones, auditCount, asientos, lineas] = await Promise.all([
    prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: bankId },
      select: { saldo: true },
    }),
    prisma.ajusteBancario.count({ where: { tenantId } }),
    prisma.inyeccionCapital.count({ where: { tenantId } }),
    prisma.auditLog.count({ where: { usuarioId: actorId } }),
    prisma.asiento.findMany({
      where: { tenantId },
      orderBy: { tenantSequence: 'asc' },
      select: {
        asientoId: true,
        origenTipo: true,
        origenId: true,
        estado: true,
        hash: true,
        hashAnterior: true,
        tenantSequence: true,
      },
    }),
    prisma.asientoLinea.count({ where: { tenantId } }),
  ]);
  return {
    balance: bank.saldo.toString(),
    ajustes,
    inyecciones,
    auditCount,
    lineas,
    ledger: asientos.map((row) => ({
      id: row.asientoId,
      origenTipo: row.origenTipo,
      origenId: row.origenId,
      estado: row.estado,
      hash: row.hash,
      hashAnterior: row.hashAnterior,
      seq: row.tenantSequence?.toString() ?? null,
    })),
  };
}

describe(
  'rollback fisico formal de ajustes bancarios e inyecciones de capital en PostgreSQL aislado',
  { timeout: 90_000 },
  () => {
    beforeAll(async () => {
      process.env.CONTABILIDAD_FORMAL_MODE = 'enforce';
      const identity = await prisma.$queryRaw<Array<{
        databaseName: string;
        roleName: string;
        serverPort: number;
      }>>`
        SELECT current_database() AS "databaseName",
          current_user AS "roleName", inet_server_port() AS "serverPort"
      `;
      expect(identity).toHaveLength(1);
      assertDisposableDatabaseIdentity(identity[0], process.env);

      await prisma.tenant.create({
        data: {
          tenantId,
          nombre: `formal-capital-${suffix}`,
          slug: `formal-capital-${suffix}`,
        },
      });
      await prisma.periodoContable.create({
        data: {
          tenantId,
          tipo: 'MENSUAL',
          estado: 'ABIERTO',
          fechaInicio: new Date('2025-01-01T00:00:00.000Z'),
          fechaFin: new Date('2025-01-31T23:59:59.999Z'),
        },
      });
      const now = new Date();
      await prisma.periodoContable.create({
        data: {
          tenantId,
          tipo: 'MENSUAL',
          estado: 'ABIERTO',
          fechaInicio: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
          fechaFin: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
        },
      });
      await prisma.moneda.upsert({
        where: { codigo: 'CUP' },
        create: { codigo: 'CUP', nombre: 'Peso cubano', simbolo: 'CUP' },
        update: {},
      });
      await prisma.tenantAccountingPolicy.create({
        data: { tenantId, functionalCurrencyCode: 'CUP', updatedBy: userId },
      });
      await prisma.$transaction((tx) => seedPlanContable(tx as never, tenantId));
      await seedPlantillasGlobales(prisma as never);
      await prisma.tenantLicense.create({
        data: {
          tenantId,
          activa: true,
          expiracion: new Date(Date.now() + 86_400_000),
          features: { 'contabilidad-formal': true },
        },
      });
      await prisma.cuentaBancaria.create({
        data: {
          cuentaId: bankId,
          tenantId,
          nombreBanco: `formal-capital-bank-${suffix}`,
          numeroCuenta: `capital-${suffix}`,
          tipoCuenta: 'CORRIENTE',
          moneda: 'CUP',
          saldo: 1000,
        },
      });

      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION public."${auditFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."usuarioId" LIKE 'formal_audit_fail_%' THEN RAISE EXCEPTION 'forced audit failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${auditFailureTrigger}" BEFORE INSERT ON public."AuditLog" FOR EACH ROW EXECUTE FUNCTION public."${auditFailureFunction}"()`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION public."${ledgerFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId" = '${tenantId}' AND NEW."createdBy" LIKE 'formal_ledger_fail_%' THEN RAISE EXCEPTION 'forced asiento failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${ledgerFailureTrigger}" BEFORE INSERT ON public."asientos" FOR EACH ROW EXECUTE FUNCTION public."${ledgerFailureFunction}"()`,
      );
    });

    afterAll(async () => {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${auditFailureTrigger}" ON public."AuditLog"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${auditFailureFunction}"()`);
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${ledgerFailureTrigger}" ON public."asientos"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${ledgerFailureFunction}"()`);
      if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
    });

    it('contabiliza el ajuste bancario y su asiento formal en la misma transaccion', async () => {
      const key = `ajuste-ok-${suffix}`;
      const before = await readSnapshot(userId);
      const resultado = await createAdjustment({
        cuentaId: bankId,
        tipo: 'ingreso',
        monto: 100,
        moneda: 'CUP',
        descripcion: 'ajuste formal de control',
        motivo: 'control positivo',
        fechaOperacion: operationDate,
        idempotencyKey: key,
      });
      const ajusteId = (resultado as { ajuste: { ajusteId: string } }).ajuste.ajusteId;
      const after = await readSnapshot(userId);
      expect(after.balance).toBe(String(Number(before.balance) + 100));
      expect(after.ajustes).toBe(before.ajustes + 1);
      expect(after.auditCount).toBe(before.auditCount + 1);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);
      expect(after.lineas).toBe(before.lineas + 2);

      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: { tenantId_origenTipo_origenId: { tenantId, origenTipo: 'ajuste_bancario', origenId: ajusteId } },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(asiento.lineas).toHaveLength(2);
      const debe = asiento.lineas.reduce((sum, linea) => sum.add(linea.debe), asiento.lineas[0].debe.mul(0));
      const haber = asiento.lineas.reduce((sum, linea) => sum.add(linea.haber), asiento.lineas[0].haber.mul(0));
      expect(debe.toString()).toBe('100');
      expect(haber.toString()).toBe('100');
    });

    it('contabiliza la inyeccion de capital con el evento DEUDA_RECIBIDA', async () => {
      const key = `capital-ok-${suffix}`;
      const before = await readSnapshot(userId);
      const resultado = await createCapital({
        montoRecibido: 250,
        moneda: 'CUP',
        tipo: 'DEUDA_EXTERNA',
        cuentaId: bankId,
        entidadPrestamista: `lender-${suffix}`,
        tasaInteres: 10,
        plazoMeses: 12,
        fechaOperacion: operationDate,
        descripcion: 'inyeccion formal de control',
        idempotencyKey: key,
      });
      const inyeccionId = (resultado as { id: string }).id;
      const after = await readSnapshot(userId);
      expect(after.balance).toBe(String(Number(before.balance) + 250));
      expect(after.inyecciones).toBe(before.inyecciones + 1);
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: { tenantId_origenTipo_origenId: { tenantId, origenTipo: 'inyeccion_capital', origenId: inyeccionId } },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.lineas).toHaveLength(2);
    });

    it('revierte la escritura operativa y el libro mayor cuando falla el insert del asiento', async () => {
      const key = `ajuste-ledger-fail-${suffix}`;
      const before = await readSnapshot(ledgerFailUserId);
      await expect(
        createAdjustment(
          {
            cuentaId: bankId,
            tipo: 'ingreso',
            monto: 500,
            moneda: 'CUP',
            descripcion: 'ajuste con failpoint de ledger',
            motivo: 'fallo forzado del asiento',
            fechaOperacion: operationDate,
            idempotencyKey: key,
          },
          ledgerFailUserId,
        ),
      ).rejects.toThrow('forced asiento failure');
      expect(await readSnapshot(ledgerFailUserId)).toEqual(before);
    });

    it('revierte el asiento ya contabilizado cuando la auditoria estricta falla despues', async () => {
      const key = `capital-audit-fail-${suffix}`;
      const before = await readSnapshot(auditFailUserId);
      await expect(
        createCapital(
          {
            montoRecibido: 750,
            moneda: 'CUP',
            tipo: 'DEUDA_EXTERNA',
            cuentaId: bankId,
            entidadPrestamista: `lender-${suffix}`,
            tasaInteres: 10,
            plazoMeses: 12,
            fechaOperacion: operationDate,
            descripcion: 'inyeccion con failpoint de auditoria',
            idempotencyKey: key,
          },
          auditFailUserId,
        ),
      ).rejects.toThrow('forced audit failure');
      const after = await readSnapshot(auditFailUserId);
      expect(after).toEqual(before);
      expect(after.ledger).toHaveLength(before.ledger.length);
    });
  },
);
