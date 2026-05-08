# Categorías - Server Actions Migration Specification

## Purpose

Define el comportamiento de las operaciones CRUD de categorías usando Server Actions, reemplazando las llamadas a API routes y RTK Query.

## Requirements

### Requirement: Listar Categorías (Server Component)

El sistema **DEBE** listar categorías directamente desde el Server Component sin usar API route ni RTK Query.

#### Scenario: Listado exitoso

- GIVEN un usuario autenticado con tenantId
- WHEN carga `/busy/categorias`
- THEN el page.tsx **DEBE** ser un Server Component
- AND **DEBE** ejecutar `prisma.categoria.findMany({ where: { tenantId } })` directamente
- AND **DEBE** pasar los datos al componente hijo como props

#### Scenario: Categorías vacías

- GIVEN un usuario sin categorías creadas
- WHEN carga `/busy/categorias`
- THEN el sistema **DEBE** mostrar un estado vacío
- AND **NO DEBE** mostrar error

### Requirement: Crear Categoría (Server Action)

El sistema **DEBE** proveer una Server Action `createCategoriaAction()` que reemplace el POST a `/api/categorias`.

#### Scenario: Creación exitosa

- GIVEN datos válidos de categoría (nombre, descripción opcional, parentId opcional)
- WHEN se ejecuta `createCategoriaAction(formData)`
- THEN la categoría **DEBE** crearse en la base de datos
- AND la respuesta **DEBE** ser `{ success: true, data: categoria }`
- AND la ruta `/busy/categorias` **DEBE** revalidarse automáticamente

#### Scenario: Nombre duplicado

- GIVEN una categoría con nombre "Electrónica" ya existe
- WHEN se intenta crear otra categoría con nombre "Electrónica"
- THEN la acción **DEBE** retornar `{ success: false, error: { message: "Ya existe una categoría con este nombre", code: "DUPLICATE_NAME" } }`

#### Scenario: Validación de campos

- GIVEN datos de categoría con nombre vacío
- WHEN se ejecuta la Server Action
- THEN la respuesta **DEBE** incluir error de validación en `error.details`
- AND **NO DEBE** crear la categoría

### Requirement: Actualizar Categoría (Server Action)

El sistema **DEBE** proveer una Server Action `updateCategoriaAction()` que reemplace el PUT a `/api/categorias/[id]`.

#### Scenario: Actualización exitosa

- GIVEN una categoría existente con id
- WHEN se ejecuta `updateCategoriaAction({ id, ...data })`
- THEN la categoría **DEBE** actualizarse
- AND la respuesta **DEBE** incluir la categoría actualizada
- AND el formulario **DEBE** mostrar toast de éxito

#### Scenario: Categoría no encontrada

- GIVEN un id de categoría que no existe
- WHEN se intenta actualizar
- THEN la acción **DEBE** retornar error 404
- AND **NO DEBE** modificar otros datos

### Requirement: Eliminar Categoría (Server Action)

El sistema **DEBE** proveer una Server Action `deleteCategoriaAction()` que reemplace el DELETE a `/api/categorias/[id]`.

#### Scenario: Eliminación exitosa

- GIVEN una categoría sin subcategorías ni productos asociados
- WHEN se ejecuta `deleteCategoriaAction(id)`
- THEN la categoría **DEBE** eliminarse
- AND la lista **DEBE** actualizarse sin refrescar la página

#### Scenario: Categoría con dependencias

- GIVEN una categoría con productos asociados
- WHEN se intenta eliminar
- THEN la acción **DEBE** retornar error indicando dependencias
- AND **NO DEBE** eliminar la categoría

## Data Flow

```
page.tsx (Server Component)
  ↓ await prisma.categoria.findMany()
  ↓ props
CategoryList.tsx (Server Component)
  ↓ onCreate → createCategoriaAction()
CategoryForm.tsx (Client Component)
  ↓ useTransition() + startTransition()
  ↓ revalidatePath('/busy/categorias')
```
