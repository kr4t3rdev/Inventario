# Spec: Búsqueda y filtrado de específicos CLAS

**Status**: Specification Phase  
**Last Updated**: 2026-04-23  
**Author**: SDD Workflow

## Goal

Definir el comportamiento exacto de búsqueda y filtrado de específicos CLAS en el formulario de subcategorías y en el visualizador oficial (modal Ver CLAS), manteniendo la experiencia consistente y sin agregar dependencias nuevas.

## Scope

### In Scope
1. Selector de específico con búsqueda en `SubcategoryForm`.
2. Modal "Ver CLAS" con navegación de dos niveles (secciones → específicos) y búsqueda en cada nivel.
3. Estados vacíos y de carga (reutilizar los existentes).

### Out of Scope
- Cambios al formulario de categorías raíz.
- Backend: sin endpoints nuevos ni validaciones adicionales.
- Schema Prisma.
- Descarga/exportación de específicos filtrados.

## Requirements

### Requirement 1: Searchable Specific Selector in SubcategoryForm
El sistema **MUST** permitir al usuario buscar un específico por nombre o por ID dentro del selector del formulario de subcategorías.

#### Scenario: Filtrado por nombre parcial
- GIVEN que el usuario seleccionó una sección CLAS válida
- AND el campo de específico tiene foco o está activo
- WHEN el usuario escribe `"leche"`
- THEN el sistema MUST mostrar solo los específicos cuyo nombre contenga `"leche"` (case-insensitive)
- AND MUST renderizar el ID del específico junto al nombre

#### Scenario: Filtrado por ID parcial
- GIVEN que el usuario seleccionó una sección CLAS válida
- WHEN el usuario escribe `"0102"`
- THEN el sistema MUST mostrar solo los específicos cuyo ID contenga `"0102"`

#### Scenario: Sin resultados en búsqueda
- GIVEN que el usuario escribe un término que no coincide con ningún específico
- THEN el sistema MUST mostrar un mensaje de estado vacío (ej. `"Sin resultados"`)
- AND MUST permitir al usuario borrar la búsqueda fácilmente

#### Scenario: Selección de específico filtrado
- GIVEN una lista filtrada de específicos
- WHEN el usuario hace click en uno
- THEN el sistema MUST cerrar el selector y completar el campo con el nombre seleccionado
- AND MUST sincronizar `clasSpecificId` en el formulario

#### Scenario: Cambio de sección limpia estado
- GIVEN que el usuario cambia la sección CLAS seleccionada
- THEN el sistema MUST limpiar la búsqueda actual y el específico seleccionado

### Requirement 2: CLAS Viewer Drill-Down to Specifics
El sistema **MUST** permitir al usuario explorar los específicos de una sección desde el modal "Ver CLAS" y buscar dentro de ellos.

#### Scenario: Navegación a específicos de una sección
- GIVEN que el modal "Ver CLAS" está abierto mostrando la lista de secciones
- WHEN el usuario hace click en una fila de sección
- THEN el sistema MUST navegar a una vista que liste todos los específicos de esa sección
- AND MUST mostrar el nombre de la sección como encabezado

#### Scenario: Visualización de específicos con ID
- GIVEN que el usuario está en la vista de específicos de una sección
- THEN el sistema MUST mostrar una tabla (o lista estructurada) con dos columnas: `ID` y `Nombre`
- AND el ID MUST estar formateado con `font-mono` para legibilidad

#### Scenario: Búsqueda dentro de específicos de una sección
- GIVEN que el usuario está en la vista de específicos de una sección
- WHEN el usuario escribe en el campo de búsqueda
- THEN el sistema MUST filtrar la lista por nombre o ID parcial (case-insensitive)
- AND MUST mantener la misma semántica de búsqueda que en Requirement 1

#### Scenario: Volver a lista de secciones
- GIVEN que el usuario está en la vista de específicos de una sección
- WHEN el usuario hace click en el botón "Volver a secciones"
- THEN el sistema MUST regresar a la lista de secciones
- AND MUST preservar el término de búsqueda previo de secciones si existía

#### Scenario: Modal conserva estado de búsqueda al cerrar/reabrir
- GIVEN que el usuario cerró el modal estando en la vista de específicos
- WHEN el usuario vuelve a abrir "Ver CLAS"
- THEN el sistema SHOULD reiniciar la vista a la lista de secciones (para evitar desorientación)

## Success Criteria

- [ ] El selector de específico en `SubcategoryForm` permite búsqueda por nombre o ID.
- [ ] El selector muestra ID + nombre del específico en cada resultado.
- [ ] Sin resultados muestra mensaje accionable.
- [ ] El modal "Ver CLAS" permite entrar a una sección y ver sus específicos con ID.
- [ ] Dentro de la vista de específicos del modal existe búsqueda funcional.
- [ ] Existe navegación clara para volver a la lista de secciones.
- [ ] Tests cubren filtrado por nombre, por ID, selección y estado vacío.
