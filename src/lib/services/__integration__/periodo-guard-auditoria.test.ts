/**
 * @description Test de integración real del guard de período contable cuando no
 * existe un período aplicable para la fecha de una operación formal.
 *
 * Reproduce el bloqueo observado en pruebas CT-1 (tenant PonzTest): registrar
 * una compra en un tenant sin período terminaba con «No se pudo persistir la
 * auditoría del período» (AUDITORIA_FALLIDA) en vez del diagnóstico accionable
 * «No existe un período contable para esta fecha», porque la auditoría del
 * intento se persistía con `periodoId: 'N/A'` y la FK obligatoria de
 * `auditoria_periodos` rechazaba la inserción.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  PeriodoGuard,
  type ContextoAuditoriaAsiento,
} from '@/lib/services/periodo-contable-guard';
import {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} from '../../../../scripts/ci/disposable-database.mjs';

assertDisposableDatabase(process.env);

const suffix = randomUUID().replaceAll('-', '');
const tenantSinPeriodo = `ct1_guard_noper_${suffix}`;
const tenantPeriodoCerrado = `ct1_guard_cerr_${suffix}`;
const userId = `ct1_guard_user_${suffix}`;
const previousGuardEnabled = process.env.PERIODO_GUARD_ENABLED;
const previousGuardMode = process.env.PERIODO_CONTABLE_MODE;

const contexto: ContextoAuditoriaAsiento = {
  actorId: userId,
  actorTipo: 'USUARIO',
  origen: { tipo: 'compra', id: `compra_ct1_${suffix}` },
};

/** Fecha sin período para ninguno de los dos tenants de la prueba. */
const fechaFueraDePeriodo = new Date(Date.UTC(2030, 4, 15, 12, 0, 0));

describe('guard de período con auditoría obligatoria en PostgreSQL aislado', { timeout: 60_000 }, () => {
  beforeAll(async () => {
    process.env.PERIODO_GUARD_ENABLED = '1';
    process.env.PERIODO_CONTABLE_MODE = 'enforce';

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

    await prisma.user.create({
      data: {
        userId,
        name: `Actor ${userId}`,
        email: `${userId}@test.local`,
        password: 'x',
      },
    });
    for (const tenantId of [tenantSinPeriodo, tenantPeriodoCerrado]) {
      await prisma.tenant.create({
        data: { tenantId, nombre: tenantId, slug: tenantId },
      });
    }
    // El segundo tenant sí tiene período, pero cerrado: la auditoría del
    // intento debe conservar su referencia real (no perder la FK).
    await prisma.periodoContable.create({
      data: {
        tenantId: tenantPeriodoCerrado,
        tipo: 'ANUAL',
        estado: 'CERRADO',
        fechaInicio: new Date(Date.UTC(2030, 0, 1)),
        fechaFin: new Date(Date.UTC(2030, 11, 31, 23, 59, 59, 999)),
      },
    });
  });

  it('rechaza la compra sin período con diagnóstico accionable y auditoría persistida', async () => {
    const resultado = await PeriodoGuard.assertWritable(
      fechaFueraDePeriodo,
      tenantSinPeriodo,
      'compra',
      contexto,
    );

    expect(resultado).toMatchObject({
      permitido: false,
      codigo: 'PERIODO_NO_EXISTE',
      modo: 'enforce',
    });
    expect(resultado.error).toContain('No existe un período contable');

    const auditoria = await prisma.auditoriaPeriodo.findFirstOrThrow({
      where: { tenantId: tenantSinPeriodo, evento: 'INTENTO_BYPASS' },
    });
    // Sin período aplicable no hay referencia válida: la auditoría se persiste
    // sin FK falsa y el motivo conserva la causa real.
    expect(auditoria.periodoId).toBeNull();
    expect(auditoria.motivo).toContain('No existe un período contable');
    expect(auditoria.payload).toMatchObject({ tipoOperacion: 'compra' });
  });

  it('audita el intento sobre un período existente conservando su referencia real', async () => {
    const resultado = await PeriodoGuard.assertWritable(
      fechaFueraDePeriodo,
      tenantPeriodoCerrado,
      'compra',
      contexto,
    );

    expect(resultado).toMatchObject({
      permitido: false,
      codigo: 'PERIODO_CERRADO',
      modo: 'enforce',
    });
    const auditoria = await prisma.auditoriaPeriodo.findFirstOrThrow({
      where: { tenantId: tenantPeriodoCerrado, evento: 'INTENTO_BYPASS' },
    });
    expect(auditoria.periodoId).not.toBeNull();
    expect(auditoria.motivo).toContain('está cerrado');
  });

  afterAll(async () => {
    if (previousGuardEnabled === undefined) delete process.env.PERIODO_GUARD_ENABLED;
    else process.env.PERIODO_GUARD_ENABLED = previousGuardEnabled;
    if (previousGuardMode === undefined) delete process.env.PERIODO_CONTABLE_MODE;
    else process.env.PERIODO_CONTABLE_MODE = previousGuardMode;
  });
});
