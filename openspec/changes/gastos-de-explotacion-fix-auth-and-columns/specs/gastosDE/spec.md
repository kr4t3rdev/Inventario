# GastosDE — Fix Auth Bearer y Columnas Concepto/Elemento

## Purpose

Corregir el problema de autenticación en todas las rutas de GastosDE que usan `authResult.success` (propiedad inexistente) causando que los usuarios sean expulsados al login inmediatamente después de abrir el formulario o la página de lista. Además, actualizar la tabla de gastos para mostrar "Concepto de Gasto" y "Elemento de Gasto" en lugar del campo libre "Tipo".

## Root Cause

La función `authenticateUser` retorna:
- **Éxito**: `{ user: AuthenticatedUser }` (sin propiedad `success`)
- **Fallo**: `NextResponse.json({ error, message }, { status: 401 })`

Las rutas de gastosDE usan `if (!authResult.success)` que **siempre es verdadero** porque el objeto de éxito `{ user: {...} }` no tiene la propiedad `success` (`undefined` → `!undefined` → `true`).

El patrón correcto usado en el resto de la aplicación es: `if ('status' in authResult) return authResult as Response`

---

## Fases de Implementación

| Fase | Dominio | Prioridad | Requisitos |
|------|---------|-----------|------------|
| **Fase 1** | Auth Bearer Fix | 🔴 Crítica | FIX-01, FIX-02, FIX-03, FIX-04, FIX-05 |
| **Fase 2** | Columnas Tabla | 🟡 UI | FIX-06, FIX-07 |

---

## ADDED Requirements

---

### FASE 1: AUTH BEARER FIX

---

#### FIX-01: Corregir patrón de autenticación en `/api/gastosDE/route.ts` (GET y POST)

El sistema DEBE usar el patrón correcto `if ('status' in authResult) return authResult` en lugar de `if (!authResult.success)`.

##### Scenario: Usuario autenticado accede a lista de gastos

- GIVEN un usuario con sesión activa y token JWT válido
- WHEN hace GET a `/api/gastosDE` con header `Authorization: Bearer <token>`
- THEN el sistema retorna la lista de gastos normalmente
- AND NO redirige al login

##### Scenario: Usuario sin token es rechazado

- GIVEN un request sin header Authorization
- WHEN hace GET a `/api/gastosDE`
- THEN el sistema retorna HTTP 401 con `{ error: 'Token no proporcionado' }`

##### Scenario: Usuario autenticado crea un gasto

- GIVEN un usuario con token JWT válido
- WHEN hace POST a `/api/gastosDE` con datos válidos
- THEN el sistema crea el registro correctamente
- AND retorna HTTP 201

---

#### FIX-02: Corregir patrón de autenticación en `/api/gastosDE/[id]/route.ts` (GET, PATCH, DELETE)

El sistema DEBE usar el patrón correcto de verificación de auth en las tres rutas.

##### Scenario: Usuario autenticado obtiene un gasto por ID

- GIVEN un usuario con token JWT válido
- WHEN hace GET a `/api/gastosDE/[id]`
- THEN el sistema retorna el gasto solicitado

##### Scenario: Usuario autenticado actualiza un gasto

- GIVEN un usuario con token JWT válido
- WHEN hace PATCH a `/api/gastosDE/[id]` con datos válidos
- THEN el sistema actualiza el registro correctamente

##### Scenario: Usuario autenticado elimina un gasto sin reconciliaciones

- GIVEN un usuario con token JWT válido
- WHEN hace DELETE a `/api/gastosDE/[id]` de un gasto sin reconciliaciones
- THEN el sistema elimina el registro correctamente

---

#### FIX-03: Corregir patrón de autenticación en `/api/gastosDE/conceptos/route.ts` (GET y POST)

El sistema DEBE usar el patrón correcto de verificación de auth.

##### Scenario: Usuario autenticado lista conceptos

- GIVEN un usuario con token JWT válido
- WHEN hace GET a `/api/gastosDE/conceptos`
- THEN el sistema retorna la lista de conceptos con sus elementos

---

#### FIX-04: Corregir patrón de autenticación en `/api/gastosDE/conceptos/[conceptoId]/route.ts` (GET, PATCH, DELETE)

El sistema DEBE usar el patrón correcto de verificación de auth en las tres rutas.

---

#### FIX-05: Corregir patrón de autenticación en `/api/gastosDE/conceptos/[conceptoId]/elementos/route.ts` (GET y POST)

El sistema DEBE usar el patrón correcto de verificación de auth.

---

### FASE 2: COLUMNAS TABLA

---

#### FIX-06: Reemplazar columna "Tipo" por "Concepto de Gasto" en tabla de lista

El sistema DEBE mostrar la columna "Concepto de Gasto" en lugar de "Tipo" en la tabla de `/busy/gastosDE`.

##### Scenario: Ver concepto de gasto en la tabla

- GIVEN existen gastos con concepto y elemento asignados
- WHEN el usuario navega a `/busy/gastosDE`
- THEN la tabla muestra columna "Concepto de Gasto" con `gasto.concepto.nombre`
- AND los gastos sin concepto muestran "Sin concepto" o el valor de `tipo` como fallback

##### Scenario: Filtro por concepto de gasto

- GIVEN existen gastos con distintos conceptos
- WHEN el usuario filtra por concepto "Mantenimiento"
- THEN la tabla muestra solo gastos con ese concepto

---

#### FIX-07: Agregar columna "Elemento de Gasto" en tabla de lista

El sistema DEBE agregar la columna "Elemento de Gasto" en la tabla de `/busy/gastosDE`.

##### Scenario: Ver elemento de gasto en la tabla

- GIVEN existen gastos con elemento asignado
- WHEN el usuario navega a `/busy/gastosDE`
- THEN la tabla muestra columna "Elemento de Gasto" con `gasto.elemento.nombre`
- AND los gastos sin elemento muestran "—" como placeholder

---

## MODIFIED Requirements

### Requirement: Formulario GastoDE — Submit con auth _(modificado)_

El formulario `GastoDEForm` DEBE enviar el token JWT en el header `Authorization` via RTK Query.

(Anteriormente: El token se envía correctamente pero la API lo rechazaba por el bug en `authResult.success`.)

##### Scenario: Submit exitoso del formulario

- GIVEN un usuario autenticado en el formulario de nuevo gasto
- WHEN completa los campos y pulsa "Registrar Gasto"
- THEN el sistema envía el request con el bearer token
- AND la API acepta la autenticación
- AND el gasto se crea correctamente

---

### Requirement: Orden de columnas en tabla de GastosDE _(modificado)_

La tabla DEBE mostrar las columnas en este orden:
1. Checkbox (selección)
2. Concepto de Gasto
3. Elemento de Gasto
4. Proveedor
5. Descripción
6. Nº Factura
7. Monto
8. Período
9. Fecha de creación
10. Acciones

(Anteriormente: incluía "Tipo" en lugar de Concepto/Elemento.)

---

## Data Model — Sin cambios

No se requieren cambios en el modelo de datos. Los campos `conceptoId`, `elementoId`, y `tipo` ya existen en `GastosDE`.

---

## Coverage

| Área | Escenarios Cubiertos |
|------|---------------------|
| Auth Bearer | 5 rutas × 2-3 métodos = ~13 scenarios de autenticación |
| Columnas Tabla | Display, fallback, placeholder |

---

## Next Step

Ready for task creation and implementation.
