# Gastos de Explotación — Mejoras Críticas y Taxonomía de Conceptos

## Purpose

Abordar las vulnerabilidades críticas detectadas en el sistema de Gastos de Explotación (GastosDE) e implementar un sistema de taxonomía con **Conceptos de Gastos** y **Elementos** (subcategorías de cada concepto). Las mejoras se organizan en fases de implementación por nivel de criticidad: Seguridad, Modelo de Datos, UX y Calidad de Código.

---

## Fases de Implementación

| Fase | Dominio | Prioridad | Requisitos |
|------|---------|-----------|------------|
| **Fase 1** | Seguridad | 🔴 Crítica | ADDED-01, ADDED-02 |
| **Fase 2** | Modelo de Datos | 🟠 Alta | ADDED-03, ADDED-04, ADDED-05, ADDED-06 |
| **Fase 3** | Calidad de Código | 🟡 Media | ADDED-07, ADDED-08, ADDED-09 |
| **Fase 4** | UX | 🟢 Mejora | ADDED-10, ADDED-11, ADDED-12 |
| **Fase 5** | Taxonomía Conceptos/Elementos | 🔵 Nuevo | ADDED-13, ADDED-14, ADDED-15, ADDED-16, ADDED-17, ADDED-18 |

---

## ADDED Requirements

---

### FASE 1: SEGURIDAD

---

#### ADDED-01: Autenticación en Rutas CRUD de GastosDE

El sistema DEBE proteger todas las rutas `/api/gastosDE` con middleware de autenticación `authenticateUser`.

Actualmente las rutas GET, POST, PATCH y DELETE no requieren autenticación, permitiendo que cualquier usuario no autenticado cree, modifique o elimine registros de gastos.

##### Scenario: Acceso sin autenticación es rechazado

- GIVEN un usuario no autenticado
- WHEN intenta hacer GET, POST, PATCH o DELETE a `/api/gastosDE`
- THEN el sistema retorna HTTP 401 "No autorizado"
- AND la operación NO se ejecuta

##### Scenario: Usuario autenticado accede normalmente

- GIVEN un usuario con token JWT válido
- WHEN hace GET a `/api/gastosDE`
- THEN el sistema retorna la lista de gastos normalmente

##### Scenario: Usuario autenticado crea un gasto

- GIVEN un usuario con token JWT válido
- WHEN hace POST a `/api/gastosDE` con datos válidos
- THEN el sistema crea el registro correctamente
- AND retorna HTTP 201 con el nuevo registro

---

#### ADDED-02: Autorización para Eliminación de GastosDE

El sistema DEBE verificar que el gasto NO tenga registros de reconciliación asociados antes de permitir su eliminación.

##### Scenario: Eliminación con reconciliaciones asociadas es bloqueada

- GIVEN un gasto DE que tiene registros en `ReconciliacionGasto`
- WHEN un usuario intenta eliminarlo
- THEN el sistema retorna HTTP 400 con error "No se puede eliminar un gasto que tiene reconciliaciones asociadas"
- AND el registro NO es eliminado

##### Scenario: Eliminación sin reconciliaciones es permitida

- GIVEN un gasto DE sin registros en `ReconciliacionGasto`
- WHEN un usuario intenta eliminarlo
- THEN el sistema elimina el registro correctamente
- AND retorna mensaje de éxito

---

### FASE 2: MODELO DE DATOS

---

#### ADDED-03: Campo `monto` como Decimal

El sistema DEBE cambiar el tipo de dato del campo `monto` de `Int` a `Decimal` en el modelo Prisma `GastosDE`.

Actualmente `monto` es `Int`, lo que trunca decimales. El formulario acepta `step="0.01"` pero la base de datos no puede almacenar centavos.

##### Scenario: Crear gasto con monto decimal

- GIVEN un usuario creando un gasto DE con monto `1234.56`
- WHEN el registro se guarda en la base de datos
- THEN el campo `monto` almacena exactamente `1234.56`
- AND NO trunca a `1234`

##### Scenario: Editar gasto con monto decimal

- GIVEN un gasto DE existente con monto `500.00`
- WHEN el usuario lo edita a `500.75`
- THEN el sistema actualiza correctamente el valor decimal
- AND la consulta retorna `500.75`

##### Scenario: Migración de datos existentes

- GIVEN registros existentes con `monto` como `Int`
- WHEN se ejecuta la migración de Prisma
- THEN el sistema convierte `Int` a `Decimal` sin pérdida de datos
- AND los valores enteros se mantienen (ej. `500` → `500.00`)

---

#### ADDED-04: Campo `isPagado` como Enum

El sistema DEBE cambiar el tipo de `isPagado` de `String?` a un tipo enumerado con valores: `'pendiente' | 'pagado' | 'parcial'`.

##### Scenario: Nuevo gasto tiene estado pendiente por defecto

- GIVEN se crea un nuevo gasto DE
- WHEN no se especifica `isPagado`
- THEN el sistema asigna `'pendiente'` por defecto

##### Scenario: Reconciliación cambia estado a pagado

- GIVEN un gasto DE con `isPagado = 'pendiente'`
- WHEN se completa la reconciliación de pago
- THEN el sistema actualiza `isPagado` a `'pagado'`

##### Scenario: Migración de valores string existentes

- GIVEN registros con `isPagado = 'pagado'` o `null`
- WHEN se ejecuta la migración
- THEN `'pagado'` se mapea a `'pagado'`
- AND `null` se mapea a `'pendiente'`

---

#### ADDED-05: Período Seleccionable por Usuario

El sistema DEBE permitir al usuario seleccionar o especificar el período (`YYYY-MM`) al crear un gasto DE, en lugar de generarlo automáticamente solo con el mes actual.

##### Scenario: Usuario selecciona período pasado

- GIVEN un usuario creando un gasto de diciembre 2025 en enero 2026
- WHEN selecciona período `2025-12`
- THEN el sistema guarda el gasto con `periodo = '2025-12'`

##### Scenario: Período por defecto es mes actual

- GIVEN un usuario creando un gasto sin especificar período
- WHEN envía el formulario
- THEN el sistema asigna el período del mes actual (`YYYY-MM`)

##### Scenario: Validación de formato de período

- GIVEN un usuario ingresa período con formato inválido `2025/12`
- WHEN intenta enviar el formulario
- THEN el sistema muestra error "El período debe tener formato YYYY-MM"

---

#### ADDED-06: Número de Factura en Vista de Lista

El sistema DEBE mostrar la columna `numeroFactura` en la tabla de lista de gastos DE.

##### Scenario: Ver número de factura en la tabla

- GIVEN existen gastos DE con y sin número de factura
- WHEN el usuario navega a `/busy/gastosDE`
- THEN la tabla muestra columna "Nº Factura"
- AND los registros sin factura muestran "Sin factura"

---

### FASE 3: CALIDAD DE CÓDIGO

---

#### ADDED-07: Validación Zod en Rutas de API

El sistema DEBE validar los datos de entrada de las rutas POST y PATCH de `/api/gastosDE` con el mismo schema Zod que usa el formulario frontend.

##### Scenario: POST con datos inválidos es rechazado

- GIVEN un request POST con `monto = -100`
- WHEN la API valida los datos
- THEN retorna HTTP 400 con error "El monto debe ser mayor a 0"
- AND NO crea el registro

##### Scenario: POST sin campos requeridos es rechazado

- GIVEN un request POST sin `proveedor`
- WHEN la API valida los datos
- THEN retorna HTTP 400 con error "El proveedor es requerido"

##### Scenario: PATCH con datos válidos es aceptado

- GIVEN un request PATCH con solo `monto` actualizado
- WHEN la API valida los datos
- THEN actualiza solo el campo `monto`
- AND retorna HTTP 200 con el registro actualizado

---

#### ADDED-08: Normalización de Nombrado

El sistema DEBE usar nomenclatura consistente: "Gastos de Explotación" en toda la interfaz de usuario, API y mensajes de error.

##### Scenario: Mensajes de error de API

- GIVEN un error de validación en la API
- WHEN retorna el mensaje
- THEN usa "Gasto de Explotación" en vez de "Gasto Derivados Empresa"

##### Scenario: Nombres de componentes

- GIVEN los archivos de componentes
- THEN el formulario se llama `GastosDEForm` (plural, consistente con API)

---

#### ADDED-09: Pruebas Unitarias para Rutas de API

El sistema DEBE incluir pruebas unitarias para todas las rutas `/api/gastosDE` cubriendo: creación exitosa, validaciones, actualización, eliminación y autenticación.

##### Scenario: Prueba de creación exitosa

- GIVEN datos válidos de gasto DE
- WHEN se llama POST `/api/gastosDE`
- THEN el test verifica que se creó el registro
- AND la respuesta contiene los datos correctos

##### Scenario: Prueba de eliminación con reconciliaciones

- GIVEN un gasto con reconciliaciones asociadas
- WHEN se llama DELETE `/api/gastosDE/[id]`
- THEN el test verifica HTTP 400
- AND el registro NO fue eliminado

---

### FASE 4: UX

---

#### ADDED-10: Combobox de Proveedores con Búsqueda

El sistema DEBE reemplazar el `<select>` nativo de proveedores por un componente Combobox searchable (shadcn `Command` + `Popover`).

##### Scenario: Búsqueda de proveedor por nombre

- GIVEN muchos proveedores (>50) en el sistema
- WHEN el usuario escribe "Tel" en el combobox
- THEN se filtran y muestran solo proveedores que contienen "Tel"
- AND el usuario puede seleccionar con teclado o mouse

##### Scenario: Selección de proveedor inexistente

- GIVEN el combobox de proveedores
- WHEN el usuario busca un proveedor que no existe
- THEN el sistema muestra "No se encontraron proveedores"
- AND NO permite selección

---

#### ADDED-11: Operaciones Masivas (Selección y Eliminación)

El sistema DEBE permitir seleccionar múltiples registros de gastos DE y eliminarlos en una sola operación con diálogo de confirmación.

##### Scenario: Selección múltiple de gastos

- GIVEN la tabla de lista de gastos DE
- WHEN el usuario marca checkboxes de varios registros
- THEN el sistema muestra un botón "Eliminar seleccionados (N)"
- AND resalta los registros seleccionados

##### Scenario: Eliminación masiva con confirmación

- GIVEN 5 gastos seleccionados
- WHEN el usuario pulsa "Eliminar seleccionados"
- THEN aparece un dialog: "¿Eliminar 5 gastos de explotación?"
- AND al confirmar elimina los 5 registros
- AND al cancelar no elimina ninguno

---

#### ADDED-12: Exportación a CSV

El sistema DEBE permitir exportar la lista de gastos DE filtrada a archivo CSV.

##### Scenario: Exportar lista completa

- GIVEN la tabla con todos los gastos visibles
- WHEN el usuario pulsa "Exportar CSV"
- THEN se descarga un archivo `.csv` con todas las columnas: tipo, proveedor, descripción, monto, período, nº factura, fecha

##### Scenario: Exportar lista filtrada

- GIVEN el usuario filtró por proveedor "TelCo"
- WHEN pulsa "Exportar CSV"
- THEN el archivo CSV contiene solo los gastos de "TelCo"

---

### FASE 5: TAXONOMÍA — CONCEPTOS DE GASTOS Y ELEMENTOS

---

#### ADDED-13: Modelo `GastoConcepto`

El sistema DEBE incluir un nuevo modelo Prisma `GastoConcepto` para representar las categorías principales de gastos de explotación.

```
model GastoConcepto {
  conceptoId        String         @id @default(cuid())
  nombre            String         @unique
  descripcion       String?
  isActive          Boolean        @default(true)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  elementos         GastoElemento[]
  gastosDE          GastosDE[]
}
```

Campos:
- `conceptoId` — Identificador único (CUID)
- `nombre` — Nombre del concepto (único, requerido). Ej: "Arrendamiento", "Mantenimiento", "Telefonía", "Servicios Públicos"
- `descripcion` — Descripción opcional del concepto
- `isActive` — Si el concepto está activo y disponible para selección
- `elementos` — Relación 1:N con `GastoElemento`
- `gastosDE` — Relación 1:N con `GastosDE`

##### Scenario: Crear un nuevo concepto

- GIVEN un usuario en la página de administración de conceptos
- WHEN crea un concepto "Arrendamiento" con descripción "Gastos de alquiler de locales y oficinas"
- THEN el sistema guarda el concepto con `isActive = true`
- AND aparece en la lista de conceptos disponibles

##### Scenario: Nombre duplicado es rechazado

- GIVEN ya existe un concepto llamado "Mantenimiento"
- WHEN un usuario intenta crear otro con el mismo nombre
- THEN el sistema retorna error "Ya existe un concepto con ese nombre"

##### Scenario: Desactivar concepto existente

- GIVEN un concepto "Telefonía" con gastos asociados
- WHEN el usuario lo desactiva
- THEN `isActive` cambia a `false`
- AND el concepto NO aparece en listas de selección nuevas
- AND los gastos existentes que lo usan NO se ven afectados

---

#### ADDED-14: Modelo `GastoElemento`

El sistema DEBE incluir un nuevo modelo Prisma `GastoElemento` para representar los elementos (subcategorías) dentro de cada concepto de gasto.

```
model GastoElemento {
  elementoId        String          @id @default(cuid())
  conceptoId        String
  nombre            String
  descripcion       String?
  isActive          Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  concepto          GastoConcepto   @relation(fields: [conceptoId], references: [conceptoId], onDelete: Cascade)
  gastosDE          GastosDE[]
}
```

Campos:
- `elementoId` — Identificador único (CUID)
- `conceptoId` — FK al concepto padre (requerido)
- `nombre` — Nombre del elemento (requerido). Ej: para concepto "Arrendamiento": "Local Comercial", "Oficina Central", "Almacén"
- `descripcion` — Descripción opcional
- `isActive` — Si el elemento está activo
- `concepto` — Relación N:1 con `GastoConcepto` (cascade on delete)
- `gastosDE` — Relación 1:N con `GastosDE`

##### Scenario: Crear elemento bajo un concepto

- GIVEN existe el concepto "Servicios Públicos"
- WHEN el usuario crea el elemento "Electricidad" bajo ese concepto
- THEN el sistema guarda el elemento con `conceptoId` correcto
- AND aparece en la lista de elementos del concepto

##### Scenario: Eliminar concepto elimina sus elementos

- GIVEN un concepto con 3 elementos
- WHEN el usuario elimina el concepto
- THEN el sistema elimina también los 3 elementos (cascade)
- AND los gastos DE que usaban esos elementos quedan con `conceptoId` y `elementoId` en null

##### Scenario: Nombre de elemento puede repetirse en distintos conceptos

- GIVEN existe elemento "Mantenimiento Preventivo" bajo "Mantenimiento"
- WHEN se crea elemento "Mantenimiento Preventivo" bajo "Seguridad"
- THEN el sistema lo permite (nombre es único dentro del concepto, no global)

---

#### ADDED-15: Actualización del Modelo `GastosDE` con Relaciones a Concepto y Elemento

El sistema DEBE agregar campos opcionales `conceptoId` y `elementoId` al modelo `GastosDE`, reemplazando el campo libre `tipo`.

```
model GastosDE {
  ...
  conceptoId        String?
  elementoId        String?
  concepto          GastoConcepto?    @relation(fields: [conceptoId], references: [conceptoId])
  elemento          GastoElemento?    @relation(fields: [elementoId], references: [elementoId])
  ...
}
```

- `tipo` se MANTIENE como campo de texto libre para compatibilidad con registros legacy
- `conceptoId` y `elementoId` son opcionales para permitir migración gradual
- Cuando se selecciona concepto y elemento, `tipo` se autogenera como `${concepto.nombre} — ${elemento.nombre}`

##### Scenario: Crear gasto con concepto y elemento

- GIVEN un usuario en el formulario de nuevo gasto
- WHEN selecciona concepto "Arrendamiento" y elemento "Local Comercial"
- THEN el sistema guarda `conceptoId` y `elementoId`
- AND `tipo` se autogenera como "Arrendamiento — Local Comercial"

##### Scenario: Crear gasto sin concepto (modo legacy)

- GIVEN un usuario que no quiere usar la taxonomía
- WHEN crea un gasto sin seleccionar concepto/elemento
- THEN puede escribir `tipo` manualmente como texto libre
- AND `conceptoId` y `elementoId` permanecen `null`

##### Scenario: Filtrar gastos por concepto

- GIVEN existen gastos con distintos conceptos
- WHEN el usuario aplica filtro por concepto "Mantenimiento"
- THEN la tabla muestra solo gastos con ese concepto
- AND también muestra gastos legacy con `tipo` que contiene "Mantenimiento"

---

#### ADDED-16: CRUD de Conceptos y Elementos

El sistema DEBE proporcionar páginas y componentes de administración para gestionar conceptos y elementos de gastos.

**Rutas:**
- `/busy/gastosDE/conceptos` — Lista, crear, editar, desactivar conceptos
- `/busy/gastosDE/conceptos/new` — Crear concepto
- `/busy/gastosDE/conceptos/update/[id]` — Editar concepto
- `/busy/gastosDE/conceptos/[id]/elementos` — Elementos de un concepto

**API Routes:**
- `GET/POST /api/gastosDE/conceptos`
- `GET/PATCH/DELETE /api/gastosDE/conceptos/[id]`
- `GET/POST /api/gastosDE/conceptos/[conceptoId]/elementos`
- `GET/PATCH/DELETE /api/gastosDE/conceptos/[conceptoId]/elementos/[elementoId]`

##### Scenario: Listar conceptos con conteo de elementos

- GIVEN existen 5 conceptos con distintos elementos
- WHEN el usuario navega a `/busy/gastosDE/conceptos`
- THEN la tabla muestra: nombre, descripción, cantidad de elementos, estado (activo/inactivo), acciones

##### Scenario: Crear concepto con elementos iniciales

- GIVEN un usuario creando concepto "Seguridad"
- WHEN agrega elementos "Vigilancia", "Alarmas", "Cámaras" en el mismo formulario
- THEN el sistema crea el concepto y los 3 elementos en transacción atómica

##### Scenario: Editar elemento existente

- GIVEN existe elemento "Electricidad" bajo "Servicios Públicos"
- WHEN el usuario lo edita para cambiar nombre a "Energía Eléctrica"
- THEN el sistema actualiza el nombre
- AND los gastos existentes que usan ese elemento reflejan el nuevo nombre

---

#### ADDED-17: Formulario de GastosDE con Selector de Concepto/Elemento en Cascada

El sistema DEBE actualizar el formulario `GastosDEForm` para incluir selectores en cascada: primero concepto, luego elemento.

##### Scenario: Selección en cascada

- GIVEN el formulario de nuevo gasto
- WHEN el usuario selecciona concepto "Mantenimiento"
- THEN el selector de elemento se habilita mostrando solo elementos de "Mantenimiento"
- AND muestra: "Reparaciones", "Mantenimiento Preventivo", "Limpieza"

##### Scenario: Cambio de concepto limpia elemento

- GIVEN el usuario seleccionó concepto "Telefonía" y elemento "Línea Fija"
- WHEN cambia el concepto a "Servicios Públicos"
- THEN el selector de elemento se limpia y deshabilita hasta nueva selección
- AND `tipo` se actualiza automáticamente

##### Scenario: Visualización del tipo autogenerado

- GIVEN concepto "Arrendamiento" y elemento "Oficina Central" seleccionados
- WHEN el usuario revisa el formulario
- THEN ve un preview: "Tipo: Arrendamiento — Oficina Central"

---

#### ADDED-18: Datos Iniciales (Seed) de Conceptos y Elementos

El sistema DEBE incluir un script de seed con conceptos y elementos comunes predefinidos.

**Conceptos iniciales sugeridos:**

| Concepto | Elementos |
|----------|-----------|
| Arrendamiento | Local Comercial, Oficina Central, Almacén, Vivienda Empleado |
| Mantenimiento | Reparaciones, Mantenimiento Preventivo, Limpieza, Jardinería |
| Telefonía | Línea Fija, Telefonía Móvil, Internet, Videollamadas |
| Servicios Públicos | Electricidad, Agua, Gas, Recogida de Basura |
| Seguros | Seguro Local, Seguro Responsabilidad, Seguro Equipo |
| Impuestos y Tasas | Impuestos Municipales, Licencias, Tasas Administrativas |
| Suministros | Material de Oficina, Material de Limpieza, Equipos Informáticos |
| Transportes | Combustible, Peajes, Alquiler Vehículo, Mensajería |

##### Scenario: Ejecutar seed de conceptos

- GIVEN una base de datos sin conceptos de gastos
- WHEN se ejecuta `pnpm run seed:gastos-conceptos`
- THEN el sistema crea los 8 conceptos con sus elementos
- AND todos con `isActive = true`

##### Scenario: Seed idempotente

- GIVEN la base de datos ya tiene los conceptos seedeados
- WHEN se ejecuta nuevamente `pnpm run seed:gastos-conceptos`
- THEN NO se duplican registros
- AND el sistema muestra "Conceptos ya existentes, sin cambios"

---

## MODIFIED Requirements

### Requirement: Modelo GastosDE — Campo `tipo` _(modificado)_

El campo `tipo` de `GastosDE` se mantiene como `String?` para compatibilidad con datos legacy, pero su fuente primaria de valores pasa a ser la relación con `GastoConcepto` y `GastoElemento`.

(Anteriormente: `tipo` era un string libre requerido, sin taxonomía estructurada.)

##### Scenario: Registro legacy con solo `tipo`

- GIVEN un gasto DE creado antes de la migración con `tipo = "Arrendamiento"`
- WHEN se consulta el registro
- THEN `tipo` muestra "Arrendamiento"
- AND `conceptoId` y `elementoId` son `null`
- AND el registro aparece en listados y reconciliaciones normalmente

##### Scenario: Registro nuevo con taxonomía completa

- GIVEN un gasto DE creado después de la migración
- WHEN se selecciona concepto "Telefonía" y elemento "Internet"
- THEN `tipo` = "Telefonía — Internet"
- AND `conceptoId` y `elementoId` están poblados
- AND el registro aparece en filtros por concepto y elemento

---

### Requirement: API de Reconciliación de Gastos _(modificado)_

La API de reconciliación DEBE incluir información de concepto y elemento cuando el gasto los tenga asociados.

(Anteriormente: solo mostraba `tipo` como texto libre.)

##### Scenario: Gasto reconciliado con taxonomía

- GIVEN un gasto con concepto "Mantenimiento" y elemento "Reparaciones"
- WHEN aparece en la tabla de gastos pendientes para reconciliar
- THEN muestra badge de concepto "Mantenimiento"
- AND sub-badge de elemento "Reparaciones"
- AND el usuario puede filtrar por concepto en la tabla

---

### Requirement: Dashboard — Agregación de Gastos _(modificado)_

El dashboard DEBE agregar gastos DE por concepto además del total general.

(Anteriormente: solo mostraba `gastosDeExplotacion` como monto total sin desglose.)

##### Scenario: Dashboard con desglose por concepto

- GIVEN existen gastos de 3 conceptos distintos en el mes
- WHEN el usuario abre el dashboard de contabilidad
- THEN muestra total general de Gastos de Explotación
- AND desglose por concepto: "Arrendamiento: $5000", "Telefonía: $360", "Mantenimiento: $1200"

---

## DELETED Requirements

### Requirement: Campo `tipo` como texto libre _(eliminado parcialmente)_

El campo `tipo` ya NO es la fuente primaria de categorización de gastos. Se mantiene como `String?` solo para compatibilidad con datos existentes y modo fallback. Los nuevos gastos DEBERÍAN usar `conceptoId` y `elementoId`.

---

## Data Model — Resumen de Cambios

### Nuevo: `GastoConcepto`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| conceptoId | String (CUID) | PK |
| nombre | String | Único, requerido |
| descripcion | String? | Descripción opcional |
| isActive | Boolean | Default: `true` |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### Nuevo: `GastoElemento`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| elementoId | String (CUID) | PK |
| conceptoId | String | FK → GastoConcepto (Cascade delete) |
| nombre | String | Requerido |
| descripcion | String? | Descripción opcional |
| isActive | Boolean | Default: `true` |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### Modificado: `GastosDE`

| Campo | Cambio | Descripción |
|-------|--------|-------------|
| `monto` | `Int` → `Decimal` | Soporta centavos |
| `isPagado` | `String?` → `String` default `'pendiente'` | Enum: pendiente/pagado/parcial |
| `conceptoId` | NUEVO `String?` | FK → GastoConcepto |
| `elementoId` | NUEVO `String?` | FK → GastoElemento |
| `tipo` | `String` → `String?` | Mantener para compatibilidad legacy |

---

## Coverage

| Área | Escenarios Cubiertos |
|------|---------------------|
| Seguridad | Autenticación, autorización de eliminación |
| Modelo de Datos | Decimal, enum isPagado, período seleccionable, factura en lista |
| Calidad de Código | Validación Zod servidor, nombrado, tests unitarios |
| UX | Combobox proveedores, operaciones masivas, export CSV |
| Taxonomía | CRUD conceptos/elementos, selectores cascada, seed, migración |

---

## Next Step

Ready for design (sdd-design).
