/**
 * @description Lista los tenants sin licencia activa para que el admin
 *              decida cuáles son reales y cuáles son basura/test.
 *
 *              Modo seguro: SOLO lee, no borra nada.
 */
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  const tenantsSinLicencia = await prisma.tenant.findMany({
    where: { licencias: { none: { activa: true } } },
    include: {
      memberships: {
        where: { isActive: true },
        include: {
          user: {
            select: { userId: true, name: true, email: true, isActive: true },
          },
        },
      },
      _count: {
        select: {
          productos: true,
          ventas: true,
          empleados: true,
        },
      },
    },
  })

  console.log(
    `🏢 ${tenantsSinLicencia.length} tenants sin licencia activa:\n`,
  )

  for (const t of tenantsSinLicencia) {
    const userCount = t.memberships.length
    const dataCount = t._count.productos + t._count.ventas + t._count.empleados

    console.log(`┌─ ${t.nombre} (slug: ${t.slug})`)
    console.log(`│  tenantId: ${t.tenantId}`)
    console.log(`│  memberships activas: ${userCount}`)
    console.log(
      `│  datos: ${t._count.productos} productos, ${t._count.ventas} ventas, ${t._count.empleados} empleados`,
    )
    if (t.memberships.length > 0) {
      console.log(`│  usuarios:`)
      for (const m of t.memberships) {
        console.log(
          `│    - ${m.user.name} <${m.user.email}> [${m.tenantRole}] (activo: ${m.user.isActive})`,
        )
      }
    }
    if (dataCount > 0) {
      console.log(`│  ⚠️  tiene DATOS DE NEGOCIO — REVISAR antes de borrar`)
    } else {
      console.log(`│  ✅ sin datos, candidato a limpieza`)
    }
    console.log(`└─`)
    console.log()
  }

  // Resumen
  const conDatos = tenantsSinLicencia.filter(
    (t) => t._count.productos + t._count.ventas + t._count.empleados > 0,
  )
  const sinDatos = tenantsSinLicencia.filter(
    (t) => t._count.productos + t._count.ventas + t._count.empleados === 0,
  )
  const conUsuariosActivos = tenantsSinLicencia.filter(
    (t) => t.memberships.length > 0,
  )

  console.log('═══════════════════════════════════════════════════════════')
  console.log(' RESUMEN')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`Total: ${tenantsSinLicencia.length}`)
  console.log(`  - Con datos de negocio: ${conDatos.length}`)
  console.log(`  - Sin datos de negocio: ${sinDatos.length}`)
  console.log(`  - Con usuarios activos: ${conUsuariosActivos.length}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
