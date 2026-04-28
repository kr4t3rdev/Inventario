import { PrismaClient } from '../../src/generated/prisma'

const prisma = new PrismaClient()

const CUENTAS = [
  // ACTIVO
  { codigo: '1', nombre: 'Activo', naturaleza: 'ACTIVO', nivel: 'MAYOR' },
  { codigo: '1.1', nombre: 'Caja y Bancos', naturaleza: 'ACTIVO', nivel: 'SUBMAYOR' },
  { codigo: '1.1.1', nombre: 'Caja', naturaleza: 'ACTIVO', nivel: 'ANALITICA' },
  { codigo: '1.1.2', nombre: 'Banco', naturaleza: 'ACTIVO', nivel: 'ANALITICA' },
  { codigo: '1.1.3', nombre: 'Cuentas por Cobrar', naturaleza: 'ACTIVO', nivel: 'ANALITICA' },
  { codigo: '1.1.4', nombre: 'Anticipo Cobro', naturaleza: 'ACTIVO', nivel: 'ANALITICA' },
  { codigo: '1.1.5', nombre: 'Préstamo por Cobrar', naturaleza: 'ACTIVO', nivel: 'ANALITICA' },
  { codigo: '1.2', nombre: 'Inventarios', naturaleza: 'ACTIVO', nivel: 'SUBMAYOR' },
  { codigo: '1.2.1', nombre: 'Inventario de Mercancías', naturaleza: 'ACTIVO', nivel: 'ANALITICA' },
  { codigo: '1.2.2', nombre: 'Almacén Origen', naturaleza: 'ACTIVO', nivel: 'ANALITICA' },

  // PASIVO
  { codigo: '2', nombre: 'Pasivo', naturaleza: 'PASIVO', nivel: 'MAYOR' },
  { codigo: '2.1', nombre: 'Cuentas por Pagar', naturaleza: 'PASIVO', nivel: 'SUBMAYOR' },
  { codigo: '2.1.1', nombre: 'Proveedores', naturaleza: 'PASIVO', nivel: 'ANALITICA' },
  { codigo: '2.1.2', nombre: 'Gastos por Pagar', naturaleza: 'PASIVO', nivel: 'ANALITICA' },
  { codigo: '2.1.3', nombre: 'Deuda Cash', naturaleza: 'PASIVO', nivel: 'ANALITICA' },
  { codigo: '2.2', nombre: 'Anticipos', naturaleza: 'PASIVO', nivel: 'SUBMAYOR' },
  { codigo: '2.2.1', nombre: 'Anticipo Pago', naturaleza: 'PASIVO', nivel: 'ANALITICA' },

  // PATRIMONIO
  { codigo: '3', nombre: 'Patrimonio', naturaleza: 'PATRIMONIO', nivel: 'MAYOR' },
  { codigo: '3.1', nombre: 'Capital Social', naturaleza: 'PATRIMONIO', nivel: 'ANALITICA' },
  { codigo: '3.2', nombre: 'Resultado Acumulado', naturaleza: 'PATRIMONIO', nivel: 'ANALITICA' },

  // INGRESO
  { codigo: '4', nombre: 'Ingresos', naturaleza: 'INGRESO', nivel: 'MAYOR' },
  { codigo: '4.1', nombre: 'Ingresos por Ventas', naturaleza: 'INGRESO', nivel: 'SUBMAYOR' },
  { codigo: '4.1.1', nombre: 'Venta de Mercancías', naturaleza: 'INGRESO', nivel: 'ANALITICA' },
  { codigo: '4.1.2', nombre: 'Venta de Servicios', naturaleza: 'INGRESO', nivel: 'ANALITICA' },
  { codigo: '4.1.3', nombre: 'Facturación', naturaleza: 'INGRESO', nivel: 'ANALITICA' },

  // EGRESO
  { codigo: '5', nombre: 'Gastos', naturaleza: 'EGRESO', nivel: 'MAYOR' },
  { codigo: '5.1', nombre: 'Gastos Operativos', naturaleza: 'EGRESO', nivel: 'SUBMAYOR' },
  { codigo: '5.1.1', nombre: 'Gastos de Explotación', naturaleza: 'EGRESO', nivel: 'ANALITICA' },
  { codigo: '5.1.2', nombre: 'Gastos por Servicios', naturaleza: 'EGRESO', nivel: 'ANALITICA' },
  { codigo: '5.1.3', nombre: 'Gastos de Nómina', naturaleza: 'EGRESO', nivel: 'ANALITICA' },
  { codigo: '5.1.4', nombre: 'Pérdida por Merma', naturaleza: 'EGRESO', nivel: 'ANALITICA' },
  { codigo: '5.1.5', nombre: 'Gastos Financieros', naturaleza: 'EGRESO', nivel: 'ANALITICA' },
  { codigo: '5.1.6', nombre: 'Ajuste Contable', naturaleza: 'EGRESO', nivel: 'ANALITICA' },
  { codigo: '5.1.7', nombre: 'Ajuste Bancario', naturaleza: 'EGRESO', nivel: 'ANALITICA' },
]

const MAPPINGS: Array<{ origenTipo: string; principalCodigo: string; contrariaCodigo: string; etiqueta: string }> = [
  { origenTipo: 'VENTA', principalCodigo: '4.1.1', contrariaCodigo: '1.1.3', etiqueta: 'Venta de mercancías' },
  { origenTipo: 'VENTA_SERVICIO', principalCodigo: '4.1.2', contrariaCodigo: '1.1.3', etiqueta: 'Venta de servicios' },
  { origenTipo: 'GASTO_DE', principalCodigo: '5.1.1', contrariaCodigo: '1.1.1', etiqueta: 'Gasto de explotación' },
  { origenTipo: 'GASTO_COMPRA', principalCodigo: '1.2.1', contrariaCodigo: '2.1.1', etiqueta: 'Compra de inventario' },
  { origenTipo: 'PAGO_SALARIO', principalCodigo: '5.1.3', contrariaCodigo: '1.1.1', etiqueta: 'Pago de salario' },
  { origenTipo: 'COBRO_VENTA', principalCodigo: '1.1.1', contrariaCodigo: '1.1.3', etiqueta: 'Cobro de venta' },
  { origenTipo: 'COBRO_SERVICIO', principalCodigo: '1.1.1', contrariaCodigo: '1.1.3', etiqueta: 'Cobro de servicio' },
  { origenTipo: 'PAGO_GASTO', principalCodigo: '1.1.1', contrariaCodigo: '2.1.2', etiqueta: 'Pago de gasto' },
  { origenTipo: 'TRANSFERENCIA_BANCARIA', principalCodigo: '1.1.2', contrariaCodigo: '1.1.1', etiqueta: 'Transferencia bancaria' },
  { origenTipo: 'TRANSFERENCIA_INVENTARIO', principalCodigo: '1.2.1', contrariaCodigo: '1.2.2', etiqueta: 'Transferencia de inventario' },
  { origenTipo: 'AJUSTE_BANCARIO', principalCodigo: '1.1.2', contrariaCodigo: '5.1.7', etiqueta: 'Ajuste bancario' },
  { origenTipo: 'RECONCILIACION_VENTA', principalCodigo: '1.1.1', contrariaCodigo: '1.1.3', etiqueta: 'Reconciliación de venta' },
  { origenTipo: 'RECONCILIACION_SERVICIO', principalCodigo: '1.1.1', contrariaCodigo: '1.1.3', etiqueta: 'Reconciliación de servicio' },
  { origenTipo: 'RECONCILIACION_GASTO', principalCodigo: '1.1.1', contrariaCodigo: '2.1.1', etiqueta: 'Reconciliación de gasto' },
  { origenTipo: 'AJUSTE_CONTABLE', principalCodigo: '5.1.6', contrariaCodigo: '3.2', etiqueta: 'Ajuste contable' },
  { origenTipo: 'COMPRA_SERVICIO', principalCodigo: '5.1.2', contrariaCodigo: '2.1.1', etiqueta: 'Compra de servicios' },
  { origenTipo: 'MERMA', principalCodigo: '5.1.4', contrariaCodigo: '1.2.1', etiqueta: 'Merma de inventario' },
  { origenTipo: 'ANTICIPO_PAGO', principalCodigo: '2.2.1', contrariaCodigo: '1.1.1', etiqueta: 'Anticipo de pago' },
  { origenTipo: 'ANTICIPO_COBRO', principalCodigo: '1.1.1', contrariaCodigo: '1.1.4', etiqueta: 'Anticipo de cobro' },
  { origenTipo: 'FACTURA', principalCodigo: '4.1.3', contrariaCodigo: '1.1.3', etiqueta: 'Facturación' },
  { origenTipo: 'CUENTA_POR_COBRAR', principalCodigo: '1.1.3', contrariaCodigo: '4.1.1', etiqueta: 'Cuenta por cobrar' },
  { origenTipo: 'CUENTA_POR_PAGAR', principalCodigo: '2.1.2', contrariaCodigo: '2.1.1', etiqueta: 'Cuenta por pagar' },
  { origenTipo: 'PAGO_CUENTA_POR_PAGAR', principalCodigo: '2.1.1', contrariaCodigo: '1.1.1', etiqueta: 'Pago de cuenta por pagar' },
  { origenTipo: 'INYECCION_CAPITAL', principalCodigo: '1.1.1', contrariaCodigo: '3.1', etiqueta: 'Inyección de capital' },
  { origenTipo: 'PAGO_DEUDA', principalCodigo: '5.1.5', contrariaCodigo: '1.1.1', etiqueta: 'Pago de deuda' },
  { origenTipo: 'DEUDA_CASH', principalCodigo: '1.1.1', contrariaCodigo: '2.1.3', etiqueta: 'Desembolso de deuda cash' },
  { origenTipo: 'PRESTAMO_CASH', principalCodigo: '1.1.5', contrariaCodigo: '1.1.1', etiqueta: 'Desembolso de préstamo cash' },
  { origenTipo: 'REVERSION_ANTICIPO', principalCodigo: '1.1.1', contrariaCodigo: '2.2.1', etiqueta: 'Reversión de anticipo' },
]

export async function seedCatalogoContable() {
  console.log('📊 Seeding chart of accounts...')

  for (const cuenta of CUENTAS) {
    await prisma.cuentaContable.upsert({
      where: { codigo: cuenta.codigo },
      update: { nombre: cuenta.nombre, naturaleza: cuenta.naturaleza as any, nivel: cuenta.nivel as any, activa: true },
      create: { codigo: cuenta.codigo, nombre: cuenta.nombre, naturaleza: cuenta.naturaleza as any, nivel: cuenta.nivel as any, activa: true },
    })
  }
  console.log(`  ✓ ${CUENTAS.length} accounts created`)

  console.log('📊 Seeding accounting mappings...')
  for (const mapping of MAPPINGS) {
    const [principal, contraria] = await Promise.all([
      prisma.cuentaContable.findUnique({ where: { codigo: mapping.principalCodigo } }),
      prisma.cuentaContable.findUnique({ where: { codigo: mapping.contrariaCodigo } }),
    ])
    if (!principal) { console.warn(`  ⚠ Cuenta principal ${mapping.principalCodigo} no encontrada, saltando mapping ${mapping.origenTipo}`); continue }
    if (!contraria) { console.warn(`  ⚠ Cuenta contraria ${mapping.contrariaCodigo} no encontrada, saltando mapping ${mapping.origenTipo}`); continue }

    await prisma.mappingContable.upsert({
      where: { origenTipo: mapping.origenTipo },
      update: { cuentaPrincipalCodigo: mapping.principalCodigo, cuentaContrariaCodigo: mapping.contrariaCodigo, etiqueta: mapping.etiqueta },
      create: { origenTipo: mapping.origenTipo, cuentaPrincipalCodigo: mapping.principalCodigo, cuentaContrariaCodigo: mapping.contrariaCodigo, etiqueta: mapping.etiqueta },
    })
  }
  console.log(`  ✓ ${MAPPINGS.length} mappings created`)
}

async function main() {
  await seedCatalogoContable()
  await prisma.$disconnect()
}

main()
