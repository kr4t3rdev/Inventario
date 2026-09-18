# Flujo EAN-13 / CLAS — FinanceMDM

> Documentación del clasificador CLAS, generación de códigos EAN-13 y labels dinámicos.

## Feature Flags

Dos condiciones deben cumplirse para activar el modo EAN-13:

1. **Plan.features** incluye `"categorias-ean13": true`
2. **MiEmpresa.usaCodigoEan13** es `true`

Si el plan no incluye el feature, el modo se desactiva aunque MiEmpresa lo tenga activo.

## CLAS Classifier

### Archivo fuente
`public/clasificador.md` — Markdown con el nomenclador oficial cubano de actividades económicas.

### Parseo
`src/lib/clas-classifier.ts`:
- `parseClasClassifierMarkdown(markdown)` → `CLASClassifierData`
- `getSpecificsForSection(data, sectionId)` → `ClasSpecificOption[]`
- `validateCLASSection(name)` → `sectionId | null`

### Estructura
- **Secciones**: categorías de nivel 1 del clasificador (ej: "Agricultura", "Comercio")
- **Específicos**: subcategorías dentro de una sección (ej: "Panadería", "Tienda")

## Flujo en UI

### Modo Estándar (sin EAN-13)
```
Categoría → Subcategoría
```
Formularios usan "categoría padre" y "subcategoría" con inputs libres.

### Modo CLAS (con EAN-13)
```
Sección CLAS → Específico CLAS
```
- Nombre se autocompleta desde el clasificador
- Sección se selecciona de dropdown con secciones disponibles
- Específico se filtra por sección y se busca por nombre/ID
- Input de nombre es readOnly (se llena automáticamente)

## Dynamic Labels

Helper `getCategoryLabels(usaEan13)` en `src/features/categorias/lib/category-labels.ts`:

```typescript
interface CategoryLabels {
  childTitle: string           // "subcategoría" | "específico CLAS"
  childTitlePlural: string     // "subcategorías" | "específicos CLAS"
  createLabel: string          // "Nueva Subcategoría" | "Nuevo Específico CLAS"
  editLabel: string            // "Editar Subcategoría" | "Editar Específico CLAS"
  namePlaceholder: string
  nameDescription: string
  selectorLabel: string
  selectorPlaceholder: string
  noneOptionLabel: string
  countLabel: (count) => string
  formDescription: string
  createFormTitle: string
  submitLabel: string
}
```

### Componentes afectados

| Componente | Cambio |
|------------|--------|
| `category-form.tsx` | Título dinámico, nombre autocompletado |
| `subcategory-form.tsx` | Labels, placeholders, descripciones dinámicos |
| `subcategory-selector.tsx` | Prop `usaEan13` para labels |
| `categoria-page-client.tsx` | Badge conteo dinámico |
| `use-category-form.ts` | Error messages corregidos |
| `subcategoria-new-page-client.tsx` | Título/descripción dinámicos |

## Tests

- `src/features/categorias/__tests__/actions.test.ts` — 23 tests de Server Actions
- `src/features/categorias/components/category-form.test.tsx` — 2 tests de UI
- `src/features/categorias/components/subcategory-form.test.tsx` — 2 tests de UI
- `src/features/categorias/components/categoria-page-client.test.tsx` — 1 test de UI
- `src/features/categorias/components/subcategoria-new-page-client.test.tsx` — 2 tests de UI
