# Proposal: EAN-13 Mode — Estados y Validación de Categorías

## Intent

El formulario de productos muestra (y valida) campos EAN-13 aunque la empresa tenga el switch desactivado.
Además, cuando el modo está activo, no hay feedback inmediato al usuario si la categoría/subcategoría elegida no existe en el Clasificador CLAS — el error aparece recién al guardar, en el servidor.

Objetivo: definir dos estados claros en la UI y agregar validación inline del Clasificador cuando EAN-13 está activo.

---

## Scope

### In Scope
- **Estado OFF** (default): formulario de producto sin ningún campo EAN-13 visible ni requerido
- **Estado ON**: todos los campos EAN-13 visibles, con validación inline de categoría/subcategoría contra `CATEGORY_TO_SECTION` y `SUBCATEGORY_TO_SPECIFIC`
- Error en UI cuando categoría seleccionada **no figura en el Clasificador CLAS** (modo EAN ON)
- Error en UI cuando subcategoría seleccionada **no figura como específico** en el Clasificador CLAS (modo EAN ON)
- Mensaje de error claro: *"Categoría no encontrada en el Clasificador oficial CLAS — revisá el documento antes de crear Secciones y Específicos"*

### Out of Scope
- Migración de productos existentes sin código EAN-13
- Edición de categorías del Clasificador desde la UI
- Validación EAN-13 en el flujo de edición de productos (solo creación)

---

## Approach

### Estado OFF (switch desactivado)
El `useEffect` en `ProductoForm` ya carga `usaEan13` desde `/api/mi-empresa`.
- La condición `{usaEan13 && (...)}` ya oculta el bloque EAN-13
- **Falta**: el `SubcategorySelector` aún muestra `required` (asterisco visual) independientemente del modo → debe ser `required={usaEan13}`
- **Falta**: la validación Zod de `categoriaId` acepta string vacío → el form se puede enviar sin categoría en modo OFF → agregar `.min(1)` al schema

### Estado ON (switch activado)
El bloque completo de EAN-13 ya se muestra cuando `usaEan13 === true`.
- **Falta**: validación inline en el `onCategoryChange` del FormField de `categoriaId`
- Llamar `mapCategoryToSection(categoria.nombre)` en el change handler; si lanza (`throw`), mostrar error con `form.setError('categoriaId', ...)`
- Misma lógica en `onSubcategoryChange` con `mapSubcategoryToSpecific(subcategoria.nombre)`

### Backend (ya parcialmente hecho)
`resolveTaxonomyContext` en `/api/productos/route.ts` ya llama `resolveTaxonomySegments` que usa el mismo mapping e incluye el mensaje de error. **No requiere cambios adicionales** — es la red de seguridad del servidor.

---

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `src/components/productos/productos-form.tsx` | Modificado | Corregir `required` del selector, agregar validación inline del Clasificador en change handlers |
| `src/lib/category-mapping.ts` | Solo lectura | `mapCategoryToSection` y `mapSubcategoryToSpecific` ya existen y lanzan error si no encuentran — usarlos como fuente de verdad |
| `src/components/categorias/subcategory-selector.tsx` | Verificar | Confirmar que los callbacks `onCategoryChange` / `onSubcategoryChange` reciben el `nombre` además del `id` (necesario para validar) |

---

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| `SubcategorySelector` solo expone `id`, no el `nombre` | Media | Leer el nombre desde el array `categorias` / `subcategorias` ya cargado en el form por `catId` |
| False positives: nombre con mayúsculas/espacios distintos | Baja | `mapCategoryToSection` ya es case-insensitive; revisar antes de integrar |
| Regresión en modo OFF: campos ocultos con validación activa | Media | El schema Zod debe usar `.optional()` o `.min(1)` condicional; los campos EAN-13 ya son `optional()` |

---

## Rollback Plan

Todos los cambios son en el frontend (`productos-form.tsx`). Para revertir:
- Restaurar `required` (sin condicional) en `SubcategorySelector`
- Eliminar los llamados a `mapCategoryToSection` / `mapSubcategoryToSpecific` en los change handlers
- No hay cambios de schema ni migraciones

---

## Dependencies

- `src/lib/category-mapping.ts` — funciones `mapCategoryToSection` y `mapSubcategoryToSpecific` ya disponibles
- `src/components/categorias/subcategory-selector.tsx` — verificar que expone nombre de categoría en callbacks (tarea previa a implementar)

---

## Success Criteria

- [ ] Con switch OFF: el formulario de producto no muestra ningún campo relacionado con EAN-13 (proveedor, sección, específico, código negocio, ClasificadorInfoNote)
- [ ] Con switch OFF: se puede crear un producto seleccionando solo categoría (sin subcategoría requerida)
- [ ] Con switch ON: seleccionar una categoría que no exista en CLAS muestra error inline: *"Categoría no encontrada en el Clasificador oficial CLAS — revisá el documento antes de crear Secciones y Específicos"*
- [ ] Con switch ON: seleccionar una subcategoría que no exista en CLAS muestra error inline equivalente
- [ ] Con switch ON: el error se limpia cuando el usuario cambia a una categoría/subcategoría válida
- [ ] El backend sigue validando en `resolveTaxonomyContext` como segunda línea de defensa
