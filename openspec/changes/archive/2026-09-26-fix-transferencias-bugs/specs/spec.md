# Spec: Fix transferencias bugs

## Overview

Especificación detallada de cada corrección para los 5 bugs identificados en la feature de transferencias. Usa palabras clave RFC 2119 (MUST, SHOULD, MAY).

---

## BUG-1: Schema/types faltantes en TransferenciaForm

### Description

El componente `TransferenciaForm` referencia `transferenciaSchema`, `TransferenciaFormValues` y `TransferenciaFormProps` que nunca fueron definidos. Esto causa un `ReferenceError` en el browser que impide cargar la página `/busy/transferencias/new`.

### Contract

```typescript
// Schema de item de producto (ya existe en el archivo)
const productoTransferenciaSchema = z.object({
  productoId: z.string({ required_error: "Seleccione un producto" }),
  cantidad: z.coerce
    .number()
    .positive({ message: "La cantidad debe ser mayor a 0" })
    .max(10000, { message: "La cantidad máxima es 10000 unidades" })
    .refine((val) => Number.isInteger(val), {
      message: "La cantidad debe ser un número entero",
    }),
});

// Schema del formulario completo (DEBE definirse)
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
  initialData?: Partial<{
    productos: Array<{ productoId: string; cantidad: number }>;
    tipoOrigen: "almacen" | "punto_venta";
    origenId: string;
    tipoDestino: "almacen" | "punto_venta";
    destinoId: string;
    descripcion: string;
  }>;
}
```

### Scenarios

**Scenario 1.1: Carga inicial del formulario**
- Given: El usuario navega a `/busy/transferencias/new` sin `initialData`
- When: El componente `TransferenciaForm` se monta
- Then: El formulario DEBE cargar sin errores
- And: Los defaultValues DEBEN ser `productos: [{ productoId: "", cantidad: 1 }]`, `tipoOrigen: "almacen"`, `tipoDestino: "punto_venta"`, `origenId: ""`, `destinoId: ""`, `descripcion: ""`
- And: NO DEBE aparecer `ReferenceError: transferenciaSchema is not defined` en la consola

**Scenario 1.2: Validación de campos requeridos**
- Given: El formulario está vacío
- When: El usuario intenta submit sin completar campos
- Then: El formulario DEBE mostrar errores de validación en los campos faltantes

**Scenario 1.3: Carga en modo edición**
- Given: Se pasa `initialData` con datos de una transferencia existente
- When: El componente se monta
- Then: Los campos DEBEN pre-poblarse con los valores de `initialData`

**Scenario 1.4: Submit exitoso**
- Given: Todos los campos están completos y válidos
- When: El usuario hace submit
- Then: `createTransferenciaAction` DEBE recibir los datos parseados correctamente

---

## BUG-2: Fuga de tenant en paginación

### Description

`getTransferenciasAction` usa `prisma.transferencia.count({ where: { deletedAt: null } })` sin filtrar por `tenantId`. En multi-tenant, el total de páginas reportado incluye transferencias de otros tenants.

### Contract

Fragmento actual (BUG):
```typescript
const total = await prisma.transferencia.count({ where: { deletedAt: null } });
```

Fragmento corregido:
```typescript
const total = await prisma.transferencia.count({ where: { tenantId, deletedAt: null } });
```

### Scenarios

**Scenario 2.1: Conteo por tenant**
- Given: Existen transferencias en tenant-A (5) y tenant-B (3)
- When: `getTransferenciasAction` se ejecuta para tenant-A
- Then: `pagination.total` DEBE ser 5
- And: `pagination.totalPages` DEBE calcularse contra 5, no contra 8

---

## BUG-3: Stock en PV incluye transferencias canceladas

### Description

`getStockDisponibleEnPuntoVenta` agrega transferencias de entrada y salida sin excluir aquellas con estado `CANCELADA` o `RECHAZADA`, ni con `deletedAt` seteado. Esto distorsiona el stock disponible y puede bloquear transferencias legítimas.

### Contract

La función DEBE filtrar por `deletedAt: null` y excluir estados no activos:

```typescript
const entrada = await prisma.transferencia.aggregate({
  where: {
    productoId,
    puntoDeVentaDestinoId: puntoDeVentaId,
    deletedAt: null,
    estado: { notIn: ['CANCELADA', 'RECHAZADA'] },
  },
  _sum: { cantidad: true },
});

const salida = await prisma.transferencia.aggregate({
  where: {
    productoId,
    puntoDeVentaOrigenId: puntoDeVentaId,
    deletedAt: null,
    estado: { notIn: ['CANCELADA', 'RECHAZADA'] },
  },
  _sum: { cantidad: true },
});
```

### Scenarios

**Scenario 3.1: Stock ignora transferencias canceladas**
- Given: Un PV tiene 10 unidades entrada (COMPLETADA) y 5 unidades entrada (CANCELADA)
- When: `getStockDisponibleEnPuntoVenta` calcula stock
- Then: El stock disponible DEBE ser 10 (ignorando las 5 canceladas)

**Scenario 3.2: Stock ignora transferencias rechazadas**
- Given: Un PV tiene 10 unidades entrada (COMPLETADA) y 3 unidades salida (RECHAZADA)
- When: `getStockDisponibleEnPuntoVenta` calcula stock
- Then: El stock disponible DEBE ser 10 (ignorando la salida rechazada)

---

## BUG-4: Update siempre borra relaciones con puntos de venta

### Description

`updateTransferenciaAction` siempre setea `puntoDeVentaOrigenId: null` y `puntoDeVentaDestinoId: null` al actualizar, sin importar si la transferencia original tenía origen/destino en un punto de venta. Además, el schema `updateTransferenciaSchema` no incluye estos campos.

### Contract

Agregar campos al schema:
```typescript
export const updateTransferenciaSchema = z.object({
  transferenciaId: z.string().min(1),
  productoId: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
  tipoOrigen: z.enum(['almacen', 'punto_venta']),
  origenId: z.string().min(1),
  tipoDestino: z.enum(['almacen', 'punto_venta']),
  destinoId: z.string().min(1),
  estado: z.enum(TRANSFERENCIA_ESTADOS).optional(),
});
```

Nota: `updateTransferenciaAction` actualmente solo soporta edición de transferencias almacén→almacén (solo usa `origenId`/`destinoId`). Para soportar edición con puntos de venta, DEBERÍA agregar `puntoDeVentaOrigenId` y `puntoDeVentaDestinoId` al schema.

Sin embargo, como el modelo `Transferencia` usa `origenId`/`destinoId` (nullable) para almacenes y `puntoDeVentaOrigenId`/`puntoDeVentaDestinoId` para PVs, la edición actual solo funciona para almacenes. La corrección MÍNIMA es:

1. NO hardcodear `puntoDeVentaOrigenId: null` y `puntoDeVentaDestinoId: null` — solo actualizar los campos que el schema provee.
2. Agregar `puntoDeVentaOrigenId` y `puntoDeVentaDestinoId` al schema como opcionales.

Pero dado que la UI de edición (vía `EditarTransferenciaContent`) pasa el objeto completo, habría que mapear correctamente qué campos aplicar.

**Corrección pragmática:** En `updateTransferenciaAction`, en lugar de hardcodear nulls, construir dinámicamente el `data` según `tipoOrigen`/`tipoDestino`:

```typescript
const data: any = { productoId, cantidad };
if (tipoOrigen === 'almacen') {
  data.origenId = origenId;
  data.puntoDeVentaOrigenId = null;
} else {
  data.puntoDeVentaOrigenId = origenId;
  data.origenId = null;
}
// similar para destino
```

### Scenarios

**Scenario 4.1: Update preserva PV origen/destino**
- Given: Una transferencia existe con `puntoDeVentaOrigenId = "pv-1"` y `destinoId = "alm-2"`
- When: Se llama `updateTransferenciaAction` con `tipoOrigen: "punto_venta"`, `origenId: "pv-1"`
- Then: La transferencia actualizada DEBE mantener `puntoDeVentaOrigenId = "pv-1"`
- And: `origenId` DEBE ser `null` (porque el origen es un PV, no almacén)

**Scenario 4.2: Update preserva almacén origen/destino**
- Given: Una transferencia existe con `origenId = "alm-1"` y `puntoDeVentaDestinoId = "pv-1"`
- When: Se llama `updateTransferenciaAction` con `tipoDestino: "punto_venta"`, `destinoId: "pv-1"`
- Then: La transferencia actualizada DEBE mantener `puntoDeVentaDestinoId = "pv-1"`
- And: `destinoId` DEBE ser `null`

---

## BUG-5: Validación de stock en almacén usa producto.stock global

### Description

Cuando `tipoOrigen === 'almacen'`, `createTransferenciaAction` valida stock contra `producto.stock` (stock global del producto), no contra el stock real disponible en ese almacén específico vía `StockUbicacion`.

### Contract

Reemplazar:
```typescript
if (tipoOrigen === 'punto_venta') {
  // ... usa getStockDisponibleEnPuntoVenta
} else if (producto.stock < item.cantidad) {
  throw new ActionError(...);
}
```

Por:
```typescript
if (tipoOrigen === 'punto_venta') {
  const stockDisponible = await getStockDisponibleEnPuntoVenta(item.productoId, origenId);
  if (stockDisponible < item.cantidad) throw new ActionError(...);
} else if (tipoOrigen === 'almacen') {
  const stockUbicacion = await prisma.stockUbicacion.findUnique({
    where: {
      productoId_tipoUbicacion_ubicacionId: {
        productoId: item.productoId,
        tipoUbicacion: 'almacen',
        ubicacionId: origenId,
      },
    },
  });
  const stockDisponible = stockUbicacion?.cantidadDisponible ?? 0;
  if (stockDisponible < item.cantidad) {
    throw new ActionError(
      `Stock insuficiente para ${producto.nombre} en el almacén. Disponible: ${stockDisponible}`,
      'STOCK_INSUFICIENTE',
    );
  }
}
```

### Scenarios

**Scenario 5.1: Stock validado por almacén específico**
- Given: Producto "Laptop" tiene stock global = 50, pero en "Almacén Norte" tiene 5 unidades según StockUbicacion
- When: Se intenta transferir 10 unidades desde "Almacén Norte"
- Then: La acción DEBE rechazar con `STOCK_INSUFICIENTE` y mensaje "Disponible: 5"

**Scenario 5.2: Stock suficiente en el almacén**
- Given: Producto "Laptop" tiene 15 unidades en "Almacén Norte" según StockUbicacion
- When: Se intenta transferir 10 unidades desde "Almacén Norte"
- Then: La acción DEBE permitir la transferencia

**Scenario 5.3: Sin registro de StockUbicacion (nuevo producto)**
- Given: Producto nuevo sin registro en StockUbicacion para el almacén origen
- When: Se intenta transferir desde ese almacén
- Then: stockDisponible DEBE ser 0
- And: La acción DEBE rechazar con `STOCK_INSUFICIENTE`

---

## Archivos afectados

| Archivo | Bugs | Cambio |
|---|---|---|
| `src/features/transferencias/components/transferencias-form.tsx` | BUG-1 | Agregar `transferenciaSchema`, `TransferenciaFormValues`, `TransferenciaFormProps` |
| `src/features/transferencias/actions.ts` | BUG-2, BUG-3, BUG-4, BUG-5 | Corregir count filter, stock filter, update data, stock validation |
| `src/features/transferencias/schemas.ts` | BUG-4 | Agregar campos opcionales a update schema (opcional, ver Spec) |
| `src/features/transferencias/__tests__/actions.test.ts` | Todos | Actualizar tests existentes + agregar nuevos escenarios |

## Criterios de aceptación globales

- [ ] `pnpm run test:run` pasa en `src/features/transferencias/__tests__/actions.test.ts`
- [ ] `pnpm exec eslint src/features/transferencias/` sin errores
- [ ] No hay `ReferenceError: transferenciaSchema is not defined` en logs del browser
- [ ] La paginación en lista de transferencias es correcta por tenant
- [ ] Stock disponible en PV ignora transferencias canceladas
- [ ] Editar transferencia preserva relaciones con PV
- [ ] Stock en almacén se valida contra StockUbicacion
