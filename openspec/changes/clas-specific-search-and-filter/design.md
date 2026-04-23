# Design: Búsqueda y filtrado de específicos CLAS

**Status**: Design Phase  
**Last Updated**: 2026-04-23  
**Author**: SDD Workflow

## Technical Approach

La implementación se limita a dos componentes React con estado local. No se agregan dependencias nuevas ni endpoints backend. Se reutiliza el patrón de filtrado ya existente en `ClasificadorInfoNote` (input + `useMemo` + lista renderizada dentro de `ScrollArea`).

### En `SubcategoryForm`

El `<Select>` nativo del campo "Específico (subcategoría)" se reemplaza por un componente compuesto:
- Un `<Input>` que actúa como trigger + campo de búsqueda (estilo "searchable select").
- Un contenedor desplegable (usando `Popover` ya disponible en el proyecto) que muestra la lista filtrada.
- Cada ítem de la lista muestra: `<span className="font-mono">{specific.id}</span> <span>{specific.name}</span>`.
- El estado de búsqueda (`specificSearch`) se resetea cuando cambia `clasSectionId`.

### En `ClasificadorInfoNote`

Se introduce navegación de dos niveles dentro del mismo `Dialog`:
- Estado `view: 'sections' | 'specifics'`.
- Estado `selectedSectionId: string | null`.
- Al hacer click en una fila de la tabla de secciones, se asigna `selectedSectionId` y `view = 'specifics'`.
- En vista `specifics`, el encabezado del `DialogTitle` cambia a `"Clasificador CLAS — Específicos de {sectionName}"`.
- Se renderiza una tabla con columnas `ID` y `Nombre` para los específicos de la sección seleccionada.
- Se reutiliza el mismo `<Input>` de búsqueda pero aplicado al array de específicos de la sección.
- Se agrega un `<Button variant="ghost" size="sm">` con ícono de flecha atrás para volver a `view = 'sections'`.

## Architecture Decisions

### Decision: Filtrado 100 % cliente
**Choice**: usar `useMemo` sobre arrays existentes (`availableSpecifics` en `SubcategoryForm`; datos parseados del markdown en `ClasificadorInfoNote`).  
**Alternatives considered**: agregar endpoint `/api/clasificador?sectionId=&q=`; usar fuzzy search library.  
**Rationale**: los datos ya están en memoria en ambos contextos. El clasificador completo pesa menos de 100 KB. Agregar un endpoint aumentaría latencia sin beneficio real.

### Decision: Input + lista filtrada en lugar de `cmdk`
**Choice**: implementar con `<Input>` + `<ScrollArea>` + lista renderizada manualmente.  
**Alternatives considered**: instalar shadcn/ui `Command` (basado en `cmdk`).  
**Rationale**: el proyecto ya tiene este patrón funcionando para secciones en `ClasificadorInfoNote`. Mantener consistencia visual y evitar agregar una nueva dependencia (`cmdk`) al bundle.

### Decision: Popover para el selector de específico en `SubcategoryForm`
**Choice**: usar `<Popover>` de Radix (ya en el proyecto) como contenedor del dropdown.  
**Alternatives considered**: `<Select>` nativo con `Command`; `<datalist>`.  
**Rationale**: `Popover` da control total sobre el contenido del panel desplegable y es el patrón estándar en shadcn para "comboboxes".

### Decision: Mantener Select nativo para la sección
**Choice**: no modificar el selector de sección en `SubcategoryForm`.  
**Alternatives considered**: hacerlo searchable también.  
**Rationale**: son solo 25 secciones; el problema de UX es con los específicos, que pueden ser cientos. No justifica el cambio.

## Data Flow

### SubcategoryForm — searchable specific
```text
user types in specific search input
  -> specificSearch state updates
  -> useMemo filters availableSpecifics by name/ID partial match
  -> filtered list renders inside Popover > ScrollArea
  -> user clicks an item
     -> form.setValue('clasSpecificId', item.id)
     -> form.setValue('nombre', item.name)
     -> popover closes
```

### ClasificadorInfoNote — drill-down
```text
user opens "Ver CLAS"
  -> Dialog renders sections table with existing search
  -> user clicks a section row
     -> selectedSectionId = section.codigo
     -> view = 'specifics'
     -> fetch/pick specifics for that section from parsed classifier data
  -> user types in specific search
     -> specificSearch state updates
     -> useMemo filters section-specifics by name/ID
  -> user clicks "Volver a secciones"
     -> view = 'sections'
     -> selectedSectionId = null
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/categorias/subcategory-form.tsx` | Modify | Reemplazar `<Select>` de específico por searchable selector con `Popover` + `Input` + `ScrollArea`. Resetear búsqueda al cambiar sección. |
| `src/components/productos/clasificador-info-note.tsx` | Modify | Agregar navegación `sections` → `specifics`. Agregar tabla de específicos con búsqueda. Agregar botón volver. |
| `src/lib/clas-classifier.ts` | Read-only (potentially minor) | `getSpecificsForSection` ya existe y se reutiliza. |
| `src/components/categorias/__tests__/subcategory-form.test.ts` | Modify | Agregar tests de filtrado por nombre/ID, selección y estado vacío. |

## Interfaces / Contracts

No hay contratos API nuevos. Los tipos relevantes ya existen:

```ts
interface CLASSpecific {
  id: string;
  name: string;
  sectionId: string;
}
```

Estado local adicional en `SubcategoryForm`:
```ts
const [specificSearch, setSpecificSearch] = useState('');
const [specificPopoverOpen, setSpecificPopoverOpen] = useState(false);
```

Estado local adicional en `ClasificadorInfoNote`:
```ts
type ClasView = 'sections' | 'specifics';
const [view, setView] = useState<ClasView>('sections');
const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
const [specificSearch, setSpecificSearch] = useState('');
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | helper de filtrado de específicos | Vitest: dado array de `CLASSpecific`, debe filtrar por nombre parcial e ID parcial |
| Component | interacción de búsqueda en `SubcategoryForm` | Testing Library: tipear en input de específico, verificar que solo resultados coincidentes aparecen; click en resultado actualiza form |
| Component | navegación y búsqueda en `ClasificadorInfoNote` | Testing Library: abrir modal, click en sección, verificar tabla de específicos; tipear búsqueda y verificar filtrado; click en volver |

## Migration / Rollout

Sin migración de datos. Es un cambio puramente de UI. Los usuarios verán inmediatamente el nuevo selector y el modal ampliado en su próxima interacción.

## Open Questions

- [ ] ¿Se quiere que el selector de específico en `SubcategoryForm` también permita crear un específico "custom" si no se encuentra en la búsqueda? (Asumo que no; en modo EAN-13 todo debe venir del clasificador oficial.)
