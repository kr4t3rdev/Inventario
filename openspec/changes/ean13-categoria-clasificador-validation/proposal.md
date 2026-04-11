# Proposal: Validación de categorías y subcategorías contra CLAS en modo EAN-13

## Intent

Hoy se pueden crear categorías y subcategorías personalizadas que no existen en el clasificador CLAS. Eso deja datos inválidos en catálogo y el error recién aparece más tarde en el formulario de productos cuando intenta resolver sección/específico para generar EAN-13.

Objetivo: mover la validación al origen. Cuando `usaCodigoEan13` está activo, el alta/edición de categorías debe validar el nombre ingresado contra el clasificador oficial y mostrar toast inmediato con el texto exacto pedido por negocio.

## Scope

### In Scope
- Alta y edición de categorías desde `CategoryForm`
- Distinción entre categoría raíz y subcategoría usando `parentId`
- Toast inmediato en modo EAN-13 ON con copy exacto para categoría y subcategoría
- Validación backend equivalente en create/update de categorías para evitar bypass por API

### Out of Scope
- Cambios al formulario de productos
- Migración/limpieza automática de categorías inválidas ya existentes
- Rigurosidad adicional cuando `usaCodigoEan13` está OFF

## Capabilities

### Modified Capabilities
- `catalogo`: gestión de categorías en modo oficial EAN-13

## Approach

- Reutilizar `mapCategoryToSection` para categorías raíz y `mapSubcategoryToSpecific` para subcategorías.
- En cliente, bloquear submit antes de la llamada API y emitir toast exacto:
  - Categoría: `Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador`
  - Subcategoría: `Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador`
- En servidor, agregar una red de seguridad en `CategoriaValidator` que consulte `MiEmpresa.usaCodigoEan13` y rechace create/update inválidos con error 400 coherente.

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `src/components/categorias/category-form.tsx` | Modificado | Ya conoce el flag `usaEan13`; debe participar del flujo de validación previa al submit |
| `src/hooks/use-category-form.ts` | Modificado | Debe emitir toast exacto y abortar submit cuando el nombre no corresponde a CLAS |
| `src/lib/categoria-validation.ts` | Modificado | Debe aplicar la misma regla en backend sólo cuando EAN-13 está activo |
| `src/lib/category-mapping.ts` | Solo lectura | Fuente de verdad para secciones y específicos |

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Doble mensaje (toast + error de campo) | Media | Priorizar toast y evitar mensaje genérico duplicado al fallar validación cliente |
| Categorías válidas con diferencias de espacios/mayúsculas | Baja | Reutilizar helpers existentes, que ya son case-insensitive y trim |
| Bypass por llamadas API externas | Media | Mantener validación servidor como segunda línea de defensa |

## Rollback Plan

- Remover la validación EAN-13 del flujo de submit del formulario de categorías
- Remover la validación condicional en `CategoriaValidator`
- Conservar sin cambios la lógica actual cuando `usaCodigoEan13` está OFF

## Success Criteria

- [ ] Con EAN-13 ON, una categoría raíz fuera de CLAS no llega al backend y muestra el toast exacto de categoría
- [ ] Con EAN-13 ON, una subcategoría fuera de CLAS no llega al backend y muestra el toast exacto de subcategoría
- [ ] Con EAN-13 OFF, el formulario de categorías mantiene la flexibilidad actual
- [ ] Create/update por API también rechazan nombres inválidos cuando EAN-13 está activo
- [ ] El error deja de aparecer más tarde en el formulario de productos por estas altas inválidas