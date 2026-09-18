import { PrismaClient } from '../../src/generated/prisma'

const prisma = new PrismaClient()
const DEMO_TENANT_ID = 'demo-tenant'

export async function seedContabilidad(client: PrismaClient = prisma) {
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
    await client.moneda.upsert({
      where: { codigo: moneda.codigo },
      update: {},
      create: moneda
    })
  }

  // Crear tasas de cambio iniciales
  const tasasIniciales = [
    {
      tasaId: 'contabilidad_usd_cup',
      monedaOrigenId: 'USD',
      monedaDestino: 'CUP',
      tasa: 120.0
    },
    {
      tasaId: 'contabilidad_eur_cup',
      monedaOrigenId: 'EUR',
      monedaDestino: 'CUP',
      tasa: 130.0
    }
  ]

  for (const tasa of tasasIniciales) {
    await client.tasaCambio.upsert({
      where: { tasaId: tasa.tasaId },
      update: {
        monedaOrigenId: tasa.monedaOrigenId,
        monedaDestino: tasa.monedaDestino,
        tasa: tasa.tasa,
      },
      create: tasa
    })
  }

  // Crear tipos de pago básicos
  const tiposPago = [
    {
      tipoId: `contabilidad_efectivo__${DEMO_TENANT_ID}`,
      nombre: 'Efectivo',
      descripcion: 'Pago en efectivo',
      requiereCuenta: false,
      isActive: true
    },
    {
      tipoId: `contabilidad_transferencia__${DEMO_TENANT_ID}`,
      nombre: 'Transferencia Bancaria',
      descripcion: 'Transferencia electrónica',
      requiereCuenta: true,
      isActive: true
    },
    {
      tipoId: `contabilidad_debito__${DEMO_TENANT_ID}`,
      nombre: 'Tarjeta de Débito',
      descripcion: 'Pago con tarjeta de débito',
      requiereCuenta: true,
      isActive: true
    },
    {
      tipoId: `contabilidad_credito__${DEMO_TENANT_ID}`,
      nombre: 'Tarjeta de Crédito',
      descripcion: 'Pago con tarjeta de crédito',
      requiereCuenta: true,
      isActive: true
    }
  ]

  for (const tipoPago of tiposPago) {
    await client.tipoPago.upsert({
      where: { tipoId: tipoPago.tipoId },
      update: {
        nombre: tipoPago.nombre,
        descripcion: tipoPago.descripcion,
        requiereCuenta: tipoPago.requiereCuenta,
        isActive: tipoPago.isActive
      },
      create: { ...tipoPago, tenantId: DEMO_TENANT_ID }
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
    await client.cuentaBancaria.upsert({
      where: {
        tenantId_numeroCuenta: {
          tenantId: DEMO_TENANT_ID,
          numeroCuenta: cuenta.numeroCuenta,
        },
      },
      update: {
        nombreBanco: cuenta.nombreBanco,
        tipoCuenta: cuenta.tipoCuenta,
        moneda: cuenta.moneda,
        isActive: cuenta.isActive,
      },
      create: {
        ...cuenta,
        tenantId: DEMO_TENANT_ID,
      },
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
