/**
 * @description Backfill de feature flags financieros para planes y licencias ya existentes.
 *
 * Uso:
 *   pnpm tsx prisma/seed/backfill-accounting-features.ts
 */

import { Prisma, PrismaClient } from '../../src/generated/prisma';
import {
  PLAN_BASICO_FEATURES,
  PLAN_EMPRESARIAL_FEATURES,
  PLAN_PROFESIONAL_FEATURES,
} from './plans-seed';

const prisma = new PrismaClient();

const ACCOUNTING_FEATURE_KEYS = [
  'gastos',
  'contabilidad',
  'transferencias-bancarias',
  'ajustes-bancarios',
  'multi-moneda',
  'rentabilidad-compra',
  'inyeccion-capital',
  'reportes-financieros',
  'cuentas-cobrar',
  'cuentas-pagar',
  'prestamos-cash',
  'deudas-cash',
  'anticipos',
  'analisis-estado-cuenta',
  'facturas-vencidas',
] as const;

const PLAN_ACCOUNTING_FEATURES_BY_NAME: Record<string, Record<string, boolean>> = {
  'Básico': pickAccountingFeatures(PLAN_BASICO_FEATURES),
  Profesional: pickAccountingFeatures(PLAN_PROFESIONAL_FEATURES),
  Empresarial: pickAccountingFeatures(PLAN_EMPRESARIAL_FEATURES),
};

export const PLAN_DESCRIPTIONS_BY_NAME: Record<string, string> = {
  Profesional:
    'PYME en crecimiento con facturación, multi-moneda, cuentas por cobrar y pagar, empleados, clientes y backups diarios.',
  Empresarial:
    'Máxima potencia con producción, nómina, generación EAN-13 y backups cada hora + restauración point-in-time.',
};

type JsonObject = Record<string, unknown>;

function pickAccountingFeatures(features: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(
    ACCOUNTING_FEATURE_KEYS.map((key) => [key, features[key]])
  );
}

function coerceJsonObject(value: unknown): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return {};
}

export function mergeAccountingFeatures(
  currentFeatures: unknown,
  planName: string,
): Record<string, unknown> | null {
  const accountingFeatures = PLAN_ACCOUNTING_FEATURES_BY_NAME[planName];
  if (!accountingFeatures) return null;

  return {
    ...coerceJsonObject(currentFeatures),
    ...accountingFeatures,
  };
}

async function backfillPlanAccountingFeatures(): Promise<number> {
  const plans = await prisma.plan.findMany({
    select: {
      planId: true,
      nombre: true,
      features: true,
    },
  });

  let updatedPlans = 0;

  for (const plan of plans) {
    const mergedFeatures = mergeAccountingFeatures(plan.features, plan.nombre);
    if (!mergedFeatures) {
      console.warn(`⚠️ Se omite plan sin preset conocido: ${plan.nombre}`);
      continue;
    }

    await prisma.plan.update({
      where: { planId: plan.planId },
      data: {
        features: mergedFeatures as Prisma.InputJsonValue,
        ...(PLAN_DESCRIPTIONS_BY_NAME[plan.nombre] && {
          descripcion: PLAN_DESCRIPTIONS_BY_NAME[plan.nombre],
        }),
      },
    });

    updatedPlans++;
    console.log(`✅ Plan actualizado: ${plan.nombre}`);
  }

  return updatedPlans;
}

export async function backfillAccountingFeatures(): Promise<{
  updatedPlans: number;
  updatedLicenses: number;
}> {
  const updatedPlans = await backfillPlanAccountingFeatures();

  return {
    updatedPlans,
    updatedLicenses: 0,
  };
}

if (require.main === module) {
  backfillAccountingFeatures()
    .then((result) => {
      console.log(
        `🎯 Backfill completado. Planes: ${result.updatedPlans}, licencias: ${result.updatedLicenses}`
      );
    })
    .catch((error) => {
      console.error('❌ Error en backfill de accounting features:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export {
  ACCOUNTING_FEATURE_KEYS,
  PLAN_ACCOUNTING_FEATURES_BY_NAME,
  pickAccountingFeatures,
};
