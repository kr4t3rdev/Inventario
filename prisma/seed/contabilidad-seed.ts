import { PrismaClient } from '../../src/generated/prisma'

const prisma = new PrismaClient()

export async function seedContabilidad() {
  console.log('🌱 Seeding contabilidad data...')

  // Crear monedas básicas
  const monedas = [
    {
      codigo: 'CUP',
      nombre: 'Peso Cubano',
      simbolo: 'CUP',
      esPrincipal: true,
      isActive: true
    },
    {
      codigo: 'USD',
      nombre: 'Dólar Americano',
      simbolo: '$',
      esPrincipal: false,
      isActive: true
    },
    {
      codigo: 'EUR',
      nombre: 'Euro',
      simbolo: '€',
      esPrincipal: false,
      isActive: true
    }
  ]

  for (const moneda of monedas) {
    await prisma.moneda.upsert({
      where: { codigo: moneda.codigo },
      update: {},
      create: moneda
    })
  }

  // Crear tasas de cambio iniciales
  const tasasIniciales = [
    {
      monedaOrigenId: 'USD',
      monedaDestino: 'CUP',
      tasa: 120.0
    },
    {
      monedaOrigenId: 'EUR',
      monedaDestino: 'CUP',
      tasa: 130.0
    }
  ]

  for (const tasa of tasasIniciales) {
    await prisma.tasaCambio.create({
      data: tasa
    })
  }

  // Crear tipos de pago básicos
  const tiposPago = [
    {
      nombre: 'Efectivo',
      descripcion: 'Pago en efectivo',
      requiereCuenta: false,
      isActive: true
    },
    {
      nombre: 'Transferencia Bancaria',
      descripcion: 'Transferencia electrónica',
      requiereCuenta: true,
      isActive: true
    },
    {
      nombre: 'Tarjeta de Débito',
      descripcion: 'Pago con tarjeta de débito',
      requiereCuenta: true,
      isActive: true
    },
    {
      nombre: 'Tarjeta de Crédito',
      descripcion: 'Pago con tarjeta de crédito',
      requiereCuenta: true,
      isActive: true
    }
  ]

  for (const tipoPago of tiposPago) {
    await prisma.tipoPago.create({
      data: tipoPago
    })
  }

  // Crear cuentas bancarias de ejemplo
  const cuentasBancarias = [
    {
      nombreBanco: 'Banco Popular de Ahorro',
      numeroCuenta: '9200-0000-0001',
      tipoCuenta: 'corriente',
      saldo: 50000.00,
      moneda: 'CUP',
      isActive: true
    },
    {
      nombreBanco: 'Banco Metropolitano',
      numeroCuenta: '9210-0000-0001',
      tipoCuenta: 'ahorros',
      saldo: 25000.00,
      moneda: 'CUP',
      isActive: true
    },
    {
      nombreBanco: 'Banco Internacional de Comercio',
      numeroCuenta: '9220-0000-0001',
      tipoCuenta: 'empresarial',
      saldo: 1000.00,
      moneda: 'USD',
      isActive: true
    }
  ]

  for (const cuenta of cuentasBancarias) {
    await prisma.cuentaBancaria.create({
      data: cuenta
    })
  }

  console.log('✅ Contabilidad seed data created successfully')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedContabilidad()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}