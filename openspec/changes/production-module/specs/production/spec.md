# Production Module Specification

## Purpose

Este módulo gestiona el proceso de producción de la empresa, incluyendo la definición de recetas para productos elaborados, órdenes de producción, registro de consumo de materia prima, costos de producción, y vales de salida de productos terminados o materiales por diversos conceptos.

## ADDED Requirements

### Requirement: Gestión de Recetas para Productos del Inventario

El sistema DEBE permitir crear, editar, eliminar y consultar recetas para productos elaborados del inventario. Una receta define los ingredientes (otros productos del inventario) y sus cantidades necesarias para producir una cantidad específica (rendimiento) de un producto final.

#### Scenario: Crear receta simple para producto

- GIVEN que el usuario accede al módulo de producción > pestaña Recetas
- WHEN ingresa nombre "Refresco 1L", rendimiento 1, selecciona producto del inventario "Refresco Instantáneo 1L Sin Marca", y guarda
- THEN el sistema DEBE crear la receta con estado activo
- AND mostrar la receta en la tabla de recetas
- AND calcular costoUnitario como 0 (cero) inicialmente

#### Scenario: Agregar ingredientes a receta

- GIVEN que existe una receta sin ingredientes
- WHEN el usuario accede a editar la receta, agrega ingrediente "Refresco Instantáneo 20g" con cantidad 1, desperdicio 0%, y guarda
- THEN el sistema DEBE vincular el ingrediente a la receta
- AND recalcular automáticamente costoUnitario = (1 × precioCosto de "Refresco Instantáneo 20g") / 1
- AND mostrar la actualización en tiempo real

#### Scenario: Rechazar ingrediente duplicado en receta

- GIVEN que una receta ya tiene agregado "Refresco Instantáneo 20g"
- WHEN el usuario intenta agregar el mismo producto nuevamente
- THEN el sistema DEBE mostrar error "Este producto ya existe en la receta"
- AND NOT permitir la duplicación

#### Scenario: Editar cantidad de ingrediente con recalculo de costo

- GIVEN que una receta tiene ingrediente "Refresco Instantáneo 20g" cantidad 1
- WHEN el usuario cambia la cantidad a 2
- THEN el sistema DEBE actualizar la cantidad en la receta
- AND recalcular costoUnitario automáticamente
- AND mostrar el nuevo costo en la interfaz

#### Scenario: Aplicar desperdicio en ingrediente

- GIVEN que un ingrediente tiene desperdicio 10%
- WHEN se calcula el costo de la receta
- THEN el sistema DEBE incluir el desperdicio en el cálculo: cantidad × (1 + 0.10)
- AND ajustar el costoUnitario final accordingly

#### Scenario: Eliminar receta con órdenes asociadas

- GIVEN que existe una receta con órdenes de producción completadas
- WHEN el usuario intenta eliminar la receta
- THEN el sistema DEBE rechazar la eliminación con mensaje "No se puede eliminar receta con órdenes asociadas"
- AND permitir eliminación solo si la receta no tiene órdenes

#### Scenario: Buscar receta por nombre

- GIVEN que existen múltiples recetas en el sistema
- WHEN el usuario ingresa "Refresco" en el campo de búsqueda
- THEN el sistema DEBE mostrar solo recetas cuyo nombre contenga "Refresco" (case-insensitive)
- AND actualizar la tabla en tiempo real

### Requirement: Ingredientes de Receta con Unidades y Conversiones

El sistema DEBE permitir definir ingredientes en diferentes unidades de medida (kg, litros, unidades, etc.) con conversión automática de costos.

#### Scenario: Agregar ingrediente con unidad diferente

- GIVEN que un ingrediente "Azúcar" tiene precioCosto en kg
- WHEN el usuario agrega a la receta "Azúcar" cantidad 500, unidad "gramos"
- THEN el sistema DEBE convertir a la unidad base (kg) internamente = 0.5 kg
- AND calcular costo como 0.5 × precioCosto

#### Scenario: Mostrar cantidad en unidad configurada

- GIVEN que se agregó "Azúcar" 500 gramos
- WHEN se visualiza la receta
- THEN el sistema DEBE mostrar "500 gramos" en la interfaz (no "0.5 kg")
- AND mantener precisión en cálculos internos

### Requirement: Órdenes de Producción con Estados Transicionables

El sistema DEBE permitir crear órdenes basadas en recetas, con validación de materiales y transiciones de estado controladas.

#### Scenario: Crear orden de producción pendiente

- GIVEN que existe receta "Refresco 1L" con ingredientes
- WHEN el usuario en pestaña Órdenes hace clic "Nueva Orden", selecciona "Refresco 1L", cantidad 10, y guarda
- THEN el sistema DEBE crear orden con estado PENDIENTE
- AND asignar fecha de producción a hoy
- AND calcular costoMateriales = (costoUnitario × cantidad) requerida

#### Scenario: Validar stock en aprobación de orden

- GIVEN que orden requiere 1 × "Refresco Instantáneo 20g" (stock actual: 0)
- WHEN el usuario intenta aprobar la orden haciendo clic "Aprobar"
- THEN el sistema DEBE mostrar error "Stock insuficiente: Refresco Instantáneo 20g (necesita 1, disponible 0)"
- AND no cambiar estado a EN_PROCESO

#### Scenario: Aprobar orden exitosamente reservando stock

- GIVEN que orden requiere 1 × "Refresco Instantáneo 20g" (stock actual: 5) y todos los ingredientes están disponibles
- WHEN el usuario hace clic "Aprobar"
- THEN el sistema DEBE cambiar estado a EN_PROCESO
- AND crear entrada en OrdenProduccionHistorial con estadoAnterior=PENDIENTE, estadoNuevo=EN_PROCESO
- AND NO decrementar inventario (solo reservar internamente para trazabilidad)

#### Scenario: Completar orden de producción consumiendo ingredientes

- GIVEN que orden está EN_PROCESO con 10 unidades de "Refresco 1L" a producir
- WHEN el usuario hace clic "Completar"
- THEN el sistema DEBE cambiar estado a COMPLETADA
- AND crear entrada en historial
- AND decrementar stock de "Refresco Instantáneo 20g" en 1 × 10 = 10 unidades
- AND incrementar stock de "Refresco Instantáneo 1L Sin Marca" en 10 unidades
- AND aplicar desperdicio si está configurado

#### Scenario: Cancelar orden en cualquier estado no completado

- GIVEN que orden está en PENDIENTE o EN_PROCESO
- WHEN el usuario hace clic "Cancelar" y proporciona observaciones "Error de especificación"
- THEN el sistema DEBE cambiar estado a CANCELADA
- AND crear entrada en historial con observaciones
- AND NO afectar inventario

#### Scenario: Filtrar órdenes por estado

- GIVEN que existen órdenes con diferentes estados
- WHEN el usuario selecciona filtro "En Proceso"
- THEN el sistema DEBE mostrar solo órdenes con estado EN_PROCESO
- AND contar correctamente en el panel (ej: "En Proceso: 3")

### Requirement: Transacciones Atómicas en Completación de Orden

El sistema DEBE garantizar que la actualización de inventario en la completación de órdenes sea atómica (todo o nada).

#### Scenario: Rollback en error de inventario

- GIVEN que se completa una orden y el decremento de ingredientes falla (ej: constraint violation)
- WHEN ocurre el error
- THEN el sistema DEBE revertir TODOS los cambios (estado no cambia, no se incrementa producto)
- AND mostrar al usuario "Error al completar orden, intente nuevamente"
- AND registrar el error en logs para auditoría

### Requirement: Vales de Salida por Conceptos

El sistema DEBE permitir registrar salida de productos por conceptos predefinidos o libres, con impacto en inventario.

#### Scenario: Crear vale de salida con concepto predefinido

- GIVEN que existen productos en inventario y el usuario accede a pestaña Vales
- WHEN selecciona concepto "Mantenimiento", agrega producto "Tuerca M10" cantidad 5, y guarda
- THEN el sistema DEBE crear vale con estado "pendiente" o "completada" según configuración
- AND decrementar stock de "Tuerca M10" en 5 unidades
- AND registrar usuarioId del usuario que crea el vale

#### Scenario: Vale con concepto libre no predefinido

- GIVEN que usuario necesita concepto "Donación a Caridad" que no existe en GastosDE
- WHEN crea vale ingresando concepto manualmente "Donación a Caridad"
- THEN el sistema DEBE permitir crear el vale con ese concepto libre
- AND registrar el concepto en el vale
- AND incluirlo en filtros futuros

#### Scenario: Validar disponibilidad en vale de salida

- GIVEN que producto "Tuerca M10" tiene stock 3
- WHEN usuario intenta crear vale para 5 unidades
- THEN el sistema DEBE mostrar "Stock insuficiente: disponible 3, solicitado 5"
- AND no crear el vale

#### Scenario: Múltiples productos en un vale

- GIVEN que usuario agrega "Tuerca M10" × 5 y "Arandela 8mm" × 10
- WHEN guarda el vale
- THEN el sistema DEBE validar disponibilidad de AMBOS productos
- AND rechazar si alguno no tiene stock
- AND crear vale solo si TODOS tienen stock suficiente

#### Scenario: Descartar producto del vale antes de guardar

- GIVEN que vale tiene 2 productos agregados
- WHEN usuario hace clic para eliminar uno de ellos
- THEN el sistema DEBE remover el producto de la lista
- AND permitir al usuario guardar con solo 1 producto

#### Scenario: Filtrar vales por concepto

- GIVEN que existen vales con concepto "Mantenimiento" y "Limpieza"
- WHEN usuario selecciona filtro "Mantenimiento"
- THEN el sistema DEBE mostrar solo vales de ese concepto
- AND actualizar tabla dinámicamente

### Requirement: Historial y Trazabilidad de Órdenes

El sistema DEBE mantener registro completo de cambios de estado en órdenes de producción.

#### Scenario: Registrar cambio de estado con usuario y fecha

- GIVEN que usuario "admin" aprueba una orden a las 14:30 del 2025-01-15
- WHEN ocurre la transición de estado
- THEN el sistema DEBE crear entrada en OrdenProduccionHistorial con:
  - ordenProduccionId: id de la orden
  - estadoAnterior: "PENDIENTE"
  - estadoNuevo: "EN_PROCESO"
  - usuarioId: id del usuario admin
  - createdAt: 2025-01-15 14:30:00
  - observaciones: null o valor si fue proporcionado

#### Scenario: Consultar historial de orden específica

- GIVEN que existe orden con 3 cambios de estado
- WHEN usuario accede a "Ver Historial" de esa orden
- THEN el sistema DEBE mostrar lista cronológica de cambios
- AND mostrar para cada entrada: estado anterior, nuevo, fecha, usuario

### Requirement: Cálculo Automático de Costos

El sistema DEBE calcular costos de producción basado en precios de costo de ingredientes.

#### Scenario: Calcular costoUnitario de receta vacía

- GIVEN que se crea receta sin ingredientes
- WHEN se guarda
- THEN costoUnitario DEBE ser 0

#### Scenario: Recalcular costo al cambiar precio de ingrediente

- GIVEN que receta "Refresco 1L" con ingrediente "Azúcar" $1/kg, cantidad 1kg, costoUnitario = $1
- WHEN el precio del producto "Azúcar" cambia a $1.5/kg (operación en módulo de productos)
- THEN costoUnitario de la receta DEBE recalcularse a $1.5 en la siguiente consulta
- AND mostrar actualización en tabla de recetas

#### Scenario: Mostrar costo unitario en receta

- GIVEN que receta tiene costoUnitario calculado
- WHEN se visualiza la tabla de recetas
- THEN columna "Costo Unitario" DEBE mostrar formato moneda, ej: "$50.00"

#### Scenario: Calcular costo total de orden

- GIVEN que orden produce 10 unidades con costoUnitario = $5
- WHEN se consulta el costo de la orden
- THEN costoMateriales DEBE ser $5 × 10 = $50

### Requirement: Panel de Estadísticas Actualizado en Tiempo Real

El sistema DEBE mostrar contadores precisos de recetas y órdenes por estado.

#### Scenario: Contar recetas totales

- GIVEN que existen 3 recetas en el sistema
- WHEN se accede al dashboard de producción
- THEN tarjeta "Recetas" DEBE mostrar "3"
- AND actualizar si se crea/elimina receta

#### Scenario: Contar órdenes por estado

- GIVEN que existen 2 órdenes PENDIENTE, 1 EN_PROCESO, 2 COMPLETADA
- WHEN se carga la página
- THEN tarjeta "Órdenes Pendientes" DEBE mostrar "2"
- AND "En Proceso" DEBE mostrar "1"
- AND "Completadas" DEBE mostrar "2"

### Requirement: Generación de PDF para Vales

El sistema DEBE permitir exportar vales de salida a PDF para impresión.

#### Scenario: Generar PDF de vale

- GIVEN que existe un vale de salida con 2 productos
- WHEN usuario hace clic en icono de descarga en la tabla
- THEN el sistema DEBE generar PDF con:
  - Número de vale (valeSalidaId)
  - Concepto del vale
  - Fecha de creación
  - Lista de productos con cantidades
  - Usuario que registró
  - Observaciones si existen
- AND descargar archivo al navegador

## MODIFIED Requirements

### Requirement: Relación entre Receta y Producto

(Previously: Las recetas se creaban solo para Platos en el módulo de restaurante)

Las recetas AHORA pueden vincularse a Productos del inventario. Una receta puede tener:
- productId = null (receta genérica sin producto asignado) O
- productId = id válido de Producto del inventario (receta generadora de producto)

#### Scenario: Receta vinculada a producto

- GIVEN que usuario crea receta "Refresco 1L" con productoId = "prod_123"
- WHEN se completa una orden de esa receta con cantidad 10
- THEN el sistema DEBE incrementar stock de producto "prod_123" en 10
- AND usar rendimiento de la receta para ajustar cantidades

#### Scenario: Receta sin producto (genérica)

- GIVEN que usuario crea receta "Mezcla Base" sin seleccionar producto
- WHEN se completa una orden de esa receta
- THEN no se incrementa stock de ningún producto (solo consumo de ingredientes)
- AND el registro es solo de trazabilidad/costos

## REMOVED Requirements

(No hay requirements removidos en este cambio, solo adiciones y modificaciones)

---

## Validaciones y Restricciones

### Validación de Datos de Entrada

- Nombre de receta: requerido, 1-160 caracteres, único en sistema
- Rendimiento: integer >= 1
- Cantidad en orden: integer >= 1
- Cantidad en vale: integer >= 1, no puede exceder stock disponible
- Concepto de vale: string 1-100 caracteres
- Desperdicio: float >= 0, <= 100

### Restricciones de Transición de Estado

- PENDIENTE → EN_PROCESO (aprobación, requiere stock)
- EN_PROCESO → COMPLETADA (completación, decrementa inventario)
- PENDIENTE | EN_PROCESO → CANCELADA (cancelación, sin reversión de inventario)
- COMPLETADA → (no permitidas transiciones)
- CANCELADA → (no permitidas transiciones)

---

## Índices de Base de Datos Recomendados

- ValeSalida: (estado, createdAt) para filtros y ordenamiento
- ValeSalida: (usuarioId) para auditoría por usuario
- OrdenProduccionHistorial: (ordenProduccionId, createdAt) para historial rápido
- Receta: (productoId) para búsquedas by producto final
