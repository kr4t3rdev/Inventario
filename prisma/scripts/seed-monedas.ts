import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding monedas...');

  // Crear moneda CUP por defecto (moneda principal)
  const cup = await prisma.moneda.upsert({
    where: { codigo: 'CUP' },
    update: {},
    create: {
      codigo: 'CUP',
      nombre: 'Peso Cubano',
      simbolo: '₱',
      esPrincipal: true,
      isActive: true,
    },
  });

  console.log('✅ Moneda CUP creada:', cup);

  // Crear USD como moneda secundaria común
  const usd = await prisma.moneda.upsert({
    where: { codigo: 'USD' },
    update: {},
    create: {
      codigo: 'USD',
      nombre: 'Dólar Estadounidense',
      simbolo: '$',
      esPrincipal: false,
      isActive: true,
    },
  });

  console.log('✅ Moneda USD creada:', usd);

  console.log('✅ Seeding de monedas completado');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding monedas:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
