# Especificación del Módulo de Producción

## 1. Propósito y Visión General

El módulo de producción es un subsistema del sistema de gestión de inventario que permite controlar y registrar la elaboración de productos terminados a partir de materias primas o productos del inventario. Su objetivo principal es gestionar las recetas de producción, las órdenes de fabricación y la salida de materiales necesarios para el proceso productivo.

Este módulo facilita la planificación de la producción, el seguimiento del estado de las órdenes, el cálculo automático de costos de materiales y la trazabilidad completa del proceso productivo. Además, permite registrar salidas de inventario por conceptos diversos como producción, muestras, consumo interno u otros usos operativos.

### 1.1 Objetivos del Módulo

El módulo de producción persigue los siguientes objetivos estratégicos: automatizar el cálculo de costos de producción basado en los ingredientes definidos en las recetas, proporcionar visibilidad en tiempo real sobre el estado de las órdenes de fabricación, gestionar de manera eficiente las salidas de inventario vinculadas al proceso productivo, y mantener un historial completo de todos los cambios de estado para garantizar la trazabilidad operativa.

### 1.2 Alcance Funcional

El alcance del módulo comprende tres grandes áreas funcionales: la gestión de recetas de producción que incluye la creación, edición, eliminación y consulta de recetas con sus ingredientes asociados; la gestión de órdenes de producción que abarca la creación, aprobación, ejecución y cancelación de órdenes de fabricación; y la gestión de vales de salida que permite registrar la salida de productos del inventario por diversos conceptos.

---

## 2. Modelos de Datos

### 2.1 Receta (Receta)

El modelo Receta representa una fórmula de fabricación que define los ingredientes y sus cantidades necesarias para producir una cantidad específica de producto terminado. Este modelo es la base para la planificación de la producción y el cálculo de costos.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| recetaId | String (CUID) | Sí | Identificador único de la receta |
| nombre | String (160) | Sí | Nombre descriptivo de la receta |
| rendimiento | Integer | Sí | Cantidad de unidades producidas con esta receta (por defecto 1) |
| costoUnitario | Integer | Sí | Costo calculado por unidad de producción (por defecto 0) |
| instrucciones | String (4000) | No | Pasos o indicaciones para la preparación |
| tiempoPrep | Integer | No | Tiempo estimado de preparación en minutos |
| productoId | String | No | Identificador del producto del inventario asociado |
| createdAt | DateTime | Sí | Fecha de creación del registro |
| updatedAt | DateTime | Sí | Fecha de última modificación |

**Relaciones:**

- Una Receta puede tener asociado un Producto del inventario (relación uno a uno opcional)
- Una Receta puede tener múltiples RecetaIngrediente (ingredientes)
- Una Receta puede tener múltiples OrdenProduccion (órdenes que la utilizan)

### 2.2 RecetaIngrediente

El modelo RecetaIngrediente define cada uno de los productos del inventario que se utilizan como materia prima en una receta de producción. Permite especificar la cantidad necesaria y el porcentaje de desperdicio estimado.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| recetaIngredienteId | String (CUID) | Sí | Identificador único del ingrediente en la receta |
| recetaId | String | Sí | Identificador de la receta a la que pertenece |
| productoId | String | Sí | Identificador del producto del inventario |
| cantidad | Float | Sí | Cantidad del producto necesaria |
| desperdicio | Float | Sí | Porcentaje de desperdicio estimado (por defecto 0) |
| createdAt | DateTime | Sí | Fecha de creación |
| updatedAt | DateTime | Sí | Fecha de última modificación |

**Restricciones:**

- La combinación de recetaId y productoId debe ser única (no se puede agregar el mismo producto dos veces a una receta)

**Relaciones:**

- Cada RecetaIngrediente pertenece a una única Receta
- Cada RecetaIngrediente referencia un único Producto del inventario

### 2.3 OrdenProduccion

El modelo OrdenProduccion representa una orden de fabricación que se crea para producir una cantidad específica de producto utilizando una receta determinada. La orden atraviesa diferentes estados durante su ciclo de vida.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| ordenProduccionId | String (CUID) | Sí | Identificador único de la orden de producción |
| recetaId | String | Sí | Identificador de la receta a utilizar |
| cantidad | Integer | Sí | Cantidad de unidades a producir |
| estado | EstadoProduccion | Sí | Estado actual de la orden (PENDIENTE, EN_PROCESO, COMPLETADA, CANCELADA) |
| observaciones | String | No | Notas adicionales sobre la orden |
| fechaProduccion | DateTime | Sí | Fecha de producción programada o real |
| costoMateriales | Integer | No | Costo total de los materiales utilizados |
| costoUnitario | Integer | No | Costo unitario de producción calculado |
| createdAt | DateTime | Sí | Fecha de creación de la orden |
| updatedAt | DateTime | Sí | Fecha de última modificación |

**Estados Posibles:**

- **PENDIENTE**: La orden ha sido creada pero aún no ha sido aprobada para producción
- **EN_PROCESO**: La orden ha sido aprobada y está en proceso de fabricación
- **COMPLETADA**: La orden ha sido finalizada y los productos han sido generados
- **CANCELADA**: La orden fue cancelada antes de completarse

**Relaciones:**

- Cada OrdenProduccion referencia una única Receta
- Cada OrdenProduccion puede tener múltiples registros en OrdenProduccionHistorial

### 2.4 ValeSalida

El modelo ValeSalida registra la salida de productos del inventario por diversos conceptos. Se utiliza para control interno y trazabilidad de materiales-salientes del almacén.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| valeSalidaId | String (CUID) | Sí | Identificador único del vale de salida |
| concepto | String | Sí | Motivo o razón de la salida de productos |
| observaciones | String | No | Notas adicionales sobre el vale |
| estado | String | Sí | Estado del vale (pendiente, completada) |
| usuarioId | String | Sí | Identificador del usuario que crea el vale |
| createdAt | DateTime | Sí | Fecha de creación del vale |
| updatedAt | DateTime | Sí | Fecha de última modificación |

**Índices:**

- Índice en el campo estado para filtrado rápido
- Índice en el campo createdAt para búsquedas por fecha
- Índice en el campo usuarioId para auditorías por usuario

**Relaciones:**

- Cada ValeSalida puede tener múltiples ValeSalidaItem (productos incluidos)
- Cada ValeSalida es creado por un Usuario específico

### 2.5 ValeSalidaItem

El modelo ValeSalidaItem representa cada producto incluido en un vale de salida, especificando la cantidad retirada del inventario.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| valeSalidaItemId | String (CUID) | Sí | Identificador único del item del vale |
| valeSalidaId | String | Sí | Identificador del vale al que pertenece |
| productoId | String | Sí | Identificador del producto del inventario |
| cantidad | Integer | Sí | Cantidad de producto que sale del inventario |
| createdAt | DateTime | Sí | Fecha de creación del item |
| updatedAt | DateTime | Sí | Fecha de última modificación |

**Relaciones:**

- Cada ValeSalidaItem pertenece a un único ValeSalida
- Cada ValeSalidaItem referencia un único Producto del inventario

### 2.6 OrdenProduccionHistorial

El modelo OrdenProduccionHistorial mantiene un registro de todos los cambios de estado que experimenta una orden de producción. Este modelo es fundamental para la trazabilidad y auditoría del proceso productivo.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| historialId | String (CUID) | Sí | Identificador único del registro histórico |
| ordenProduccionId | String | Sí | Identificador de la orden de producción |
| estadoAnterior | String | No | Estado de la orden antes del cambio |
| estadoNuevo | String | Sí | Nuevo estado de la orden después del cambio |
| observaciones | String | No | Descripción del cambio o motivo |
| usuarioId | String | Sí | Identificador del usuario que realizó el cambio |
| createdAt | DateTime | Sí | Fecha y hora del cambio de estado |

**Índices:**

- Índice en ordenProduccionId para consultas históricas de una orden específica
- Índice en createdAt para búsquedas por rango de fechas

---

## 3. API REST

### 3.1 Recetas de Producción

#### GET /api/produccion/recetas

Obtiene el listado de recetas de producción con filtros opcionales.

**Parámetros de Query:**

- search (opcional): Cadena de búsqueda para filtrar por nombre de receta
- productoId (opcional): Filtrar recetas asociadas a un producto específico

**Respuesta:** Array de objetos Receta con sus ingredientes incluidos.

#### POST /api/produccion/recetas

Crea una nueva receta de producción.

**Cuerpo de la Solicitud:**

```json
{
  "nombre": "string (requerido, máx 160 caracteres)",
  "rendimiento": "integer (mín 1, por defecto 1)",
  "productoId": "string (opcional)",
  "instrucciones": "string (opcional, máx 4000 caracteres)",
  "tiempoPrep": "integer (opcional, minutos)"
}
```

**Respuesta:** Objeto Receta creado con código de estado 201.

#### GET /api/produccion/recetas/[id]

Obtiene los detalles de una receta específica, incluyendo sus ingredientes.

#### PUT /api/produccion/recetas/[id]

Actualiza los datos de una receta existente.

#### DELETE /api/produccion/recetas/[id]

Elimina una receta y todos sus ingredientes asociados.

#### POST /api/produccion/recetas/[id]/ingredientes

Agrega uno o más ingredientes a una receta existente.

### 3.2 Órdenes de Producción

#### GET /api/produccion/ordenes

Obtiene el listado de órdenes de producción con filtros opcionales.

**Parámetros de Query:**

- estado (opcional): Filtrar por estado (PENDIENTE, EN_PROCESO, COMPLETADA, CANCELADA)

**Respuesta:** Array de objetos OrdenProduccion con la receta asociada.

#### POST /api/produccion/ordenes

Crea una nueva orden de producción basada en una receta.

**Cuerpo de la Solicitud:**

```json
{
  "recetaId": "string (requerido)",
  "cantidad": "integer (requerido, mín 1)"
}
```

**Respuesta:** Objeto OrdenProduccion creado con código de estado 201.

#### GET /api/produccion/ordenes/[id]

Obtiene los detalles de una orden específica.

#### PUT /api/produccion/ordenes/[id]

Actualiza los datos de una orden existente.

#### DELETE /api/produccion/ordenes/[id]

Elimina una orden de producción.

#### POST /api/produccion/ordenes/[id]/aprobar

Aprueba una orden de producción en estado PENDIENTE, cambiándola a EN_PROCESO.

**Efectos:** Se crea un registro en OrdenProduccionHistorial y se reservan los materiales necesarios del inventario.

#### POST /api/produccion/ordenes/[id]/completar

Completa una orden de producción en estado EN_PROCESO, cambiándola a COMPLETADA.

**Efectos:** Se crea un registro en OrdenProduccionHistorial, se descuenta el inventario de los ingredientes utilizados, y se incrementa el stock del producto generado.

#### POST /api/produccion/ordenes/[id]/cancelar

Cancela una orden de producción en cualquier estado diferente a COMPLETADA.

**Cuerpo de la Solicitud:**

```json
{
  "observaciones": "string (opcional)"
}
```

**Efectos:** Se crea un registro en OrdenProduccionHistorial con el estado CANCELADA.

### 3.3 Vales de Salida

#### GET /api/produccion/vales

Obtiene el listado de vales de salida con filtros opcionales.

**Parámetros de Query:**

- concepto (opcional): Filtrar por concepto de salida

**Respuesta:** Array de objetos ValeSalida con sus items incluidos.

#### POST /api/produccion/vales

Crea un nuevo vale de salida de productos.

**Cuerpo de la Solicitud:**

```json
{
  "concepto": "string (requerido)",
  "observaciones": "string (opcional)",
  "items": [
    {
      "productoId": "string (requerido)",
      "cantidad": "integer (requerido, mín 1)"
    }
  ]
}
```

**Efectos:** Se descuenta el stock de los productos especificados en los items.

**Respuesta:** Objeto ValeSalida creado con código de estado 201.

#### GET /api/produccion/vales/[id]

Obtiene los detalles de un vale específico, incluyendo sus items.

#### DELETE /api/produccion/vales/[id]

Elimina un vale de salida y revierte los cambios en el inventario.

#### GET /api/produccion/vales/[id]/pdf

Genera un documento PDF del vale de salida para impresión o archivo.

### 3.4 Conceptos

#### GET /api/produccion/conceptos

Obtiene la lista de conceptos disponibles para vales de salida.

**Respuesta:** Array de strings con los nombres de los conceptos definidos.

---

## 4. Interfaz de Usuario

### 4.1 Página Principal de Producción

La página principal del módulo de producción se encuentra en /busy/produccion y está organizada en tres pestañas principales que permiten acceder a las diferentes funcionalidades del módulo.

#### 4.1.1 Panel de Estadísticas

En la parte superior de la página se muestra un panel con cuatro tarjetas informativas que proporcionan una visión rápida del estado actual del módulo. La primera tarjeta muestra el total de recetas registradas en el sistema. La segunda indica el número de órdenes en estado PENDIENTE que esperan ser aprobadas. La tercera presenta las órdenes que se encuentran actualmente EN_PROCESO. La cuarta muestra el conteo de órdenes que han sido completadas exitosamente.

#### 4.1.2 Pestaña de Recetas

La pestaña de recetas presenta una tabla con todas las recetas de producción registradas. Cada fila de la tabla muestra el nombre de la receta, el rendimiento (cantidad de unidades que produce), el producto asociado del inventario, la cantidad de ingredientes definidos, el costo unitario calculado, la fecha de creación y las acciones disponibles.

Las acciones disponibles para cada receta incluyen ver los detalles, editar la receta y eliminarla. En la parte superior de la sección existe un campo de búsqueda que permite filtrar las recetas por nombre, y un botón que abre un diálogo para crear una nueva receta.

El formulario de nueva receta solicita los siguientes campos: nombre de la receta (texto requerido), rendimiento en unidades (número entero mayor a cero), producto del inventario opcional (selección de un producto existente), instrucciones de preparación (texto largo opcional), y tiempo de preparación en minutos (número opcional).

#### 4.1.3 Pestaña de Órdenes de Producción

La pestaña de órdenes de producción muestra una tabla con todas las órdenes creadas. Las columnas de la tabla incluyen: la receta asociada, la cantidad a producir, el estado actual de la orden, el costo de los materiales utilizados, la fecha de producción, y las acciones disponibles.

Las acciones disponibles varían según el estado de la orden. Para órdenes en estado PENDIENTE se muestran los botones de aprobar, iniciar y cancelar. Para órdenes en estado EN_PROCESO se muestran los botones de completar y cancelar. Las órdenes en estado COMPLETADA o CANCELADA no permiten acciones adicionales.

En la parte superior de la sección existe un filtro por estado que permite mostrar solo las órdenes de un estado específico, y un botón para crear una nueva orden de producción. El formulario de nueva orden solicita seleccionar una receta existente e indicar la cantidad a producir.

#### 4.1.4 Pestaña de Vales de Salida

La pestaña de vales de salida presenta una tabla con los vales registrados. Las columnas muestran: el concepto del vale, los productos incluidos con sus cantidades, el estado del vale, la fecha de creación, y las acciones disponibles.

Las acciones incluyen la generación de un PDF del vale para impresión. Existe un filtro por concepto para buscar vales específicos, y un botón para crear un nuevo vale.

El formulario de nuevo vale permite seleccionar un concepto de una lista predefinida y agregar productos del inventario. Para cada producto agregado se debe especificar la cantidad a retirar, la cual no puede exceder el stock disponible. Los productos pueden removerse del vale antes de crearlo.

---

## 5. Flujos de Trabajo

### 5.1 Flujo de Creación de Receta

El flujo de trabajo para crear una receta de producción comienza cuando el usuario accede a la pestaña de recetas y hace clic en el botón de nueva receta. Se presenta un formulario donde el usuario debe ingresar el nombre de la receta, el rendimiento esperado, y opcionalmente seleccionar un producto del inventario que se generará al producir, agregar instrucciones de preparación y tiempo estimado.

Una vez completado el formulario, al hacer clic en crear se envía la información al endpoint POST /api/produccion/recetas. Si la operación es exitosa, la nueva receta aparece en la tabla. Posteriormente, el usuario puede agregar ingredientes a la receta editándola y utilizando la funcionalidad de gestión de ingredientes.

### 5.2 Flujo de Órden de Producción

El flujo de orden de producción inicia cuando se necesita fabricar una cantidad específica de producto. El usuario crea una nueva orden seleccionando la receta deseada e indicando la cantidad a producir. Esta orden se crea en estado PENDIENTE.

Una vez revisada la orden, un supervisor puede aprobarla lo que cambia su estado a EN_PROCESO y genera la reserva de materiales del inventario. Durante el proceso de fabricación, el personal operativo puede trabajar en la producción.

Al finalizar la fabricación, un responsable completa la orden lo que ejecuta el descarte de los ingredientes del inventario y, si la receta tiene un producto asociado, incrementa el stock de dicho producto en la cantidad especificada multiplicada por el rendimiento de la receta. La orden cambia a estado COMPLETADA.

En cualquier momento antes de completarse, una orden puede ser cancelada con las observaciones correspondientes, registrando el cambio en el historial.

### 5.3 Flujo de Vale de Salida

El flujo de vale de salida se utiliza para registrar la salida de productos del inventario por cualquier concepto diferente a la producción regular. El usuario crea un nuevo vale seleccionando un concepto predefinido y agregando los productos necesarios con sus cantidades.

Al crear el vale, automáticamente se descuenta el stock de cada producto incluido. El vale queda registrado en el sistema con fines de trazabilidad y control interno.

---

## 6. Reglas de Negocio

### 6.1 Gestión de Recetas

El nombre de cada receta debe ser único en el sistema, no permitiendo duplicados. El rendimiento debe ser siempre un número entero mayor a cero, representando la cantidad de unidades producidas por cada ejecución de la receta. Una receta puede tener cero o más ingredientes definidos, aunque para que una orden de producción sea válida debe tener al menos un ingrediente.

El costo unitario de la receta se calcula automáticamente como la suma del costo de todos los ingredientes multiplicados por sus cantidades, dividido por el rendimiento. Este cálculo se actualiza automáticamente cuando se modifican los ingredientes o sus cantidades.

### 6.2 Gestión de Órdenes de Producción

Una orden de producción solo puede crearse si la receta asociada existe y tiene al menos un ingrediente definido. La cantidad a producir debe ser un número entero mayor a cero. Una orden en estado PENDIENTE puede aprobarse o cancelarse. Una orden en estado EN_PROCESO puede completarse o cancelarse pero no puede volver a PENDIENTE. Una orden en estado COMPLETADA o CANCELADA no puede modificarse.

Al aprobar una orden, el sistema debe verificar que haya suficiente stock de todos los ingredientes en el inventario. Si no hay stock suficiente, la aprobación debe rechazarse con un mensaje de error indicando qué productos faltan.

Al completar una orden, se descuenta del inventario la cantidad de cada ingrediente multiplicada por la cantidad de producción, aplicando también el porcentaje de desperdicio si está definido. Si la receta tiene un producto asociado, se incrementa el stock de dicho producto en la cantidad producida.

### 6.3 Gestión de Vales de Salida

El concepto del vale debe ser uno de los valores predefinidos en el sistema. Cada producto incluido en un vale debe tener una cantidad mayor a cero y no puede exceder el stock disponible en el inventario al momento de crear el vale. Un vale puede contener uno o más productos diferentes.

Al crear un vale, se descuenta inmediatamente el stock de todos los productos incluidos. Al eliminar un vale, se revierte elstock incrementándolo nuevamente.

---

## 7. Validaciones y Manejo de Errores

### 7.1 Validaciones del Lado del Cliente

Antes de enviar cualquier solicitud al servidor, la interfaz de usuario debe realizar validaciones locales para mejorar la experiencia del usuario. El nombre de la receta no puede estar vacío y debe tener entre 1 y 160 caracteres. El rendimiento debe ser un número entero mayor a cero. La cantidad en órdenes debe ser un número entero mayor a cero. La cantidad en vales no puede exceder el stock disponible mostrado.

### 7.2 Validaciones del Lado del Servidor

Todas las API routes implementan validación de datos utilizando el esquema Zod definido para cada endpoint. Los errores de validación devuelven un código de estado 400 con los detalles de los problemas encontrados. Las operaciones de creación y modificación verifican la existencia de los recursos relacionados antes de ejecutarse.

### 7.3 Manejo de Errores

Los errores del servidor devuelven un código de estado 500 con un mensaje genérico. Los errores de validación de permisos(auth) devuelven 401 o 403 según corresponda. Los errores de recursos no encontrados devuelven un código 404. Todas las operaciones que fallen deben registrar el error en la consola con contexto suficiente para su diagnóstico.

---

## 8. Integraciones y Dependencias

### 8.1 Dependencias del Módulo

El módulo de producción depende de los siguientes componentes del sistema: el modelo Producto del inventario para la gestión de ingredientes y productos generados, el sistema de autenticación de usuarios para registrar quién realiza cada operación, y el módulo de inventario para el control de stock.

### 8.2 Integración con el Inventario

El módulo de producción interactúa con el inventario de las siguientes formas: al crear una orden se reserva el stock de los ingredientes, al completar una orden se descuenta el stock de los ingredientes y se incrementa el stock del producto generado, al crear un vale se descuenta stock de los productos incluidos, y al eliminar un vale se revierte el descuento de stock.

---

## 9. Historial y Trazabilidad

### 9.1 Registro de Cambios de Estado

Cada cambio de estado en una orden de producción genera automáticamente un registro en la tabla OrdenProduccionHistorial. Este registro incluye: el identificador de la orden, el estado anterior y el nuevo estado, las observaciones del cambio si existen, el identificador del usuario que realizó el cambio, y la fecha y hora exacta del cambio.

### 9.2 Auditoría de Vales

Todos los vales de salida registran el usuario que los creó y la fecha de creación. Las modificaciones posteriores también registran el usuario y la fecha de actualización.

---

## 10. Consideraciones Técnicas

### 10.1 Rendimiento

Las consultas de recetas incluyen los ingredientes relacionados para evitar múltiples llamadas a la base de datos. Las consultas de órdenes filtran por estado utilizando índices optimizados. Las búsquedas de vales utilizan índices en concepto y fecha.

### 10.2 Concurrencia

Las operaciones que modifican el inventario (completar órdenes, crear vales) deben ejecutarse dentro de transacciones de base de datos para garantizar la consistencia. Si una operación falla, todos los cambios se revierten.

### 10.3 Seguridad

Todas las API routes del módulo utilizan los middlewares de autenticación withAuthGet y withAuthPost para garantizar que solo usuarios autenticados puedan acceder y modificar los datos. Los identificadores de usuario se extraen del token de autenticación y no se aceptan como parámetros manipulables.
