/**
 * @description Test de integración real del rollback físico formal del anticipo
 * (R6.1, familia de anticipos).
 *
 * El anticipo moves efectivo de la tesorería en dos momentos formalizados: la
 * recepción o entrega de los fondos (`ANTICIPO_CLIENTE_RECIBIDO` /
 * `ANTICIPO_PROVEEDOR_ENTREGADO`) y su devolución o reintegro
 * (`ANTICIPO_CLIENTE_DEVUELTO` / `ANTICIPO_PROVEEDOR_REINTEGRADO`). Cada
 * movimiento toca el anticipo, sus movimientos, la tesorería y el libro mayor en
 * la misma transacción. El test comprueba, en modo `enforce`, que el fallo del
 * insert del asiento revierte el conjunto completo.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import {
  seedPlanContable,
  seedPlantillasGlobales,
} from '@/features/contabilidad-formal/services/seed-plan-contable';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const auth = vi.hoisted(() => ({ user: null as AuthenticatedUser | null }));
vi.mock('@/lib/server-actions/get-current-user', () => ({
  getCurrentUser: async () => auth.user,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
  createAnticipoAction,
  registrarMovimientoEfectivoAnticipoAction,
  devolverFondosAnticipoAction,
} = await import('@/features/contabilidad/actions-anticipos');

const suffix = randomUUID().replaceAll('-', '');
const tenantId = `formal_anticipo_${suffix}`;
const userId = `formal_user_${suffix}`;
const ledgerFailUserId = `formal_ledger_fail_${suffix}`;
const bancoId = `formal_anticipo_bank_${suffix}`;
const ledgerFailureFunction = `formal_anticipo_ledger_failure_${suffix}`;
const ledgerFailureTrigger = `formal_anticipo_ledger_trigger_${suffix}`;
const previousFormalMode = process.env.CONTABILIDAD_FORMAL_MODE;

let clienteId = '';
let tipoPagoId = '';

/**
 * @description Construye el actor autenticado de la prueba para el tenant aislado.
 * @param {string} actorId - Identificador del actor (marca el failpoint cuando hace falta).
 * @returns {AuthenticatedUser} Actor con tenant y plan fijo.
 */
function userFor(actorId: string): AuthenticatedUser {
  return {
    userId: actorId,
    name: `Actor ${actorId}`,
    email: `${actorId}@test.local`,
    role: 'regularUser',
    isActive: true,
    tenantId,
    tenantRole: 'manager',
    planFeatures: { anticipos: true },
  } as unknown as AuthenticatedUser;
}

/**
 * @description Ejecuta una action de anticipos con el actor indicado.
 * @param {() => Promise<unknown>} accion - Invocacion de la action.
 * @param {string} actorId - Actor que ejecuta la operacion.
 * @returns {Promise<{ success: boolean; error?: { message?: string } }>} Respuesta de la action.
 */
async function conActor(accion: () => Promise<unknown>, actorId = userId) {
  auth.user = userFor(actorId);
  return (await accion()) as { success: boolean; error?: { message?: string } };
}

/**
 * @description Captura el estado del anticipo, la tesoreria y el libro mayor
 * para comparar antes/despues del failpoint.
 * @returns {Promise<object>} Fotografia del estado persistido del tenant.
 */
async function readSnapshot() {
  const [anticipos, movimientos, banco, asientos, lineas] = await Promise.all([
    prisma.anticipo.findMany({
      where: { tenantId },
      select: {
        anticipoId: true,
        estado: true,
        montoOriginal: true,
        montoFinanciado: true,
        saldoDisponible: true,
      },
      orderBy: { anticipoId: 'asc' },
    }),
    prisma.anticipoMovimiento.findMany({
      where: { anticipo: { tenantId } },
      select: { movimientoId: true, tipoMovimiento: true, monto: true, saldoDespues: true },
      orderBy: { movimientoId: 'asc' },
    }),
    prisma.cuentaBancaria.findUniqueOrThrow({
      where: { cuentaId: bancoId },
      select: { saldo: true },
    }),
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
      },
    }),
    prisma.asientoLinea.count({ where: { tenantId } }),
  ]);
  return {
    anticipos: anticipos.map((row) => ({
      id: row.anticipoId,
      estado: row.estado,
      montoOriginal: row.montoOriginal.toString(),
      montoFinanciado: row.montoFinanciado.toString(),
      saldoDisponible: row.saldoDisponible.toString(),
    })),
    movimientos: movimientos.map((row) => ({
      id: row.movimientoId,
      tipo: row.tipoMovimiento,
      monto: row.monto.toString(),
      saldoDespues: row.saldoDespues.toString(),
    })),
    banco: banco.saldo.toString(),
    lineas,
    ledger: asientos.map((row) => ({
      id: row.asientoId,
      origenTipo: row.origenTipo,
      origenId: row.origenId,
      estado: row.estado,
      hash: row.hash,
      hashAnterior: row.hashAnterior,
    })),
  };
}

describe(
  'rollback fisico formal del anticipo en PostgreSQL aislado',
  { timeout: 120_000 },
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
          nombre: `formal-anticipo-${suffix}`,
          slug: `formal-anticipo-${suffix}`,
        },
      });
      // Los actores existen como usuarios reales: el anticipo los referencia
      // como creador y el trigger los distingue por su identificador.
      for (const actorId of [userId, ledgerFailUserId]) {
        await prisma.user.create({
          data: {
            userId: actorId,
            name: `Actor ${actorId}`,
            email: `${actorId}@test.local`,
            password: 'x',
          },
        });
      }
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

      const cliente = await prisma.cliente.create({
        data: { nombre: `Cliente ${suffix}`, tenantId },
      });
      clienteId = cliente.clienteId;
      await prisma.cuentaBancaria.create({
        data: {
          cuentaId: bancoId,
          tenantId,
          nombreBanco: `formal-anticipo-bank-${suffix}`,
          numeroCuenta: `anticipo-${suffix}`,
          tipoCuenta: 'EFECTIVO',
          moneda: 'CUP',
          saldo: 0,
        },
      });
      const tipoPago = await prisma.tipoPago.create({
        data: {
          tenantId,
          nombre: `Efectivo ${suffix}`,
          requiereCuenta: true,
          cuentaDefecto: bancoId,
        },
      });
      tipoPagoId = tipoPago.tipoId;

      await prisma.$executeRawUnsafe(
        `CREATE FUNCTION public."${ledgerFailureFunction}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tenantId" = '${tenantId}' AND NEW."createdBy" LIKE 'formal_ledger_fail_%' THEN RAISE EXCEPTION 'forced asiento failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END $$`,
      );
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${ledgerFailureTrigger}" BEFORE INSERT ON public."asientos" FOR EACH ROW EXECUTE FUNCTION public."${ledgerFailureFunction}"()`,
      );
    });

    afterAll(async () => {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${ledgerFailureTrigger}" ON public."asientos"`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${ledgerFailureFunction}"()`);
      if (previousFormalMode === undefined) delete process.env.CONTABILIDAD_FORMAL_MODE;
      else process.env.CONTABILIDAD_FORMAL_MODE = previousFormalMode;
      auth.user = null;
    });

    /**
     * @description Crea un anticipo de cobro reservado para el cliente de prueba.
     * @param {number} monto - Monto reservado del anticipo.
     * @returns {Promise<string>} Identificador del anticipo creado.
     */
    async function crearAnticipoReservado(monto: number): Promise<string> {
      const resultado = await conActor(() =>
        createAnticipoAction({
          tipo: 'COBRO',
          monto,
          moneda: 'CUP',
          clienteId,
          concepto: `Anticipo de prueba ${suffix}`,
        }),
      );
      expect(resultado.success).toBe(true);
      const anticipoId = (resultado as { data?: { anticipo?: { anticipoId?: string } } }).data?.anticipo
        ?.anticipoId;
      expect(typeof anticipoId).toBe('string');
      return anticipoId as string;
    }

    it('contabiliza la recepcion de fondos del anticipo', async () => {
      const anticipoId = await crearAnticipoReservado(500);
      const before = await readSnapshot();

      const resultado = await conActor(() =>
        registrarMovimientoEfectivoAnticipoAction({
          anticipoId,
          cuentaId: bancoId,
          tipoPagoId,
          monto: 500,
          idempotencyKey: `formal-anticipo-recepcion-${suffix}`,
        }),
      );

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      expect(after.movimientos).toHaveLength(before.movimientos.length + 1);
      expect(Number(after.banco)).toBe(Number(before.banco) + 500);
      const anticipo = after.anticipos.find((row) => row.id === anticipoId);
      expect(anticipo?.montoFinanciado).toBe('500');
      expect(anticipo?.saldoDisponible).toBe('500');
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const movimiento = after.movimientos.at(-1);
      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'anticipo_movimiento',
            origenId: movimiento?.id as string,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(asiento.lineas).toHaveLength(2);
      const debe = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.debe),
        asiento.lineas[0].debe.mul(0),
      );
      const haber = asiento.lineas.reduce(
        (sum, linea) => sum.add(linea.haber),
        asiento.lineas[0].haber.mul(0),
      );
      expect(debe.toString()).toBe('500');
      expect(haber.toString()).toBe('500');
    });

    it('revierte la recepcion de fondos cuando falla el insert del asiento', async () => {
      const anticipoId = await crearAnticipoReservado(400);
      const before = await readSnapshot();

      const resultado = await conActor(
        () =>
          registrarMovimientoEfectivoAnticipoAction({
            anticipoId,
            cuentaId: bancoId,
            tipoPagoId,
            monto: 400,
            idempotencyKey: `formal-anticipo-recepcion-fail-${suffix}`,
          }),
        ledgerFailUserId,
      );

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });

    it('contabiliza la devolucion de fondos del anticipo', async () => {
      const anticipoId = await crearAnticipoReservado(300);
      const recibido = await conActor(() =>
        registrarMovimientoEfectivoAnticipoAction({
          anticipoId,
          cuentaId: bancoId,
          tipoPagoId,
          monto: 300,
          idempotencyKey: `formal-anticipo-recepcion-dev-${suffix}`,
        }),
      );
      expect(recibido.success).toBe(true);
      const before = await readSnapshot();

      const resultado = await conActor(() =>
        devolverFondosAnticipoAction({
          anticipoId,
          cuentaId: bancoId,
          tipoPagoId,
          monto: 300,
          idempotencyKey: `formal-anticipo-devolucion-${suffix}`,
        }),
      );

      expect(resultado.success).toBe(true);
      const after = await readSnapshot();
      expect(after.movimientos).toHaveLength(before.movimientos.length + 1);
      expect(Number(after.banco)).toBe(Number(before.banco) - 300);
      const anticipo = after.anticipos.find((row) => row.id === anticipoId);
      expect(anticipo?.saldoDisponible).toBe('0');
      expect(after.ledger).toHaveLength(before.ledger.length + 1);

      const movimiento = after.movimientos.at(-1);
      const asiento = await prisma.asiento.findUniqueOrThrow({
        where: {
          tenantId_origenTipo_origenId: {
            tenantId,
            origenTipo: 'anticipo_movimiento',
            origenId: movimiento?.id as string,
          },
        },
        include: { lineas: { orderBy: { orden: 'asc' } } },
      });
      expect(asiento.estado).toBe('CONTABILIZADO');
      expect(asiento.lineas).toHaveLength(2);
    });

    it('revierte la devolucion de fondos cuando falla el insert del asiento', async () => {
      const anticipoId = await crearAnticipoReservado(200);
      const recibido = await conActor(() =>
        registrarMovimientoEfectivoAnticipoAction({
          anticipoId,
          cuentaId: bancoId,
          tipoPagoId,
          monto: 200,
          idempotencyKey: `formal-anticipo-recepcion-dev-fail-${suffix}`,
        }),
      );
      expect(recibido.success).toBe(true);
      const before = await readSnapshot();

      const resultado = await conActor(
        () =>
          devolverFondosAnticipoAction({
            anticipoId,
            cuentaId: bancoId,
            tipoPagoId,
            monto: 200,
            idempotencyKey: `formal-anticipo-devolucion-fail-${suffix}`,
          }),
        ledgerFailUserId,
      );

      expect(resultado.success).toBe(false);
      expect(await readSnapshot()).toEqual(before);
    });
  },
);
