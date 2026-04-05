# Proposal: Recetas — Ingredientes con Unidades de Medida

## Summary

Mejorar el módulo de producción para que las recetas soporten múltiples ingredientes con unidades de medida opcionales, conversión automática entre unidades, visualización descriptiva de ingredientes en la tabla, y cálculo correcto del costo unitario dividiendo entre el rendimiento.

## Intent

Actualmente el formulario de creación de receta no permite agregar ingredientes en tiempo real; la columna "Ingredientes" solo muestra un conteo numérico; la columna "Producto Asociado" solo muestra el producto final (no los insumos); y el costo unitario no divide entre el rendimiento. El objetivo es hacer la interfaz funcional y los datos correctos.

## User Requirements

Los requerimientos vienen directamente del usuario:

1. **Multi-ingrediente en el form**: permitir agregar en el formulario de creación todos los productos del inventario que el usuario quiera, sin límite.
2. **Productos asociados en la tabla**: la columna "Producto Asociado" debe listar los productos/insumos de la receta (no solo el producto final).
3. **Unidad de medida por ingrediente**: campo opcional por ingrediente (lb, g, kg, oz, ml, L, etc.) con conversión automática para calcular correctamente el costo y descontar inventario.
4. **Vista descriptiva de ingredientes**: la columna "Ingredientes" debe mostrar texto completo, ej. `"2 lb Arroz, 5 g Sal, 1 oz Aceite"`.
5. **Formula costoUnitario correcta**: `costoUnitario = Σ(precioCosto × cantidadEnUnidadBase × (1 + desperdicio)) / rendimiento`.

## Affected Areas

- `prisma/schema.prisma` — agregar `unidadId`, `unidadSimbolo` a `RecetaIngrediente`
- `src/lib/utils/unit-converter.ts` — nuevo archivo con lógica de conversión
- `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` — fix costoUnitario + aceptar unidadSimbolo
- `src/app/api/produccion/ordenes/[id]/aprobar/route.ts` — usar cantidades convertidas al descontar stock
- `src/app/busy/produccion/page.tsx` — formulario de creación + tabla

## Scope

### In Scope

- Agregar `unidadSimbolo String?` a `RecetaIngrediente` en el schema (string libre, no FK a Unidad, para máxima flexibilidad)
- Utilidad de conversión de unidades: `lb↔g↔kg↔oz` y `ml↔L↔fl oz↔tsp↔tbsp↔cup`, con unidades "sin conversión" como pass-through
- Formulario de creación de receta con sección de ingredientes inline (mismo patrón que el dialog de edición)
- Columna "Ingredientes" en tabla: string descriptivo `"2 lb Arroz, 5 g Sal"`
- Columna "Producto Asociado": listar nombres de ingredientes (los insumos), no el producto final
- Fix formula costoUnitario: dividir por rendimiento
- Fix aprobar orden: convertir cantidades antes de descontar stock si la unidad del ingrediente difiere de la unidad base del inventario
- Actualizar Dialog "Ver Receta" para mostrar la unidad por ingrediente

### Out of Scope

- Crear nuevas unidades de medida desde el UI (se usa la tabla `Unidad` existente solo para referencia, no se lleva FK)
- Conversión automática entre sistemas métrico y apotecario (farmacia)
- Gestión de almacenes separados por unidad

## Approach

### Schema

Se agrega `unidadSimbolo String?` a `RecetaIngrediente`. Al guardar un ingrediente el usuario elige la unidad en la que se mide en la receta (ej. "lb"). La utilidad de conversión convierte esa cantidad a la unidad base (gramos para masa, ml para volumen) antes de calcular el costo y descontar stock.

Se elige `unidadSimbolo` como campo de texto libre (no FK a `Unidad`) para:
- Evitar una migración FK adicional
- Allow símbolos como "tbsp", "fl oz" que no están necesariamente en la tabla `Unidad`
- Evitar constraint violations si el usuario escribe un símbolo nuevo

### Unit Converter

```typescript
// src/lib/utils/unit-converter.ts
const MASS_TO_GRAMS: Record<string, number> = {
  g: 1, kg: 1000, lb: 453.592, oz: 28.3495,
}
const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, L: 1000, 'fl oz': 29.5735, tsp: 4.92892, tbsp: 14.7868, cup: 240,
}
export function convertToBase(cantidad: number, simbolo: string): number
export function convertFromBase(cantidad: number, simbolo: string): number
export function formatIngrediente(cantidad: number, simbolo: string | null, nombre: string): string
```

### costoUnitario Fix

```
// ANTES (incorrecto):
costoUnitario += precioCosto * cantidad * (1 + desperdicio)

// DESPUÉS (correcto):
const cantidadBase = convertToBase(cantidad, unidadSimbolo ?? 'unidad')
costoTotal += precioCosto * cantidadBase * (1 + desperdicio)
costoUnitario = costoTotal / rendimiento
```

### Formulario de Creación

El dialog de creación de receta agrega una sección de ingredientes idéntica a la del dialog de edición:
- Botón "Agregar ingrediente" → fila: `[Select producto] [Input cantidad] [Select unidad] [Input desperdicio%] [Trash]`
- Al crear receta → luego llama a `setIngredientes` con los items acumulados
- Reutiliza los mismos handlers `nuevoItems` que `editItems`

### API Changes Summary

| Endpoint | Cambio |
|----------|--------|
| `POST /recetas/[id]/ingredientes` | Acepta `unidadSimbolo?` por ingrediente; aplica conversión en costoUnitario; divide por rendimiento |
| `POST /ordenes/[id]/aprobar` | Convierte cantidades antes de descontar stock |
| `GET /recetas` | Ya incluye `RecetaIngrediente` con `Producto`; se agrega `unidadSimbolo` al include |

## Risks

- **Migración de datos existentes**: Los ingredientes existentes quedarán con `unidadSimbolo = null`. El comportamiento de fallback (no conversión, 1:1) es correcto.
- **Conversión irreversible**: Si el sistema ya descontó stock sin conversión, no se puede retroactivamente corregir. Se acepta como deuda técnica.
- **String libre para unidad**: Un usuario puede tipear "libras" en vez de "lb". La conversion fallará silenciosamente (pass-through). Se mitiga con un Select de opciones predefinidas en el UI.

## Alternatives Considered

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| FK a tabla `Unidad` | Datos normalizados | Migración FK + constraint; tabla Unidad no tiene todas las unidades | ❌ |
| String libre `unidadSimbolo` | Flexible, sin migración FK | Posibles errores de tipeo | ✅ Elegida |
| Sin conversión (solo label) | Más simple | costoUnitario y descuento de stock seguirían siendo incorrectos | ❌ |
