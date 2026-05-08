# Server Actions Infrastructure Specification

## Purpose

Define el comportamiento de las utilidades compartidas para Server Actions en Next.js 15+, incluyendo manejo de errores, revalidación de cache y tipos estándar de respuesta.

## Requirements

### Requirement: Action Wrapper

El sistema **DEBE** proveer un wrapper `withAction()` que envuelva cualquier Server Action y estandarice su respuesta.

#### Scenario: Action exitosa

- GIVEN una función async que retorna datos
- WHEN se envuelve con `withAction()` y se ejecuta
- THEN la respuesta **DEBE** tener el formato `{ success: true, data: T }`

#### Scenario: Action con error

- GIVEN una función async que lanza una excepción
- WHEN se envuelve con `withAction()` y se ejecuta
- THEN la respuesta **DEBE** tener el formato `{ success: false, error: { message: string, code?: string } }`
- AND el error **NO DEBE** propagarse al cliente como excepción no controlada

#### Scenario: Action con error de validación Zod

- GIVEN una función que usa Zod para validar input
- WHEN el input no pasa la validación
- THEN la respuesta **DEBE** incluir los errores de campo en `error.details`
- AND el formato **DEBE** ser compatible con React Hook Form

### Requirement: Revalidación de Cache

El sistema **DEBE** proveer utilidades para revalidar rutas y tags de cache después de mutaciones.

#### Scenario: Revalidación de ruta

- GIVEN una Server Action que modifica datos
- WHEN la acción completa exitosamente
- THEN el sistema **DEBE** llamar `revalidatePath()` para la ruta afectada
- AND el usuario **DEBE** ver los datos actualizados sin refrescar manualmente

#### Scenario: Revalidación de tag

- GIVEN una Server Action que afecta múltiples rutas
- WHEN la acción completa exitosamente
- THEN el sistema **DEBE** llamar `revalidateTag()` con el tag correspondiente
- AND todas las rutas con ese tag **DEBEN** refrescarse

### Requirement: Autorización en Server Actions

El sistema **DEBE** verificar autenticación y autorización dentro de cada Server Action.

#### Scenario: Usuario no autenticado

- GIVEN un usuario sin sesión activa
- WHEN intenta ejecutar una Server Action protegida
- THEN la acción **DEBE** retornar `{ success: false, error: { message: "Unauthorized", code: "AUTH_REQUIRED" } }`
- AND **NO DEBE** ejecutar la lógica de negocio

#### Scenario: Tenant isolation

- GIVEN un usuario autenticado con tenantId
- WHEN ejecuta una Server Action
- THEN la acción **DEBE** filtrar todas las queries de Prisma por `tenantId`
- AND **NO DEBE** retornar datos de otros tenants

## Types

```typescript
interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: Record<string, string[]>;
  };
}

type ActionFunction<TInput, TOutput> = (
  input: TInput
) => Promise<ActionResponse<TOutput>>;
```
