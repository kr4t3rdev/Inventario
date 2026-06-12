/**
 * @description Sincroniza los features de Plan y TenantLicense con la
 * definición canónica. Versión autocontenida (no depende de imports del seed).
 *
 * Ejecutar: npx tsx scripts/sync-plan-features-standalone.ts
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const PLAN_BASICO_FEATURES: Record<string, boolean> = {
  productos: true,
  'productos-stock-masivo': false,
  restock: true,
  categorias: true,
  'categorias-ean13': false,
  unidades: true,
  'listas-precios': false,
  almacenes: true,
  'puntos-venta': true,
  transferencias: true,
  mermas: true,
  'ventas-pos': true,
  'ventas-factura': false,
  'turnos-pos': false,
  'arqueo-caja': true,
  'cuadre-diario': false,
  ofertas: false,
  clientes: false,
  facturacion: false,
  'series-facturacion': false,
  proveedores: true,
  compras: true,
  servicios: true,
  gastos: true,
  contabilidad: true,
  'multi-moneda': false,
  'rentabilidad-compra': true,
  'reportes-financieros': false,
  'cuentas-cobrar': false,
  'cuentas-pagar': false,
  'prestamos-cash': false,
  'deudas-cash': false,
  anticipos: false,
  'analisis-estado-cuenta': false,
  'facturas-vencidas': false,
  produccion: false,
  reparaciones: false,
  empleados: false,
  nomina: false,
  'mi-empresa': true,
  'mi-empresa-ean13': false,
  contratos: false,
  'gestion-usuarios': true,
  notificaciones: false,
  configuracion: true,
  dashboard: true,
  'backups-semanal': true,
  'backups-diario': false,
  'backups-tiempo-real': false,
  'api-integraciones': false,
};

const PLAN_PROFESIONAL_FEATURES: Record<string, boolean> = {
  ...PLAN_BASICO_FEATURES,
  'listas-precios': true,
  'turnos-pos': true,
  'cuadre-diario': true,
  ofertas: true,
  clientes: true,
  facturacion: true,
  'series-facturacion': true,
  'multi-moneda': true,
  'reportes-financieros': true,
  empleados: true,
  notificaciones: true,
  'backups-semanal': false,
  'backups-diario': true,
};

const PLAN_EMPRESARIAL_FEATURES: Record<string, boolean> = {
  ...PLAN_PROFESIONAL_FEATURES,
  'productos-stock-masivo': true,
  'categorias-ean13': true,
  'ventas-factura': true,
  produccion: true,
  nomina: true,
  'mi-empresa-ean13': true,
  contratos: true,
  'cuentas-cobrar': true,
  'cuentas-pagar': true,
  'prestamos-cash': true,
  'deudas-cash': true,
  anticipos: true,
  'analisis-estado-cuenta': true,
  'facturas-vencidas': true,
  'backups-diario': false,
  'backups-tiempo-real': true,
  reparaciones: false,
  'api-integraciones': false,
};

const FEATURES_BY_PLAN_NAME: Record<string, Record<string, boolean>> = {
  'Básico': PLAN_BASICO_FEATURES,
  'Profesional': PLAN_PROFESIONAL_FEATURES,
  'Empresarial': PLAN_EMPRESARIAL_FEATURES,
};

async function main() {
  const plans = await prisma.plan.findMany({
    select: { planId: true, nombre: true, features: true },
  });

  for (const plan of plans) {
    const canonicalFeatures = FEATURES_BY_PLAN_NAME[plan.nombre];
    if (!canonicalFeatures) {
      console.log(`↪ Plan omitido sin definición canónica: ${plan.nombre}`);
      continue;
    }

    await prisma.plan.update({
      where: { planId: plan.planId },
      data: { features: canonicalFeatures },
    });

    const updatedLicenses = await prisma.tenantLicense.updateMany({
      where: { planId: plan.planId },
      data: { features: canonicalFeatures },
    });

    console.log(
      `✓ ${plan.nombre}: plan sincronizado y ${updatedLicenses.count} licencia(s) actualizada(s).`,
    );
  }

  console.log('✅ Features de planes y licencias sincronizados.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
