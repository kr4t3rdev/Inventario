# Design: Selectores dependientes de categorías CLAS en modo EAN-13

## Technical Approach

La solución se apoya en una UI guiada por jerarquía CLAS y en validación defensiva cliente/servidor.

1. Cliente: con `usaCodigoEan13=true`, el formulario deja de usar entrada libre para el nombre CLAS y muestra dos selects. El primero representa la categoría o sección oficial; el segundo muestra solo las subcategorías o específicos compatibles con esa primera selección.
2. Cliente: al cambiar el valor del primer select, el segundo se recalcula y limpia cualquier opción previa que ya no pertenezca a esa rama del clasificador.
3. Fuente de verdad: el clasificador oficial vive en `public/clasificador.md` y se parsea en `src/lib/clas-classifier.ts` para obtener secciones, específicos y relaciones sección/específico.
4. Servidor: `CategoriaValidator.validateCategoryCreation` y `validateCategoryUpdate` consultan `MiEmpresa.usaCodigoEan13`. Si está activo, validan que la combinación categoría/subcategoría recibida pertenezca al mismo camino CLAS. Esto evita inconsistencias por llamadas directas a la API o por futuros cambios de UI.

## Architecture Decisions

### Decision: Derivar ambos selects desde category-mapping

**Choice**: usar `public/clasificador.md` como fuente única y un parser compartido para construir el primer selector y resolver las opciones dependientes del segundo.
**Rationale**: el clasificador oficial ya es la fuente de verdad para EAN-13 y evita lógica duplicada en UI y backend.

### Decision: Guardar ambos valores seleccionados

**Choice**: cuando el usuario confirme una opción válida del segundo selector, el formulario guarda la categoría y la subcategoría correspondientes.
**Rationale**: el flujo pedido no solo valida la rama CLAS, también necesita persistir ambas referencias para que catálogo y generación EAN-13 queden consistentes.

### Decision: Separar el alta de subcategorías en un formulario basado en jerarquía existente

**Choice**: el formulario dedicado de subcategorías usa categorías ya existentes como punto de partida, y filtra las subcategorías disponibles a partir de esa selección.
**Rationale**: así se evita crear una subcategoría sin padre y se reutiliza la jerarquía real almacenada en la base de datos en lugar de inventar una rama nueva desde CLAS.

### Decision: Toast exacto en cliente, error estructurado en backend

**Choice**: el cliente muestra el texto exacto exigido por negocio; el backend devuelve validación consistente pero no queda a cargo del copy UX principal.
**Rationale**: el requerimiento es explícitamente de UX temprana, pero sin perder defensa en profundidad.

## Data Flow

`CategoryForm` carga `usaEan13` desde `/api/mi-empresa`.

Cuando el usuario envía:
- Si `usaEan13` es `false`, el flujo actual sigue intacto.
- Si `usaEan13` es `true`, el primer select muestra secciones o categorías oficiales.
- Al seleccionar una opción en el primer select, el formulario calcula las opciones válidas del segundo select y elimina cualquier selección anterior incompatible.
- Al seleccionar una opción en el segundo select, el formulario completa el par categoría/subcategoría que se enviará al backend.
- Si la combinación no corresponde al clasificador, dispara toast y no hace `fetch`.
- Si pasa, continúa la validación remota existente y luego el create/update con ambos valores.
- El formulario dedicado de subcategorías no permite enviar sin una categoría padre existente seleccionada; usa `SubcategorySelector` para navegar la jerarquía ya almacenada.

En backend:
- API de categorías llama `CategoriaValidator`.
- `CategoriaValidator` consulta `prisma.miEmpresa.findUnique({ where: { id: 1 } })`.
- Sólo con `usaCodigoEan13=true` ejecuta validación de la pareja categoría/subcategoría contra CLAS.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/use-category-form.ts` | Modify | Resolver el estado derivado del primer y segundo select y enviar ambos valores |
| `src/components/categorias/category-form.tsx` | Modify | Reemplazar el input libre por dos selects dependientes en modo EAN-13 |
| `src/lib/clas-classifier.ts` | Modify | Parsear el clasificador oficial y exponer helpers para secciones, específicos y relaciones |
| `src/lib/clas-classifier.server.ts` | Add | Cargar y cachear el clasificador oficial en backend |
| `public/clasificador.md` | Read | Fuente de verdad de secciones y específicos |
| `src/lib/categoria-validation.ts` | Modify | Agregar validación condicional de CLAS para create/update de ambos valores |
| `src/lib/categoria-errors.ts` | Modify | Incorporar error estructurado si hace falta un código/mensaje específico |
| `src/components/categorias/subcategory-hierarchy-form.tsx` | Add | Crear un formulario de subcategorías basado en categorías ya existentes y su jerarquía |
| `src/components/categorias/subcategory-selector.tsx` | Read | Reutilizar el selector jerárquico existente para no permitir padres inexistentes |

## Testing Strategy

- Unit: pruebas para helpers que derivan las opciones del segundo select desde la categoría o sección elegida.
- Unit: pruebas para la validación EAN-13 en `categoria-validation.ts` con modo ON/OFF y combinaciones inválidas.
- Component/hook: prueba de refresco del segundo select, persistencia de ambos valores y verificación de los toasts esperados.
- Verification: lint del hook/form y test focalizado del validador.