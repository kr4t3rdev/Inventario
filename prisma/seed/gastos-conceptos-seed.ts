/**
 * Seed script para crear Conceptos y Elementos de Gastos de Explotación
 * Ejecutar: npx tsx prisma/seed/gastos-conceptos-seed.ts
 */

import prisma from '../../src/lib/prisma'

interface ConceptoSeed {
  nombre: string
  descripcion: string
  elementos: string[]
}

const conceptosData: ConceptoSeed[] = [
  {
    nombre: 'Arrendamiento',
    descripcion: 'Gastos de alquiler de locales y oficinas',
    elementos: ['Local Comercial', 'Oficina Central', 'Almacén', 'Vivienda Empleado'],
  },
  {
    nombre: 'Mantenimiento',
    descripcion: 'Gastos de mantenimiento y reparaciones',
    elementos: ['Reparaciones', 'Mantenimiento Preventivo', 'Limpieza', 'Jardinería'],
  },
  {
    nombre: 'Telefonía',
    descripcion: 'Gastos de comunicaciones y telefonía',
    elementos: ['Línea Fija', 'Telefonía Móvil', 'Internet', 'Videollamadas'],
  },
  {
    nombre: 'Servicios Públicos',
    descripcion: 'Gastos de servicios básicos',
    elementos: ['Electricidad', 'Agua', 'Gas', 'Recogida de Basura'],
  },
  {
    nombre: 'Seguros',
    descripcion: 'Pólizas de seguros',
    elementos: ['Seguro Local', 'Seguro Responsabilidad', 'Seguro Equipo'],
  },
  {
    nombre: 'Impuestos y Tasas',
    descripcion: 'Impuestos, licencias y tasas administrativas',
    elementos: ['Impuestos Municipales', 'Licencias', 'Tasas Administrativas'],
  },
  {
    nombre: 'Suministros',
    descripcion: 'Materiales y suministros varios',
    elementos: ['Material de Oficina', 'Material de Limpieza', 'Equipos Informáticos'],
  },
  {
    nombre: 'Transportes',
    descripcion: 'Gastos de transporte y movilidad',
    elementos: ['Combustible', 'Peajes', 'Alquiler Vehículo', 'Mensajería'],
  },
]

async function main() {
  console.log('🌱 Sembrando Conceptos y Elementos de Gastos DE...')

  let createdCount = 0
  let skippedCount = 0

  for (const concepto of conceptosData) {
    // Check if concept already exists
    const existing = await prisma.gastoConcepto.findUnique({
      where: { nombre: concepto.nombre },
    })

    if (existing) {
      console.log(`⏭️  Concepto "${concepto.nombre}" ya existe, saltando...`)
      skippedCount++
      continue
    }

    // Create concepto with elementos
    await prisma.gastoConcepto.create({
      data: {
        nombre: concepto.nombre,
        descripcion: concepto.descripcion,
        isActive: true,
        elementos: {
          create: concepto.elementos.map((elem) => ({
            nombre: elem,
            isActive: true,
          })),
        },
      },
    })

    console.log(`✅ Concepto "${concepto.nombre}" creado con ${concepto.elementos.length} elementos`)
    createdCount++
  }

  console.log(`\n📊 Resumen: ${createdCount} conceptos creados, ${skippedCount} ya existentes`)
  console.log('✅ Seed completado')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
