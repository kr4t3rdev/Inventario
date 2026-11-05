import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = resolve(
  root,
  'prisma/migrations/20261108000000_add_inventory_lots_locations/migration.sql',
)
const receiptLinkMigrationPath = resolve(
  root,
  'prisma/migrations/20261108100000_link_lots_to_receipt_items/migration.sql',
)
const receiptFifoMigrationPath = resolve(
  root,
  'prisma/migrations/20261109000000_receipt_lot_fifo_costs/migration.sql',
)
const putawayMigrationPath = resolve(root, 'prisma/migrations/20261115000000_putaway_rules/migration.sql')
const schemaPath = resolve(root, 'prisma/schema.prisma')

describe('lotes y ubicaciones jerárquicas migration contract', () => {
  it('define modelos relacionados en Prisma y columnas persistentes en SQL', () => {
    const migration = readFileSync(migrationPath, 'utf8')
    const receiptLinkMigration = readFileSync(receiptLinkMigrationPath, 'utf8')
    const schema = readFileSync(schemaPath, 'utf8')

    expect(schema).toContain('model Lote {')
    expect(schema).toContain('cantidadDisponible Int')
    expect(schema).toContain('model Ubicacion {')
    expect(schema).toContain('parentId  String?')
    expect(schema).toContain('model PurchaseAllocation {')
    expect(schema).toContain('loteId                String?')

    expect(migration).toContain('CREATE TABLE "Lote"')
    expect(migration).toContain('CREATE TABLE "Ubicacion"')
    expect(migration).toMatch(/"purchase_allocations" ADD COLUMN "loteId" TEXT/)
    expect(migration).toMatch(/FOREIGN KEY \("tenantId", "productoId"\)/)
    expect(migration).toMatch(/FOREIGN KEY \("tenantId", "almacenId"\)/)
    expect(migration).toMatch(/FOREIGN KEY \("tenantId", "almacenId", "parentId"\)/)
    expect(migration).toMatch(/FOREIGN KEY \("tenantId", "loteId"\)/)
    expect(schema).toContain('recepcionItemId    String?')
    expect(receiptLinkMigration).toMatch(/ALTER TABLE "Lote" ADD COLUMN "recepcionItemId" TEXT/)
    expect(receiptLinkMigration).toMatch(/FOREIGN KEY \("tenantId", "recepcionItemId"\)/)
  })

  it('conserva la trazabilidad de recepción FIFO y reconcilia facturas históricas', () => {
    const migration = readFileSync(receiptFifoMigrationPath, 'utf8')
    const schema = readFileSync(schemaPath, 'utf8')

    expect(schema).toContain('cantidadFacturada Int')
    expect(schema).toContain('montoFacturado     Int')
    expect(schema).toContain('costoUnitarioSnapshot Int?')
    expect(schema).toContain('recepcionItem         RecepcionItem?')
    expect(migration).toMatch(/ALTER COLUMN "compraDocumentoItemId" DROP NOT NULL/)
    expect(migration).toMatch(/ADD COLUMN "recepcionItemId" TEXT/)
    expect(migration).toMatch(/ADD COLUMN "costoUnitarioSnapshot" INTEGER/)
    expect(migration).toMatch(/"compraDocumentoItemId" IS NOT NULL AND "recepcionItemId" IS NULL/)
    expect(migration).toMatch(/PARTITION BY ri\."tenantId", oi\."ordenId", ri\."productoId"/)
    expect(migration).toMatch(/PARTITION BY cdi\."tenantId", cd\."ordenCompraId", cdi\."productoId"/)
    expect(migration).toMatch(/"cantidadFacturada" = c\.cantidad/)
    expect(migration).toMatch(/"montoFacturado" = c\.monto/)
  })

  it('alinea las referencias tenant-scoped del putaway con los nombres mapeados en Prisma', () => {
    const migration = readFileSync(putawayMigrationPath, 'utf8')
    const schema = readFileSync(schemaPath, 'utf8')

    expect(schema).toContain('@@map("tenants")')
    expect(migration).toContain('REFERENCES "tenants"("tenantId")')
    for (const name of ['producto_tenant', 'categoria_tenant', 'ubicacion_tenant']) {
      expect(schema).toContain(`map: "ReglaPutaway_${name}_fkey"`)
      expect(migration).toContain(`CONSTRAINT "ReglaPutaway_${name}_fkey"`)
    }
  })
})
