# Compras Servicios: Migración a Server Actions

## Purpose

Eliminar las dependencias de RTK Query en los componentes del feature `servicios` que 
consumen `comprasServiciosApi`, migrándolos a las Server Actions que ya existen en 
`features/compras-servicios/actions.ts`.

## Requirements

### Requirement: Tabla de servicios recibidos usa Server Action

El componente `ServiciosRecibidosTable` en `features/servicios/components/servicios-recibidos-table.tsx`
**MUST** usar `getComprasServiciosAction` en lugar de `useGetComprasServiciosQuery`.

#### Scenario: Carga inicial de servicios recibidos

- GIVEN el componente se monta
- WHEN se llama a `getComprasServiciosAction()`
- THEN se obtiene la lista de compras de servicios del tenant
- AND se renderizan en la tabla con columnas: servicio, proveedor, costo, cantidad, total, estado
- AND se muestra loading skeleton mientras carga

#### Scenario: Lista vacía

- GIVEN el tenant no tiene compras de servicios
- WHEN `getComprasServiciosAction()` retorna array vacío
- THEN se muestra un estado empty ("No hay servicios recibidos")

#### Scenario: Error al cargar

- GIVEN un error de red o del servidor
- WHEN `getComprasServiciosAction()` falla
- THEN se muestra un estado de error con mensaje descriptivo

---

### Requirement: Formulario de servicio recibido usa Server Action

El componente `ServiciosRecibidosForm` en `features/servicios/components/servicios-recibidos-form.tsx`
**MUST** usar `createCompraServicioAction` en lugar de `useCreateCompraServicioMutation`.

#### Scenario: Creación exitosa de servicio recibido

- GIVEN el formulario con servicio, proveedor, costo unitario, cantidad
- WHEN el usuario hace submit
- THEN se llama a `createCompraServicioAction(payload)`
- AND si `result.success === true`, se muestra toast de éxito
- AND se cierra el diálogo/formulario (si `onSuccess` callback)

#### Scenario: Error de validación

- GIVEN el formulario con datos inválidos (sin servicio seleccionado)
- WHEN el usuario hace submit
- THEN `createCompraServicioAction` retorna `{ success: false, error: { message: "..." } }`
- AND se muestra el error en un toast
- AND el formulario NO se cierra

#### Scenario: Servicio recibido con anticipo

- GIVEN el formulario incluye `anticipos[]` con al menos un anticipo
- WHEN el usuario hace submit
- THEN `createCompraServicioAction` procesa la alocación de anticipos
- AND si es exitoso, se muestra toast de éxito

---

### Requirement: Eliminación de comprasServiciosApi.ts

Una vez que ningún componente importe hooks de `comprasServiciosApi`, el archivo
**MUST** ser eliminado. El barrel `features/compras-servicios/index.ts` **MUST**
solo exportar Server Actions y types.

#### Scenario: Barrel limpio post-migración

- GIVEN todos los hooks RTKQ migrados a Server Actions
- AND `grep` confirma 0 imports de `comprasServiciosApi` fuera del archivo mismo
- WHEN se elimina `comprasServiciosApi.ts`
- THEN el barrel exporta solo:
  - `getComprasServiciosAction`, `getCompraServicioByIdAction`, `createCompraServicioAction`, `updateCompraServicioAction`, `deleteCompraServicioAction`
  - `CompraServicio` (type)
- AND typecheck pasa sin errores
