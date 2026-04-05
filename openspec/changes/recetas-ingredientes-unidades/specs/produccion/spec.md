# Spec: Recetas — Ingredientes con Unidades de Medida

## Feature Overview

Mejoras al módulo de recetas de producción para soportar ingredientes con unidades de medida opcionales, conversión automática, visualización descriptiva y cálculo correcto del costo unitario.

---

## Requirements

### REQ-01: Multi-ingrediente en formulario de creación

**Descripción**: El dialog de creación de receta debe permitir agregar N ingredientes antes de guardar, de la misma forma que el dialog de edición.

**Criterios de aceptación**:
- El dialog de creación muestra una sección "Ingredientes" con botón "Agregar ingrediente"
- Cada fila tiene: Select de producto, Input de cantidad (>0), Select de unidad (opcional), Input de desperdicio (%)
- Se puede eliminar cualquier fila
- Al confirmar creación, primero crea la receta y luego llama a `setIngredientes` con los items
- Si hay 0 ingredientes se puede crear igualmente (ingredientes vacíos)

**Estado pre-cambio**: `handleCrearReceta` solo envía `{nombre, rendimiento, productoId}`, sin ingredientes.

---

### REQ-02: Unidad de medida opcional por ingrediente

**Descripción**: Cada ingrediente puede tener una unidad de medida con la que se mide en la receta.

**Unidades soportadas (masa)**: g, kg, lb, oz  
**Unidades soportadas (volumen)**: ml, L, fl oz, tsp, tbsp, cup  
**Sin conversión**: unidades sin equivalente (ej. "unidad", "pieza") → factor 1:1

**Criterios de aceptación**:
- Select de unidad con opciones predefinidas agrupadas (Masa / Volumen / Sin conversión)
- Si no se selecciona unidad: comportamiento 1:1 (sin conversión)
- La unidad seleccionada se guarda en `RecetaIngrediente.unidadSimbolo`
- En el resumen y vista del ingrediente se muestra la unidad junto a la cantidad

---

### REQ-03: Conversión automática de unidades

**Descripción**: El sistema convierte cantidades a una unidad base para calcular costo y descontar stock.

**Unidad base masa**: gramos (g)  
**Unidad base volumen**: mililitros (ml)

**Criterios de aceptación**:
- `convertToBase(2, 'lb')` retorna `907.184` (gramos)
- `convertToBase(1, 'kg')` retorna `1000` (gramos)
- `convertToBase(1, 'L')` retorna `1000` (ml)
- `convertToBase(5, 'unidad')` retorna `5` (pass-through)
- `convertToBase(5, null)` retorna `5` (pass-through para null)
- Tests unitarios cubren todas las unidades

---

### REQ-04: Costo unitario correcto

**Descripción**: El costo unitario de la receta se calcula como la suma de costos de cada ingrediente dividida entre el rendimiento.

**Fórmula**:
$$costoUnitario = \frac{\sum_{i} (precioCosto_i \times convertToBase(cantidad_i, unidad_i) \times (1 + desperdicio_i))}{rendimiento}$$

**Criterios de aceptación**:
- El endpoint `POST /recetas/[id]/ingredientes` aplica la fórmula correcta
- Si el rendimiento es 0 o null, se usa 1 como fallback (no dividir por cero)
- El campo `costoUnitario` en la tabla muestra el valor actualizado tras guardar ingredientes

**Estado pre-cambio**: La fórmula actual suma sin dividir entre rendimiento.

---

### REQ-05: Descuento de stock correcto al aprobar orden

**Descripción**: Al aprobar una orden de producción, el sistema descuenta del inventario la cantidad real de cada ingrediente, respetando las unidades.

**Criterios de aceptación**:
- El endpoint `POST /ordenes/[id]/aprobar` convierte la cantidad del ingrediente a la unidad base antes de multiplicar por `cantidadOrden`
- El stock se descuenta en las unidades que maneja el inventario (unidad base del producto)
- Si el ingrediente no tiene `unidadSimbolo`, el comportamiento es idéntico al actual (sin conversión)

---

### REQ-06: Columna "Ingredientes" descriptiva en tabla

**Descripción**: La columna "Ingredientes" de la tabla de recetas muestra una cadena descriptiva en lugar del conteo numérico.

**Formato**: `"2 lb Arroz, 500 g Sal, 1 L Agua"`

**Criterios de aceptación**:
- Si hay ingredientes: muestra la lista separada por coma
- Si no hay ingredientes: muestra `"Sin ingredientes"`
- Truncar a máximo 3 ingredientes visibles + `"... +N más"` si hay más de 3
- La función `formatIngredientesList(ingredientes)` vive en `unit-converter.ts`

**Estado pre-cambio**: `receta.ingredientes?.length || 0` — muestra solo el conteo.

---

### REQ-07: Columna "Producto Asociado" con insumos

**Descripción**: La columna "Producto Asociado" debe mostrar los nombres de los insumos (ingredientes), no el producto final asociado.

**Criterios de aceptación**:
- Muestra los nombres de los productos usados como ingredientes
- Formato: `"Arroz, Sal, Aceite"` (primeros 2 + `"+N"` si hay más)
- Si no hay ingredientes: muestra `"-"`
- El producto final (`receta.Producto`) sigue siendo accesible en el dialog "Ver Receta"

**Estado pre-cambio**: `receta.producto?.nombre || '-'` — muestra solo el producto final.

---

### REQ-08: Dialog "Ver Receta" actualizado

**Descripción**: El dialog de visualización de receta muestra la unidad de medida de cada ingrediente.

**Criterios de aceptación**:
- Cada ingrediente muestra: cantidad + unidad + nombre + desperdicio
- Ejemplo: `"2 lb Arroz (5% desperdicio)"`
- Se muestra el costo unitario calculado
- Se muestra el rendimiento

---

## Data Model Changes

### RecetaIngrediente — campo nuevo

```prisma
model RecetaIngrediente {
  // ... campos existentes ...
  unidadSimbolo String?  // nuevo — ej. "lb", "g", "ml"; null = sin conversión
}
```

**Migración**: Los registros existentes quedan con `unidadSimbolo = null` → comportamiento 1:1 (sin cambio en cálculos actuales hasta que se re-guarden).

---

## New Utility: unit-converter.ts

```typescript
// src/lib/utils/unit-converter.ts

export type MassUnit = 'g' | 'kg' | 'lb' | 'oz'
export type VolumeUnit = 'ml' | 'L' | 'fl oz' | 'tsp' | 'tbsp' | 'cup'
export type KnownUnit = MassUnit | VolumeUnit

export const MASS_UNITS: MassUnit[] = ['g', 'kg', 'lb', 'oz']
export const VOLUME_UNITS: VolumeUnit[] = ['ml', 'L', 'fl oz', 'tsp', 'tbsp', 'cup']

// Convierte cantidad a unidad base (g para masa, ml para volumen)
export function convertToBase(cantidad: number, simbolo: string | null | undefined): number

// Formatea un ingrediente como string: "2 lb Arroz"
export function formatIngrediente(cantidad: number, simbolo: string | null | undefined, nombre: string): string

// Formatea lista de ingredientes: "2 lb Arroz, 5 g Sal, ... +N más"
export function formatIngredientesList(
  ingredientes: Array<{ cantidad: number; unidadSimbolo?: string | null; Producto?: { nombre: string } }>,
  maxVisible?: number
): string
```

---

## API Changes

### POST `/api/produccion/recetas/[id]/ingredientes`

**Schema Zod actualizado**:
```typescript
z.object({
  ingredientes: z.array(z.object({
    productoId: z.string(),
    cantidad: z.number().positive(),
    desperdicio: z.number().min(0).max(1).default(0),
    unidadSimbolo: z.string().optional().nullable(),  // NUEVO
  })),
})
```

**Lógica actualizada**:
```typescript
const rendimiento = recetaExistente.rendimiento || 1
let costoTotal = 0
for (const ing of ingredientes) {
  const cantidadBase = convertToBase(ing.cantidad, ing.unidadSimbolo)
  costoTotal += precioCosto * cantidadBase * (1 + (ing.desperdicio ?? 0))
}
const costoUnitario = costoTotal / rendimiento
```

### POST `/api/produccion/ordenes/[id]/aprobar`

**Lógica actualizada**:
```typescript
// Por cada ingrediente:
const cantidadBase = convertToBase(ing.cantidad, ing.unidadSimbolo)
const totalDescontar = cantidadBase * orden.cantidad
await prisma.producto.update({ where: { id }, data: { stock: { decrement: totalDescontar } } })
```

---

## Scenarios

### Scenario A: Crear receta con ingredientes y unidades

```
DADO que el usuario abre el dialog "Nueva Receta"
CUANDO agrega ingrediente: "Arroz", cantidad 2, unidad "lb", desperdicio 5%
Y agrega ingrediente: "Sal", cantidad 500, unidad "g", desperdicio 0%
Y confirma con nombre "Pan de Arroz", rendimiento 10
ENTONCES se crea la receta
Y se guarda RecetaIngrediente con unidadSimbolo="lb" para Arroz
Y se guarda RecetaIngrediente con unidadSimbolo="g" para Sal
Y costoUnitario = (precioArroz×907.184×1.05 + precioSal×500×1) / 10
```

### Scenario B: costoUnitario correcto

```
DADO Arroz precioCosto=0.002 $/g, cantidad=2 lb, desperdicio=5%, rendimiento=10
CUANDO se guardan los ingredientes
ENTONCES cantidadBase = 2 × 453.592 = 907.184 g
Y costoTotal = 0.002 × 907.184 × 1.05 = 1.905
Y costoUnitario = 1.905 / 10 = 0.1905
```

### Scenario C: Tabla muestra ingredientes descriptivamente

```
DADO receta con ingredientes: [2 lb Arroz, 500 g Sal, 1 L Agua]
CUANDO se muestra la tabla de recetas
ENTONCES columna "Ingredientes" = "2 lb Arroz, 500 g Sal, 1 L Agua"
Y columna "Producto Asociado" = "Arroz, Sal, Agua"
```

### Scenario D: Ingresa sin unidad (comportamiento legacy)

```
DADO ingrediente guardado con unidadSimbolo=null
CUANDO se calcula costoUnitario
ENTONCES convertToBase(5, null) = 5 (pass-through)
Y el cálculo es idéntico al comportamiento anterior (excepto la división por rendimiento)
```

### Scenario E: Más de 3 ingredientes en tabla

```
DADO receta con 5 ingredientes
CUANDO se muestra la tabla
ENTONCES columna "Ingredientes" = "2 lb Arroz, 500 g Sal, 1 L Agua ... +2 más"
```
