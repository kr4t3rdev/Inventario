# Design: Fix transferencias bugs

## Overview

Implementación concreta para cada uno de los 5 bugs. Los cambios son independientes y pueden aplicarse en orden secuencial. Cada bug tiene su propia sección con el diff exacto requerido.

---

## BUG-1: Schema/types faltantes en TransferenciaForm

### Archivo: `src/features/transferencias/components/transferencias-form.tsx`

### Cambio

Agregar las 3 definiciones faltantes **antes** de la definición del componente `TransferenciaForm`.

```
📍 Lugar: después de `productoTransferenciaSchema` (línea 85), antes de `useDebounce` (línea 87)
```

```typescript
const transferenciaSchema = z.object({
  productos: z
    .array(productoTransferenciaSchema)
    .min(1, "Debe agregar al menos un producto"),
  tipoOrigen: z.enum(["almacen", "punto_venta"]),
  origenId: z.string().min(1, "Seleccione un origen"),
  tipoDestino: z.enum(["almacen", "punto_venta"]),
  destinoId: z.string().min(1, "Seleccione un destino"),
  descripcion: z.string().optional().default(""),
});

type TransferenciaFormValues = z.infer<typeof transferenciaSchema>;

interface TransferenciaFormProps {
  initialData?: {
    productos?: Array<{ productoId: string; cantidad: number }>;
    tipoOrigen?: "almacen" | "punto_venta";
    origenId?: string;
    tipoDestino?: "almacen" | "punto_venta";
    destinoId?: string;
    descripcion?: string;
  };
}
```

### Dependencias

Ninguna. Es un cambio puramente local en un solo archivo.

### Riesgo

Bajo. Son definiciones que deberían haber estado desde el inicio. El schema replica exactamente la estructura que el form ya espera en `defaultValues` y `onSubmit`.

### Tests

No hay tests unitarios para el formulario (es cliente con React Hook Form). La verificación es manual: cargar `/busy/transferencias/new` sin errores.

---

## BUG-2: Fuga de tenant en paginación

### Archivo: `src/features/transferencias/actions.ts`

### Cambio

```
📍 Lugar: función `getTransferenciasAction`, aproximadamente línea 58
```

```diff
- const total = await prisma.transferencia.count({ where: { deletedAt: null } });
+ const total = await prisma.transferencia.count({ where: { tenantId, deletedAt: null } });
```

### Dependencias

Ninguna. `tenantId` ya está disponible en la función vía `requireTenant(user)`.

### Riesgo

Muy bajo. Solo afecta el cálculo del total de páginas.

### Tests

El test existente `retorna lista paginada` ya cubre `getTransferenciasAction`. Se DEBE verificar que el mock de `prisma.transferencia.count` recibe el filtro correcto. Como el test actual mockea `prisma.transferencia.count.mockResolvedValue(0)`, el test pasa pero no verifica el filtro. Se DEBE agregar una aserción para confirmar.

---

## BUG-3: Stock en PV incluye transferencias canceladas

### Archivo: `src/features/transferencias/actions.ts`

### Cambio

```
📍 Lugar: función `getStockDisponibleEnPuntoVenta` (línea 32)
```

En los dos aggregates (entrada y salida), agregar filtros `deletedAt: null` y `estado: { notIn: ['CANCELADA', 'RECHAZADA'] }`:

```diff
  const entrada = await prisma.transferencia.aggregate({
    where: { productoId, puntoDeVentaDestinoId: puntoDeVentaId,
+     deletedAt: null,
+     estado: { notIn: ['CANCELADA', 'RECHAZADA'] },
    },
    _sum: { cantidad: true },
  });
  const salida = await prisma.transferencia.aggregate({
    where: { productoId, puntoDeVentaOrigenId: puntoDeVentaId,
+     deletedAt: null,
+     estado: { notIn: ['CANCELADA', 'RECHAZADA'] },
    },
    _sum: { cantidad: true },
  });
```

### Dependencias

Ninguna. Cambio puramente en la función helper.

### Riesgo

Bajo. Los filtros adicionales solo excluyen registros que no deberían contar para stock disponible.

### Tests

El test existente no cubre `getStockDisponibleEnPuntoVenta` directamente (es una función interna, no exportada). Se DEBE verificar que los tests de `createTransferenciaAction` con origen PV sigan pasando. Idealmente, agregar un test que mockee `prisma.transferencia.aggregate` con datos que incluyan canceladas y verifique que no se bloquea la transferencia.

---

## BUG-4: Update siempre borra relaciones con PV

### Archivo: `src/features/transferencias/actions.ts`

### Decisión de diseño

**Opción evaluada:** Agregar `puntoDeVentaOrigenId` y `puntoDeVentaDestinoId` al schema `updateTransferenciaSchema`.

**Decisión:** NO modificar el schema. En su lugar, construir dinámicamente el objeto `data` en `updateTransferenciaAction` según `tipoOrigen`/`tipoDestino`, igual que ya se hace en `createTransferenciaAction`. Esto mantiene coherencia entre create y update sin exponer campos internos del modelo.

### Cambio

```diff
  const result = await prisma.$transaction(async (tx: any) => {
+   const data: any = { productoId, cantidad };
+   data.origenId = tipoOrigen === 'almacen' ? origenId : null;
+   data.puntoDeVentaOrigenId = tipoOrigen === 'punto_venta' ? origenId : null;
+   data.destinoId = tipoDestino === 'almacen' ? destinoId : null;
+   data.puntoDeVentaDestinoId = tipoDestino === 'punto_venta' ? destinoId : null;
+
    const updated = await tx.transferencia.update({
      where: { transferenciaId },
-     data: { productoId, cantidad, origenId, destinoId, puntoDeVentaOrigenId: null, puntoDeVentaDestinoId: null },
+     data,
    });
```

### Nota sobre ajuste de stock

El ajuste de stock existente en `updateTransferenciaAction` ya usa `tipoOrigen` y `tipoDestino` para decidir qué lado del stock mover, así que ese código no necesita modificarse. Solo se corrige qué IDs se persisten en la relación.

### Dependencias

Requiere que el schema `updateTransferenciaSchema` ya tenga `tipoOrigen` y `tipoDestino` (ya los tiene, verificado en schemas.ts).

### Riesgo

Medio-bajo. El cambio solo afecta qué valores se guardan en los campos de relación. No cambia la lógica de stock.

### Tests

El test existente de `deleteTransferenciaAction` mockea una transferencia con `origenId: 'alm-1'` y `destinoId: null`. No hay test específico para `updateTransferenciaAction`. Se DEBE agregar un test que verifique que update preserva las relaciones correctas.

---

## BUG-5: Validación de stock en almacén usa producto.stock global

### Archivo: `src/features/transferencias/actions.ts`

### Cambio

```
📍 Lugar: función `createTransferenciaAction`, dentro del loop de validación de productos (aprox. línea 170)
```

Reemplazar:

```diff
-    } else if (producto.stock < item.cantidad) {
-      console.error('=== createTransferenciaAction :: stock insuficiente ===', {
-        producto: producto.nombre,
-        solicitado: item.cantidad,
-        disponible: producto.stock,
-      });
-      throw new ActionError(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stock}`, 'STOCK_INSUFICIENTE');
-    }
+    } else if (tipoOrigen === 'almacen') {
+      const stockUbicacion = await prisma.stockUbicacion.findUnique({
+        where: {
+          productoId_tipoUbicacion_ubicacionId: {
+            productoId: item.productoId,
+            tipoUbicacion: 'almacen',
+            ubicacionId: origenId,
+          },
+        },
+        select: { cantidadDisponible: true },
+      });
+      const stockDisponible = stockUbicacion?.cantidadDisponible ?? 0;
+      if (stockDisponible < item.cantidad) {
+        throw new ActionError(
+          `Stock insuficiente para ${producto.nombre} en el almacén. Disponible: ${stockDisponible}`,
+          'STOCK_INSUFICIENTE',
+        );
+      }
    }
```

### Dependencias

Requiere que `prisma.stockUbicacion` esté disponible (ya se usa en otras partes del código).

### Riesgo

Medio. Cambia la fuente de verdad para validación de stock de almacén. Si `StockUbicacion` no está correctamente sincronizado (ej. productos cargados antes de implementar `StockUbicacion`), podría dar falsos negativos. Sin embargo, las transferencias existentes ya actualizan `StockUbicacion` correctamente.

### Tests

El test existente `rechaza stock insuficiente` mockea `producto.stock = 2` y espera `STOCK_INSUFICIENTE`. Tras el fix, necesita mockear también `prisma.stockUbicacion.findUnique`:

```typescript
// En el mock de prisma, agregar:
stockUbicacion: { findUnique: vi.fn() }

// En el test, mockear que devuelve stock insuficiente:
vi.mocked(prisma.stockUbicacion.findUnique).mockResolvedValue({
  cantidadDisponible: 2,
});
```

---

## Plan de testing

### Tests existentes a actualizar

| Test | Archivo | Cambio requerido |
|---|---|---|
| `getTransferenciasAction` → `retorna lista paginada` | `actions.test.ts` | Agregar assertion sobre `tenantId` en el mock de `count` |
| `createTransferenciaAction` → `rechaza stock insuficiente` | `actions.test.ts` | Agregar mock de `prisma.stockUbicacion.findUnique` |
| `createTransferenciaAction` → `crea transferencia exitosamente` | `actions.test.ts` | Agregar mock de `prisma.stockUbicacion.findUnique` con stock suficiente |

### Nuevos tests a agregar

| Test | Escenario |
|---|---|
| `updateTransferenciaAction` → `preserva relaciones PV` | Update con tipoOrigen=punto_venta verifica que `puntoDeVentaOrigenId` se guarda |
| `updateTransferenciaAction` → `preserva relaciones almacen` | Update con tipoOrigen=almacen verifica que `origenId` se guarda |
| `getStockDisponibleEnPuntoVenta` → `ignora canceladas` | Test indirecto vía createTransferenciaAction con aggregate mockeado |

## Orden de aplicación sugerido

1. **BUG-1**: Arregla el error bloqueante, permite renderizar el form
2. **BUG-3**: Corrige stock de PV (afecta creación con origen PV)
3. **BUG-5**: Corrige stock de almacén (afecta creación con origen almacén)
4. **BUG-4**: Corrige edición de transferencias
5. **BUG-2**: Corrige paginación (bajo impacto, último)
6. **Tests**: Actualizar mocks y assertions

## Rollback

Cada cambio es atómico por archivo. Si un fix introduce una regresión, revertir solo ese bloque. Ver "Rollback Plan" en proposal.md para detalles.
