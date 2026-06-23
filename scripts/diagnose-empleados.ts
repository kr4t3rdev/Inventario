/**
 * @description Diagnóstico del estado real de planes, licencias y feature flags
 *              para entender por qué las rutas de empleados están bloqueadas.
 */
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log(' DIAGNÓSTICO: feature flags de empleados en planes y licencias')
  console.log('═══════════════════════════════════════════════════════════\n')

  // 1. Definición canónica de features por plan
  const plans = await prisma.plan.findMany({
    select: { planId: true, nombre: true, precio: true, features: true },
    orderBy: { precio: 'asc' },
  })

  console.log('📋 PLANES (definición canónica en BD):\n')
  for (const p of plans) {
    const f = (p.features as Record<string, boolean>) ?? {}
    console.log(`   ${p.nombre} ($${p.precio}/mes)`)
    console.log(`     - empleados : ${fmt(f.empleados)}`)
    console.log(`     - nomina    : ${fmt(f.nomina)}`)
    console.log(`     - asistencia: ${fmt(f.asistencia)}`)
    console.log(`     - vacaciones: ${fmt(f.vacaciones)}`)
    console.log('')
  }

  // 2. Licencias activas
  const licenses = await prisma.tenantLicense.findMany({
    where: { activa: true },
    select: {
      tenantLicenseId: true,
      planId: true,
      features: true,
      tenant: { select: { nombre: true, slug: true } },
    },
    take: 15,
  })

  console.log(`📜 LICENCIAS ACTIVAS (muestra de ${licenses.length}):\n`)
  let conFeatures = 0
  let sinFeatures = 0
  for (const l of licenses) {
    const f = (l.features as Record<string, boolean> | null) ?? null
    const plan = plans.find((p) => p.planId === l.planId)
    const planName = plan?.nombre ?? '?'
    if (f === null) {
      sinFeatures++
      console.log(`   ❌ ${l.tenant.nombre} → plan ${planName} | features: NULL`)
    } else {
      conFeatures++
      console.log(`   ✅ ${l.tenant.nombre} → plan ${planName}`)
      console.log(`     - empleados : ${fmt(f.empleados)}`)
      console.log(`     - nomina    : ${fmt(f.nomina)}`)
    }
  }

  console.log(`\n   Total: ${conFeatures} con features | ${sinFeatures} sin features\n`)

  // 3. Cuántos tenants hay sin licencia activa
  const tenantsSinLicencia = await prisma.tenant.count({
    where: { licencias: { none: { activa: true } } },
  })
  console.log(`🏢 Tenants SIN licencia activa: ${tenantsSinLicencia}`)

  const tenantsConLicencia = await prisma.tenant.count({
    where: { licencias: { some: { activa: true } } },
  })
  console.log(`🏢 Tenants CON licencia activa: ${tenantsConLicencia}`)

  // 4. Conclusión
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(' CONCLUSIÓN')
  console.log('═══════════════════════════════════════════════════════════\n')

  if (sinFeatures > 0) {
    console.log('⚠️  Hay licencias activas con features=null.')
    console.log('   Esas licencias se comportan como si TODOS los features')
    console.log('   estuvieran en false → todas las rutas de empleados')
    console.log('   van a fallar con FEATURE_NOT_AVAILABLE.')
    console.log('')
    console.log('   SOLUCIÓN: correr `pnpm sync:plan-features` una vez.')
  } else {
    console.log('✅ Todas las licencias activas tienen features poblados.')
  }

  await prisma.$disconnect()
}

function fmt(v: unknown): string {
  if (v === true) return '✅ true'
  if (v === false) return '❌ false'
  return '∅ null/undef'
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
