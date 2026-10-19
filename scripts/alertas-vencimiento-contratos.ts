/**
 * @description Cron de alertas de vencimiento de contratos (CTF-6). Genera
 *              alertas VENCIMIENTO_PROXIMO y CONTRATO_VENCIDO para contratos
 *              ACTIVO con fechaFin, con dedupe por día (idempotente: correrlo
 *              dos veces el mismo día no duplica alertas). B-medio: toda la
 *              corrida (lecturas + inserciones) va en una transacción con lock
 *              advisory, de modo que dos ejecuciones superpuestas tampoco
 *              duplican.
 *
 *              Programación diaria vía cron externo (mismo mecanismo que el
 *              cron de demos), p. ej. a las 06:00:
 *                0 6 * * *  cd /app && npx tsx scripts/alertas-vencimiento-contratos.ts >> cron.log 2>&1
 *
 *              Salida JSON: { contratosEvaluados, alertasCandidatas,
 *              omitidasDuplicadas, alertasCreadas }.
 */
import { PrismaClient } from "../src/generated/prisma";
import {
  calcularAlertasVencimiento,
  dedupeAlertasExistentes,
  type AlertaExistente,
} from "../src/features/contratos/lib/alertas-vencimiento";

const prisma = new PrismaClient();

async function main() {
  const hoy = new Date();

  const resumen = await prisma.$transaction(async (tx) => {
    // B-medio: lock advisory transaccional. Dos ejecuciones superpuestas del
    // cron (manual + programada) no pueden leer "sin alertas previas" a la vez
    // y duplicar las del mismo día: la segunda espera a que la primera haga
    // commit y su dedupe las vea persistidas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['contratos', 'alertas-vencimiento'])}, 0))`;

    const [contratos, configs] = await Promise.all([
      tx.contrato.findMany({
        where: { estado: "ACTIVO", fechaFin: { not: null } },
        select: { contratoId: true, tenantId: true, estado: true, fechaFin: true, diasAvisoVencimiento: true },
      }),
      tx.configuracionContratos.findMany({
        select: { tenantId: true, diasAvisoVencimiento: true },
      }),
    ]);

    const configsPorTenant = new Map(configs.map((c) => [c.tenantId, c.diasAvisoVencimiento]));

    const candidatas = calcularAlertasVencimiento(contratos, configsPorTenant, hoy);

    // Dedupe contra las alertas ya persistidas del conjunto candidato (mismo
    // contrato, tipo y día de fechaAlerta).
    const existentes = candidatas.length
      ? await tx.contratoAlerta.findMany({
          where: {
            contratoId: { in: candidatas.map((a) => a.contratoId) },
            tipo: { in: ["VENCIMIENTO_PROXIMO", "CONTRATO_VENCIDO"] },
          },
          select: { contratoId: true, tipo: true, fechaAlerta: true },
        })
      : ([] as AlertaExistente[]);

    const aCrear = dedupeAlertasExistentes(candidatas, existentes);

    if (aCrear.length > 0) {
      await tx.contratoAlerta.createMany({
        data: aCrear.map((a) => ({
          contratoId: a.contratoId,
          tipo: a.tipo,
          fechaAlerta: a.fechaAlerta,
          mensaje: a.mensaje,
          accionRequerida: a.accionRequerida,
        })),
      });
    }

    return {
      contratosEvaluados: contratos.length,
      alertasCandidatas: candidatas.length,
      alertasCreadas: aCrear.length,
    };
  });

  console.log(JSON.stringify({
    contratosEvaluados: resumen.contratosEvaluados,
    alertasCandidatas: resumen.alertasCandidatas,
    omitidasDuplicadas: resumen.alertasCandidatas - resumen.alertasCreadas,
    alertasCreadas: resumen.alertasCreadas,
  }));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(JSON.stringify({ error: e.message }));
  await prisma.$disconnect();
  process.exit(1);
});
