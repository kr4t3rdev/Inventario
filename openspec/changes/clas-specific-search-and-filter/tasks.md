# Tasks: Búsqueda y filtrado de específicos CLAS

**Status**: Task Breakdown  
**Last Updated**: 2026-04-23  
**Change**: `clas-specific-search-and-filter`

## Task 1: Implementar searchable specific selector en `SubcategoryForm` ✅

**Goal**: Reemplazar el `<Select>` nativo del campo "Específico (subcategoría)" por un componente con búsqueda.

**Files**: `src/components/categorias/subcategory-form.tsx`

**Steps**:
1. Agregar estados locales:
   - `const [specificSearch, setSpecificSearch] = useState('');`
   - `const [specificOpen, setSpecificOpen] = useState(false);`
2. Crear `filteredSpecifics` con `useMemo` que filtre `availableSpecifics` por nombre o ID parcial (case-insensitive, trim).
3. Reemplazar el bloque `<Select>` de específico por:
   - `<Popover open={specificOpen} onOpenChange={setSpecificOpen}>`
   - `<PopoverTrigger asChild>` con un `<Button variant="outline">` que muestre el específico seleccionado o placeholder.
   - `<PopoverContent>` con:
     - `<Input placeholder="Buscar específico por nombre o ID…" value={specificSearch} onChange={…} />`
     - `<ScrollArea className="h-60">`
     - Lista de `filteredSpecifics` mapeados a botones/filas clickeables.
     - Cada fila muestra: `<span className="font-mono text-xs">{sp.id}</span> <span>{sp.name}</span>`
     - Estado vacío cuando `filteredSpecifics.length === 0`.
4. Al hacer click en un específico:
   - `form.setValue('clasSpecificId', sp.id)`
   - `form.setValue('nombre', sp.name)`
   - `form.setValue('clasSectionId', sp.sectionId)` (o mantener la sección actual)
   - `setSpecificOpen(false)`
5. En el `useEffect` o `onValueChange` de sección, limpiar `specificSearch` y resetear el específico seleccionado.
6. Asegurar que `disabled` del trigger respete `isLoading || !clasSectionId`.

**Acceptance**:
- [ ] El campo de específico renderiza un input-trigger que abre un panel desplegable.
- [ ] Tipear en el input filtra los específicos por nombre o ID.
- [ ] Seleccionar un específico cierra el panel y actualiza el form.
- [ ] Cambiar de sección limpia la búsqueda y el valor seleccionado.

---

## Task 2: Ampliar modal "Ver CLAS" con vista de específicos por sección ✅

**Goal**: Permitir al usuario navegar desde la lista de secciones hasta los específicos de una sección, con búsqueda.

**Files**: `src/components/productos/clasificador-info-note.tsx`

**Steps**:
1. Agregar estados locales:
   - `type View = 'sections' | 'specifics'`
   - `const [view, setView] = useState<View>('sections');`
   - `const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);`
   - `const [specificSearch, setSpecificSearch] = useState('');`
2. Importar `parseClasClassifierMarkdown` (o usar `CLAS_SPECIFICS` + lógica de agrupación por sección) para obtener los específicos agrupados por `sectionId`. Nota: como `ClasificadorInfoNote` no carga el markdown hoy, la opción más simple es importar `CLAS_SPECIFICS` y `CATEGORY_TO_SECTION` desde `clas-classifier.ts` / `category-mapping.ts` y reconstruir la relación section→specifics, O hacer un `fetch('/clasificador.md')` al abrir el modal (consistente con `SubcategoryForm`). Recomendado: fetch al abrir para no duplicar datos.
3. Modificar la tabla de secciones para que cada fila sea clickeable (`cursor-pointer` + `onClick={() => { setSelectedSectionId(seccion.codigo); setView('specifics'); setSpecificSearch(''); }}`).
4. Crear render condicional:
   - Si `view === 'sections'`: mostrar tabla de secciones existente (con su búsqueda actual).
   - Si `view === 'specifics'`:
     - Mostrar `<Button variant="ghost" size="sm" onClick={() => setView('sections')}>` con ícono de flecha atrás y texto "Volver a secciones".
     - Mostrar `<DialogTitle>` actualizado con el nombre de la sección seleccionada.
     - Mostrar `<Input placeholder="Buscar específico por nombre o ID…" value={specificSearch} onChange={…} />`.
     - Crear `filteredSectionSpecifics` con `useMemo` filtrando los específicos de `selectedSectionId` por nombre o ID.
     - Renderizar tabla con columnas `ID` y `Nombre` dentro de `<ScrollArea className="h-72">`.
     - Estado vacío cuando no hay coincidencias.
5. Al cerrar el modal (`onOpenChange`), resetear `view` a `'sections'` y `selectedSectionId` a `null`.

**Acceptance**:
- [ ] Click en una sección navega a la lista de sus específicos.
- [ ] La vista de específicos muestra ID (monospace) y nombre.
- [ ] El input de búsqueda filtra específicos por nombre o ID.
- [ ] El botón "Volver a secciones" funciona correctamente.
- [ ] Al cerrar y reabrir el modal, se reinicia en la lista de secciones.

---

## Task 3: Agregar tests para búsqueda de específico en `SubcategoryForm` ✅

**Goal**: Cubrir el nuevo comportamiento searchable con tests.

**Files**: `src/components/categorias/__tests__/subcategory-form.test.ts`

**Steps**:
1. Extraer helper puro `filterSpecifics` para testear sin mockear Redux/RHF.
2. Test: término vacío retorna todos los específicos.
3. Test: filtrado por nombre parcial (case-insensitive).
4. Test: filtrado por ID parcial.
5. Test: sin coincidencias retorna array vacío.
6. Test: búsqueda con mixed case funciona.
7. Test: ID substring funciona.
8. Test: trim del término de búsqueda.

**Acceptance**:
- [x] Tests pasan en `pnpm run test:run`.
- [x] Cobertura incluye filtrado por nombre, por ID, estado vacío y selección.

---

## Task 4: QA — lint, typecheck y verificación visual ✅

**Goal**: Asegurar calidad antes de marcar como done.

**Files**: Todos los modificados en Tasks 1–3.

**Steps**:
1. Ejecutar `pnpm run lint` y corregir errores.
2. Ejecutar `pnpm run typecheck` (o equivalente según `package.json`) y corregir errores de tipo.
3. Ejecutar `pnpm run test:run -- src/components/categorias` para correr tests enfocados.
4. Verificación visual manual (si hay entorno dev corriendo).

**Acceptance**:
- [x] `lint` pasa sin errores en archivos tocados.
- [x] `typecheck` no tiene errores en archivos tocados (errores preexistentes en otros módulos).
- [x] Tests enfocados pasan (9/9).
- [ ] (Opcional) Verificación visual confirmada.
