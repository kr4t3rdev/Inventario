# Categorías

> Módulo de taxonomía jerárquica de productos con soporte para clasificador CLAS y códigos EAN-13.

## Stack

- **Server Actions**: CRUD completo via `withAction` wrapper + `requireTenant` scope
- **Validación**: Zod schemas (`categoriaCreateSchema`, `categoriaUpdateSchema`)
- **Validación de negocio**: `CategoriaValidator` y `CategoriaDeletionValidator`
- **CLAS Classifier**: Integración con nomenclador oficial cubano (secciones/específicos)
- **UI**: shadcn/ui DataTable con vista lista/árbol, Framer Motion, React Hook Form

## Operaciones CRUD

| Acción | Server Action | Descripción |
|--------|--------------|-------------|
| Listar | `getCategoriasAction` | Todas las categorías del tenant |
| Detalle | `getCategoriaByIdAction` | Una categoría por ID con validación de tenant |
| Jerarquía | `getCategoriaHierarchyAction` | Árbol completo con conteo de productos |
| Crear | `createCategoriaAction` | Con validación de unicidad, jerarquía, CLAS |
| Actualizar | `updateCategoriaAction` | Re-valida según cambios |
| Eliminar | `deleteCategoriaAction` | Reasigna productos de subcategorías al padre |

## Modo EAN-13 / CLAS

Cuando el plan incluye el feature `categorias-ean13` y Mi Empresa tiene `usaCodigoEan13=true`:

- **Categoría → Sección CLAS**: selección desde nomenclador oficial
- **Subcategoría → Específico CLAS**: filtrado por sección seleccionada
- **Nombre autocompletado**: según el específico CLAS elegido
- **CLAS classifier**: archivo `clasificador.md` parseado en `src/lib/clas-classifier.ts`
- **Labels dinámicos**: toda la UI alterna entre "subcategoría"/"específico CLAS" según modo

## Demo Seeding por Plan

| Plan | Categorías | Subcategorías |
|------|-----------|---------------|
| Básico | Alimentos, Hogar, Bebidas | 1 (Bebidas) |
| Profesional | + Tecnología | — |
| Empresarial | + Farmacia, Electrodomésticos, Oficina | — |

## Tests

- **25 tests** en `src/features/categorias/__tests__/`
- Server Actions mockean Prisma
- Componentes usan mock centralizado de framer-motion
- Sin warnings de `whileHover`/`whileTap` en output
