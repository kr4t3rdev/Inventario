# Tasks: ean13-mode-estados-validacion

## Status: COMPLETED

### T1 — Fix `required` condicional en SubcategorySelector
- [x] Cambiar `required` hardcoded → `required={usaEan13}` en `productos-form.tsx`
- **Archivo**: `src/components/productos/productos-form.tsx` (línea ~774)

### T2 — Agregar import de funciones CLAS
- [x] Agregar import de `mapCategoryToSection` y `mapSubcategoryToSpecific` desde `@/lib/category-mapping`
- **Archivo**: `src/components/productos/productos-form.tsx` (línea 53)

### T3 — Validación inline en `onCategoryChange`
- [x] Si `usaEan13` está activo y el usuario selecciona una categoría, buscar su `nombre` en el array `categorias` y llamar `mapCategoryToSection(cat.nombre)`
- [x] Si lanza error → `form.setError('categoriaId', { type: 'manual', message: '...' })`
- [x] Si pasa → `form.clearErrors('categoriaId')`
- **Archivo**: `src/components/productos/productos-form.tsx` (líneas ~728-750)

### T4 — Validación inline en `onSubcategoryChange`
- [x] Si `usaEan13` está activo y se selecciona subcategoría, buscar `nombre` en array `subcategorias` y llamar `mapSubcategoryToSpecific(sub.nombre)`
- [x] Si lanza error → `form.setError('subcategoriaId', { type: 'manual', message: '...' })`
- [x] Si pasa → `form.clearErrors('subcategoriaId')`
- **Archivo**: `src/components/productos/productos-form.tsx` (líneas ~752-773)

### T5 — Fix schema `categoriaId`
- [x] Agregar `.min(1, 'Seleccione una categoría')` al schema Zod para prevenir string vacío
- **Archivo**: `src/components/productos/productos-form.tsx` (línea ~71)

## Archivos modificados
- `src/components/productos/productos-form.tsx` — 3 bloques editados (import, schema, SubcategorySelector block)
