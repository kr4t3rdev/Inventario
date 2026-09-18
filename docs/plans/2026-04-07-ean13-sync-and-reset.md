# EAN-13 Schema Sync & Automatic Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Synchronize Prisma schema with EAN-13 fields, create migration, and implement automatic database reset when toggling EAN-13 on/off in Mi Empresa.

**Architecture:** 
- Add EAN-13 fields to Producto model (nullable, always present but unused when OFF)
- Create new Prisma migration
- Implement smart reset logic in Mi Empresa API route (POST/PUT)
- ON→OFF: Hide fields via API response filtering, keep data intact
- OFF→ON: Confirm with user, delete products + reset inventory, keep sales history

**Tech Stack:** 
- Prisma ORM, PostgreSQL, Next.js API Routes, TypeScript, Zod validation

---

## Task 1: Update Prisma Schema with EAN-13 Fields

**Files:**
- Modify: `/prisma/schema.prisma:158-193` (Producto model)

**Step 1: Read current Producto model**

Already done - confirmed model lacks EAN-13 fields.

**Step 2: Add EAN-13 fields to Producto model**

Open `/prisma/schema.prisma` and find the `model Producto` block (line 158).

Add these fields after line 192 (before closing brace):

```prisma
  codigoNegocio      String?   @unique
  proveedorCodigo    String(2)?
  idSeccionCodigo    String(2)?
  especificoCodigo   String(4)?
  surtidoCodigo      String(4)?
  dcCodigo           String(1)?
```

Expected result: Producto model now has 6 new nullable fields.

**Step 3: Verify schema syntax**

Run: `npx prisma format`

Expected: No errors, schema reformatted cleanly.

**Step 4: Commit schema change**

```bash
git add prisma/schema.prisma
git commit -m "schema: add EAN-13 fields to Producto model (nullable)"
```

---

## Task 2: Create Prisma Migration for EAN-13 Fields

**Files:**
- Create: `/prisma/migrations/<timestamp>_add_ean13_fields_to_producto/migration.sql`

**Step 1: Generate migration from schema change**

Run: `npx prisma migrate dev --name add_ean13_fields_to_producto`

Expected: 
- Migration file created in `/prisma/migrations/`
- Prisma client regenerated
- Output shows: "Your database has been updated"

**Step 2: Verify migration SQL**

Read the generated migration file. Should contain:

```sql
ALTER TABLE "Producto" ADD COLUMN "codigoNegocio" TEXT UNIQUE,
ADD COLUMN "proveedorCodigo" VARCHAR(2),
ADD COLUMN "idSeccionCodigo" VARCHAR(2),
ADD COLUMN "especificoCodigo" VARCHAR(4),
ADD COLUMN "surtidoCodigo" VARCHAR(4),
ADD COLUMN "dcCodigo" VARCHAR(1);
```

(Exact SQL may vary slightly based on Prisma's generation)

**Step 3: Commit migration**

```bash
git add prisma/migrations/
git commit -m "migration: add EAN-13 fields to Producto table"
```

---

## Task 3: Implement Reset Logic in Mi Empresa API

**Files:**
- Modify: `/src/app/api/mi-empresa/route.ts` (PUT handler)
- Create: `/src/lib/ean13-reset.ts` (new utility)

**Step 3a: Create EAN-13 Reset Utility Function**

Create `/src/lib/ean13-reset.ts`:

```typescript
import { prisma } from '@/lib/prisma'

/**
 * @description Reset all products and inventory when EAN-13 is activated
 * Deletes all products (which cascades to inventory) but preserves sales history
 * @returns Promise<{deletedProducts: number}>
 */
export async function resetProductsForEan13(): Promise<{ deletedProducts: number }> {
  // Delete all products (cascade will handle related data)
  const result = await prisma.producto.deleteMany({})
  return { deletedProducts: result.count }
}

/**
 * @description Clear EAN-13 codes when EAN-13 is deactivated
 * Sets all EAN-13 fields to NULL without deleting products
 * @returns Promise<{clearedProducts: number}>
 */
export async function clearEan13Codes(): Promise<{ clearedProducts: number }> {
  const result = await prisma.producto.updateMany({
    data: {
      codigoNegocio: null,
      proveedorCodigo: null,
      idSeccionCodigo: null,
      especificoCodigo: null,
      surtidoCodigo: null,
      dcCodigo: null,
    },
  })
  return { clearedProducts: result.count }
}
```

**Step 3b: Update Mi Empresa PUT Handler**

Modify `/src/app/api/mi-empresa/route.ts` PUT handler:

Find the section where `usaCodigoEan13` is updated. Replace/enhance with:

```typescript
import { clearEan13Codes, resetProductsForEan13 } from '@/lib/ean13-reset'

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { usaCodigoEan13 } = body

    // Get current state
    const current = await prisma.miEmpresa.findUnique({ where: { id: 1 } })

    if (!current) {
      return NextResponse.json(
        { error: 'Mi Empresa no encontrada' },
        { status: 404 }
      )
    }

    // Detect state change
    const isTogglingOn = !current.usaCodigoEan13 && usaCodigoEan13 === true
    const isTogglingOff = current.usaCodigoEan13 && usaCodigoEan13 === false

    // Handle transition OFF -> ON: requires user confirmation
    if (isTogglingOn) {
      // The client should have sent a confirmation flag
      const { confirmReset } = body
      if (!confirmReset) {
        return NextResponse.json(
          {
            error: 'Reset confirmation required',
            requiresConfirmation: true,
            message: 'Activar EAN-13 eliminará todos los productos existentes. ¿Está seguro?',
          },
          { status: 400 }
        )
      }

      // Perform reset
      const { deletedProducts } = await resetProductsForEan13()

      // Update Mi Empresa
      const updated = await prisma.miEmpresa.update({
        where: { id: 1 },
        data: { usaCodigoEan13: true },
      })

      return NextResponse.json({
        success: true,
        message: `EAN-13 activado. ${deletedProducts} productos eliminados.`,
        data: updated,
      })
    }

    // Handle transition ON -> OFF: just clear codes, keep products
    if (isTogglingOff) {
      await clearEan13Codes()

      const updated = await prisma.miEmpresa.update({
        where: { id: 1 },
        data: { usaCodigoEan13: false },
      })

      return NextResponse.json({
        success: true,
        message: 'EAN-13 desactivado. Códigos limpiados, productos conservados.',
        data: updated,
      })
    }

    // No state change, just regular update
    const updated = await prisma.miEmpresa.update({
      where: { id: 1 },
      data: body,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating Mi Empresa:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 3c: Commit**

```bash
git add src/lib/ean13-reset.ts src/app/api/mi-empresa/route.ts
git commit -m "feat: implement automatic EAN-13 reset logic for ON/OFF transitions"
```

---

## Task 4: Update Mi Empresa Form to Handle Confirmation Dialog

**Files:**
- Modify: `/src/components/mi-empresa/mi-empresa-form.tsx:520-553` (switch handler)

**Step 4a: Update Switch onChange Handler**

Find the switch handler for `usaCodigoEan13`. Replace with:

```typescript
const handleEan13Toggle = async (checked: boolean) => {
  if (!checked) {
    // Toggling OFF - no confirmation needed
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/mi-empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usaCodigoEan13: false,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message || 'EAN-13 desactivado')
        // Refetch to update UI
        refetch?.()
      } else {
        toast.error('Error al desactivar EAN-13')
      }
    } catch (error) {
      toast.error('Error al desactivar EAN-13')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
    return
  }

  // Toggling ON - show confirmation dialog first
  setShowEan13Confirmation(true)
}

const handleConfirmEan13Reset = async () => {
  setIsSubmitting(true)
  try {
    const response = await fetch('/api/mi-empresa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usaCodigoEan13: true,
        confirmReset: true,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      toast.success(data.message || 'EAN-13 activado')
      setShowEan13Confirmation(false)
      // Refetch to update UI
      refetch?.()
    } else {
      const error = await response.json()
      if (error.requiresConfirmation) {
        // Already showing dialog, this is user confirming
        toast.error('Hubo un error al activar EAN-13')
      }
    }
  } catch (error) {
    toast.error('Error al activar EAN-13')
    console.error(error)
  } finally {
    setIsSubmitting(false)
  }
}
```

**Step 4b: Update Alert Dialog for EAN-13**

Ensure the alert dialog for EAN-13 activation exists. If not, add:

```tsx
<AlertDialog open={showEan13Confirmation} onOpenChange={setShowEan13Confirmation}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>⚠️ Activar EAN-13</AlertDialogTitle>
      <AlertDialogDescription>
        Activar el sistema EAN-13 eliminará TODOS los productos existentes en el catálogo.
        El histórico de ventas se conservará.
        <br />
        <br />
        <strong>¿Está seguro de que desea continuar?</strong>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleConfirmEan13Reset}
        disabled={isSubmitting}
        className="bg-red-600 hover:bg-red-700"
      >
        {isSubmitting ? 'Procesando...' : 'Sí, activar EAN-13'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Add state for dialog visibility:

```typescript
const [showEan13Confirmation, setShowEan13Confirmation] = useState(false)
```

**Step 4c: Commit**

```bash
git add src/components/mi-empresa/mi-empresa-form.tsx
git commit -m "feat: add confirmation dialog for EAN-13 activation with reset logic"
```

---

## Task 5: Test Reset Logic Manually

**Files:**
- Test in dev environment

**Step 5a: Start dev server**

```bash
pnpm run dev
```

Expected: App running on localhost:3000

**Step 5b: Test OFF → ON transition**

1. Navigate to Mi Empresa settings
2. Ensure EAN-13 is OFF
3. Create 2-3 test products in the catalog
4. Click EAN-13 switch to ON
5. Confirmation dialog should appear
6. Click "Sí, activar EAN-13"
7. Expected: Dialog closes, toast shows success, products deleted, page reloads

**Step 5c: Verify database state**

Run in psql or query tool:

```sql
SELECT COUNT(*) FROM "Producto" WHERE "usaCodigoEan13" = true;
-- Should return 0 (products deleted)

SELECT COUNT(*) FROM "Venta";
-- Should return whatever sales existed before (untouched)
```

**Step 5d: Test ON → OFF transition**

1. Ensure EAN-13 is ON (from previous test)
2. Create 1-2 products with EAN-13 codes
3. Click switch to OFF
4. No confirmation needed
5. Expected: Toast shows success, codes cleared

**Step 5e: Verify codes cleared**

```sql
SELECT COUNT(*) FROM "Producto" WHERE "codigoNegocio" IS NOT NULL;
-- Should return 0 (codes cleared but products still exist)
```

---

## Task 6: Create Unit Tests for Reset Logic

**Files:**
- Create: `/src/lib/__tests__/ean13-reset.test.ts`

**Step 6a: Write test file**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { resetProductsForEan13, clearEan13Codes } from '@/lib/ean13-reset'

describe('EAN-13 Reset Logic', () => {
  let testProductIds: string[] = []

  beforeEach(async () => {
    // Create test products
    const p1 = await prisma.producto.create({
      data: {
        nombre: 'Test Product 1',
        precioCosto: 100,
        precioVenta: 150,
        stock: 10,
        categoriaId: 'test-cat',
        almacenId: 'test-almacen',
        codigoNegocio: 'TEST001',
      },
    })

    const p2 = await prisma.producto.create({
      data: {
        nombre: 'Test Product 2',
        precioCosto: 200,
        precioVenta: 300,
        stock: 5,
        categoriaId: 'test-cat',
        almacenId: 'test-almacen',
        codigoNegocio: 'TEST002',
      },
    })

    testProductIds = [p1.id, p2.id]
  })

  afterEach(async () => {
    // Cleanup
    await prisma.producto.deleteMany({})
  })

  it('should delete all products when resetting for EAN-13 activation', async () => {
    const before = await prisma.producto.count()
    expect(before).toBe(2)

    const result = await resetProductsForEan13()

    expect(result.deletedProducts).toBe(2)

    const after = await prisma.producto.count()
    expect(after).toBe(0)
  })

  it('should clear EAN-13 codes without deleting products', async () => {
    const before = await prisma.producto.findMany({
      where: { codigoNegocio: { not: null } },
    })
    expect(before.length).toBe(2)

    const result = await clearEan13Codes()

    expect(result.clearedProducts).toBe(2)

    const after = await prisma.producto.findMany({
      where: { codigoNegocio: { not: null } },
    })
    expect(after.length).toBe(0)

    const allProducts = await prisma.producto.count()
    expect(allProducts).toBe(2) // Products still exist
  })
})
```

**Step 6b: Run tests**

```bash
pnpm test -- src/lib/__tests__/ean13-reset.test.ts
```

Expected: All tests pass ✅

**Step 6c: Commit tests**

```bash
git add src/lib/__tests__/ean13-reset.test.ts
git commit -m "test: add unit tests for EAN-13 reset logic"
```

---

## Task 7: Update Products Form to Hide EAN-13 Fields When OFF

**Files:**
- Modify: `/src/components/productos/productos-form.tsx:178-191`

**Step 7a: Add conditional rendering**

In the productos form, wrap EAN-13 fields in conditional:

```tsx
{usaEan13 && (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="codigoNegocio"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Código de Negocio (Readonly)</FormLabel>
            <FormControl>
              <Input {...field} readOnly disabled />
            </FormControl>
          </FormItem>
        )}
      />
      {/* Other EAN-13 fields */}
    </div>
  </>
)}
```

**Step 7b: Commit**

```bash
git add src/components/productos/productos-form.tsx
git commit -m "feat: hide EAN-13 fields in product form when EAN-13 is OFF"
```

---

## Summary

| Task | What | Files | Status |
|------|------|-------|--------|
| 1 | Update Prisma schema | schema.prisma | Create migration ✅ |
| 2 | Create migration | migrations/ | Apply to DB ✅ |
| 3 | Reset logic API | ean13-reset.ts, route.ts | Toggle ON/OFF handlers ✅ |
| 4 | Form confirmation | mi-empresa-form.tsx | Dialog + handlers ✅ |
| 5 | Manual testing | Dev environment | OFF→ON, ON→OFF ✅ |
| 6 | Unit tests | ean13-reset.test.ts | Verify logic ✅ |
| 7 | UI hiding | productos-form.tsx | Conditional rendering ✅ |

**Next:** Ready for task-by-task execution. Proceed with Task 1.
