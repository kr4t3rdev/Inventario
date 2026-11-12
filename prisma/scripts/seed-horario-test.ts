/**
 * @description Seed de prueba para visualizar gráficos de horario efectivo de ventas.
 * Crea un tenant, usuario, punto de venta, cuenta bancaria, tipos de pago, monedas
 * y ventas distribuidas en diferentes horarios durante las últimas 2 semanas.
 * @returns {void}
 */

import { PrismaClient } from '../../src/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Patrones de ventas por hora (peso relativo de ventas por hora del día)
// Simula un negocio con horas pico de 8-12 y 14-18
const VENTAS_POR_HORA: Record<number, number> = {
  0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  6: 1, 7: 3, 8: 8, 9: 12, 10: 15, 11: 14,
  12: 10, 13: 6, 14: 9, 15: 13, 16: 14, 17: 11,
  18: 7, 19: 4, 20: 2, 21: 1, 22: 0, 23: 0,
};

// Montos típicos por venta (en centavos)
const MONTOS_TIPICOS = [5000, 8000, 12000, 15000, 20000, 25000, 30000, 35000, 50000, 75000, 100000];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🌱 Iniciando seed de horario de ventas...\n');

  // 1. Crear monedas
  console.log('💰 Creando monedas...');
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
  console.log(`  ✅ Monedas: ${cup.codigo}, ${usd.codigo}`);

  // 2. Crear tenant
  console.log('🏢 Creando tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      tenantId: 'tenant-horario-test',
      nombre: 'Tienda Demo Horario',
      slug: 'tienda-demo-horario',
    },
  });
  console.log(`  ✅ Tenant: ${tenant.nombre}`);

  // 3. Crear usuario
  console.log('👤 Creando usuario...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      name: 'Usuario Prueba',
      email: 'prueba@horario.test',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`  ✅ Usuario: ${user.email} (password: password123)`);

  // 4. Crear membresía del tenant
  console.log('🔗 Creando membresía del tenant...');
  await prisma.tenantMembership.create({
    data: {
      tenantId: tenant.tenantId,
      userId: user.userId,
      tenantRole: 'manager',
      isActive: true,
    },
  });
  console.log('  ✅ Membresía creada');

  // 5. Crear cuenta bancaria
  console.log('🏦 Creando cuenta bancaria...');
  const cuenta = await prisma.cuentaBancaria.create({
    data: {
      tenantId: tenant.tenantId,
      nombreBanco: 'Banco de Prueba',
      numeroCuenta: '1234567890',
      tipoCuenta: 'CAJA',
      saldo: 0,
      moneda: 'CUP',
      isActive: true,
    },
  });
  console.log(`  ✅ Cuenta: ${cuenta.nombreBanco} - ${cuenta.numeroCuenta}`);

  // 6. Crear tipo de pago
  console.log('💳 Creando tipos de pago...');
  const tipoEfectivo = await prisma.tipoPago.create({
    data: {
      tenantId: tenant.tenantId,
      nombre: 'Efectivo',
      descripcion: 'Pago en efectivo',
      requiereCuenta: true,
      cuentaDefecto: cuenta.cuentaId,
      isActive: true,
    },
  });

  const tipoTarjeta = await prisma.tipoPago.create({
    data: {
      tenantId: tenant.tenantId,
      nombre: 'Tarjeta',
      descripcion: 'Pago con tarjeta',
      requiereCuenta: true,
      cuentaDefecto: cuenta.cuentaId,
      isActive: true,
    },
  });

  const tipoTransferencia = await prisma.tipoPago.create({
    data: {
      tenantId: tenant.tenantId,
      nombre: 'Transferencia',
      descripcion: 'Transferencia bancaria',
      requiereCuenta: true,
      cuentaDefecto: cuenta.cuentaId,
      isActive: true,
    },
  });
  console.log(`  ✅ Tipos de pago: Efectivo, Tarjeta, Transferencia`);

  // 7. Crear punto de venta
  console.log('🏪 Creando punto de venta...');
  const puntoDeVenta = await prisma.puntoDeVenta.create({
    data: {
      tenantId: tenant.tenantId,
      nombre: 'Caja Principal',
      ubicacion: 'Local principal',
      tipoCaja: 'PRINCIPAL',
    },
  });
  console.log(`  ✅ Punto de venta: ${puntoDeVenta.nombre}`);

  // 8. Crear ventas distribuidas por horario
  console.log('📊 Creando ventas distribuidas por horario...');
  const tiposPago = [tipoEfectivo, tipoTarjeta, tipoTransferencia];
  const ahora = new Date();
  const diasAtras = 14; // Últimas 2 semanas

  let totalVentas = 0;

  for (let diaOffset = 0; diaOffset < diasAtras; diaOffset++) {
    const fechaBase = new Date(ahora);
    fechaBase.setDate(fechaBase.getDate() - diaOffset);
    fechaBase.setHours(0, 0, 0, 0);

    // Generar ventas para cada hora del día
    for (let hora = 0; hora < 24; hora++) {
      const numVentas = VENTAS_POR_HORA[hora] || 0;

      for (let v = 0; v < numVentas; v++) {
        // Hora aleatoria dentro de la hora actual (±30 min)
        const ventaFecha = new Date(fechaBase);
        ventaFecha.setHours(hora, randomInt(0, 59), randomInt(0, 59), 0);

        const monto = randomFrom(MONTOS_TIPICOS);
        const cantidad = randomInt(1, 5);
        const tipoPago = randomFrom(tiposPago);

        // Crear venta
        const venta = await prisma.venta.create({
          data: {
            tenantId: tenant.tenantId,
            puntoDeVentaId: puntoDeVenta.pvId,
            cantidad,
            total: monto,
            createdAt: ventaFecha,
            estado: 'ENTREGADA',
            esVentaUnica: true,
          },
        });

        // Crear reconciliación
        await prisma.reconciliacionVenta.create({
          data: {
            tenantId: tenant.tenantId,
            ventaId: venta.ventaId,
            cuentaId: cuenta.cuentaId,
            tipoPagoId: tipoPago.tipoId,
            monto: monto,
            moneda: 'CUP',
            fechaReconciliacion: ventaFecha,
            reconciliadoPor: user.userId,
          },
        });

        totalVentas++;
      }
    }
  }

  console.log(`  ✅ Ventas creadas: ${totalVentas} en ${diasAtras} días`);

  // 9. Crear algunas ventas de servicios también
  console.log('🔧 Creando ventas de servicios...');

  // Primero crear un servicio
  const servicio = await prisma.servicios.create({
    data: {
      tenantId: tenant.tenantId,
      nombre: 'Reparación',
      descripcion: 'Servicio de reparación',
      precio: 50000,
      costo: 20000,
    },
  });

  let totalServicios = 0;

  for (let diaOffset = 0; diaOffset < diasAtras; diaOffset++) {
    const fechaBase = new Date(ahora);
    fechaBase.setDate(fechaBase.getDate() - diaOffset);

    // 1-3 servicios por día en horas aleatorias
    const numServicios = randomInt(1, 3);
    for (let s = 0; s < numServicios; s++) {
      const servicioFecha = new Date(fechaBase);
      servicioFecha.setHours(randomInt(8, 18), randomInt(0, 59), randomInt(0, 59), 0);

      const monto = randomFrom([30000, 50000, 75000, 100000]);
      const tipoPago = randomFrom(tiposPago);

      const ventaServicio = await prisma.ventaServicios.create({
        data: {
          tenantId: tenant.tenantId,
          servicioId: servicio.servicioId,
          cantidad: 1,
          total: monto,
          costo: 20000,
          createdAt: servicioFecha,
          moneda: 'CUP',
        },
      });

      await prisma.reconciliacionServicio.create({
        data: {
          tenantId: tenant.tenantId,
          ventaServicioId: ventaServicio.ventaServicioId,
          cuentaId: cuenta.cuentaId,
          tipoPagoId: tipoPago.tipoId,
          monto: monto,
          moneda: 'CUP',
          fechaReconciliacion: servicioFecha,
          reconciliadoPor: user.userId,
        },
      });

      totalServicios++;
    }
  }

  console.log(`  ✅ Ventas de servicios: ${totalServicios}`);

  // Resumen
  console.log('\n📋 Resumen del seed:');
  console.log(`  Tenant: ${tenant.nombre}`);
  console.log(`  Usuario: ${user.email}`);
  console.log(`  Password: password123`);
  console.log(`  Ventas: ${totalVentas}`);
  console.log(`  Servicios: ${totalServicios}`);
  console.log(`  Periodo: ${diasAtras} días`);
  console.log('\n✅ Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
