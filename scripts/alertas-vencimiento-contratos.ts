/**
 * @description Cron de alertas de vencimiento de contratos (CTF-6). Genera
 *              alertas VENCIMIENTO_PROXIMO y CONTRATO_VENCIDO para contratos
 *              ACTIVO con fechaFin, con dedupe por día (idempotente: correrlo
 *              dos veces el mismo día no duplica alertas).
 *
 *              Programación diaria vía cron externo (mismo mecanismo que el
 *              cron de demos), p. ej. a las 06:00:
 *                0 6 * * *  cd /app && npx tsx scripts/alertas-vencimiento-contratos.ts >> cron.log 2>&1
 *
 *              Salida JSON: { tenantsEvaluados, contratosEvaluados,
 *              alertasCandidatas, omitidasDuplicadas, alertasCreadas }.
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

  const [contratos, configs] = await Promise.all([
    prisma.contrato.findMany({
      where: { estado: "ACTIVO", fechaFin: { not: null } },
      select: { contratoId: true, tenantId: true, estado: true, fechaFin: true, diasAvisoVencimiento: true },
    }),
    prisma.configuracionContratos.findMany({
      select: { tenantId: true, diasAvisoVencimiento: true },
    }),
  ]);

  const configsPorTenant = new Map(configs.map((c) => [c.tenantId, c.diasAvisoVencimiento]));

  const candidatas = calcularAlertasVencimiento(contratos, configsPorTenant, hoy);

  // Dedupe contra las alertas ya persistidas del conjunto candidato (mismo
  // contrato, tipo y día de fechaAlerta).
  const existentes = candidatas.length
    ? await prisma.contratoAlerta.findMany({
        where: {
          contratoId: { in: candidatas.map((a) => a.contratoId) },
          tipo: { in: ["VENCIMIENTO_PROXIMO", "CONTRATO_VENCIDO"] },
        },
        select: { contratoId: true, tipo: true, fechaAlerta: true },
      })
    : ([] as AlertaExistente[]);

  const aCrear = dedupeAlertasExistentes(candidatas, existentes);

  if (aCrear.length > 0) {
    await prisma.contratoAlerta.createMany({
      data: aCrear.map((a) => ({
        contratoId: a.contratoId,
        tipo: a.tipo,
        fechaAlerta: a.fechaAlerta,
        mensaje: a.mensaje,
        accionRequerida: a.accionRequerida,
      })),
    });
  }

  console.log(JSON.stringify({
    tenantsEvaluados: configsPorTenant.size,
    contratosEvaluados: contratos.length,
    alertasCandidatas: candidatas.length,
    omitidasDuplicadas: candidatas.length - aCrear.length,
    alertasCreadas: aCrear.length,
  }));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(JSON.stringify({ error: e.message }));
  await prisma.$disconnect();
  process.exit(1);
});
