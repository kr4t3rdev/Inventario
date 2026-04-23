# Proposal: Búsqueda y filtrado de específicos CLAS en formulario y visualizador

## Intent

Hoy el selector de específicos en `SubcategoryForm` es un `<Select>` nativo que obliga al usuario a scrollear una lista potencialmente larga de cientos de específicos por sección. Además, el modal "Ver CLAS" solo muestra las 25 secciones de primer nivel; no permite explorar qué específicos contiene cada una ni buscar dentro de ellos.

Objetivo: agregar una barra de búsqueda por nombre y por ID del específico en ambos puntos de contacto para que el usuario encuentre rápidamente lo que necesita sin scrollear listas extensas.

## Scope

### In Scope
- `SubcategoryForm`: reemplazar el `<Select>` de específico por un selector con búsqueda en tiempo real (filtra por nombre o ID parcial).
- `ClasificadorInfoNote` (modal "Ver CLAS"): agregar navegación de dos niveles (secciones → específicos) con búsqueda dentro de la lista de específicos de una sección.
- Tests de componente que cubran el filtrado y la selección.

### Out of Scope
- Cambios al formulario de categorías raíz (`CategoryForm`).
- Modificaciones al backend, schema Prisma o API routes.
- Cambios en el archivo fuente `/clasificador.md`.
- Virtualización pesada de listas (se usará `ScrollArea` con límite razonable).

## Capabilities

### Modified Capabilities
- `catalogo`: gestión de subcategorías/específicos CLAS con UX de búsqueda.
- `ui`: visualizador CLAS con capacidad de drill-down y filtrado.

## Approach

- **Filtrado 100 % cliente**: los datos del clasificador ya están cargados en memoria en ambos componentes (`clasClassifierData` en `SubcategoryForm`; se parseará el mismo markdown o se usarán los mapeos existentes en `ClasificadorInfoNote`). No se agregan endpoints nuevos.
- **Patrón consistente**: en ambos lugares se usará un `<Input>` de búsqueda + lista filtrada dentro de `<ScrollArea>`, igual que el filtro de secciones que ya existe en `ClasificadorInfoNote`.
- **Navegación en Ver CLAS**: estado local de dos vistas (`'sections' | 'specifics'`). Click en una sección navega a sus específicos; botón "Volver" regresa a la lista de secciones.

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `src/components/categorias/subcategory-form.tsx` | Modificado | Reemplaza `<Select>` de específico por searchable selector |
| `src/components/productos/clasificador-info-note.tsx` | Modificado | Agrega drill-down a específicos con búsqueda |
| `src/components/categorias/__tests__/subcategory-form.test.ts` | Modificado | Nuevos casos de filtrado y selección de específico |

## Risks

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Lista de específicos muy larga sin virtualización | Media | `ScrollArea` con altura fija; si se nota lag, se puede agregar `max-height` + overflow |
| Navegación confusa en modal móvil | Baja | Botón de volver prominente y título de sección visible |
| Breaking change en tests existentes del Select | Media | Actualizar selectores de test de `role=combobox` a input + lista |

## Rollback Plan

- Revertir `subcategory-form.tsx` al `<Select>` nativo para el campo de específico.
- Revertir `clasificador-info-note.tsx` al modal de solo secciones sin navegación de dos niveles.

## Success Criteria

- [ ] En `SubcategoryForm`, al tipear en el buscador de específico se filtran resultados por nombre o ID parcial.
- [ ] En `SubcategoryForm`, si no hay coincidencias se muestra estado vacío claro.
- [ ] En "Ver CLAS", al hacer click en una sección se muestran sus específicos con ID y nombre.
- [ ] En "Ver CLAS", dentro de la vista de específicos se puede buscar por nombre o ID.
- [ ] En "Ver CLAS", existe un botón para volver a la lista de secciones.
- [ ] Tests unitarios pasan y cubren al menos filtrado por nombre y por ID.
