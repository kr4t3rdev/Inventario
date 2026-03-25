# Production Module Specification

## Purpose

Este módulo gestiona el proceso de producción de la empresa, incluyendo la definición de recetas para productos elaborados, órdenes de producción, registro de consumo de materia prima, costos de producción, y vales de salida de productos terminados o materiales por diversos conceptos.

## Requirements

### Requirement: Gestión de Recetas para Productos

El sistema DEBE permitir crear, editar y eliminar recetas para productos elaborados (similar a las elaboraciones de restaurante pero para productos del inventario).

#### Scenario: Crear receta para producto exitosamente

- GIVEN que el usuario accede al formulario de creación de receta
- WHEN selecciona un producto del inventario como producto final, ingresa cantidad a producir (rendimiento), y agrega materiales del inventario con sus cantidades
- THEN el sistema DEBE guardar la receta asociada al producto
- AND mostrar un mensaje de confirmación de creación exitosa

#### Scenario: Ejemplo de producción - Refresco Instantáneo

- GIVEN que se desea crear una receta para "Refresco Instantáneo 1L Sin marca"
- WHEN el usuario crea la receta con:
  - Producto final: debe seleccionarse del inventario existente
  - Rendimiento: 1 unidad
  - Ingrediente: "Refresco Instantáneo 20g" cantidad: 1
- THEN el sistema DEBE generar el producto terminado
- AND el producto generado debe aparecer en el inventario existente

#### Scenario: Crear receta con material duplicado

- GIVEN que el usuario intenta agregar un material que ya existe en la receta
- WHEN selecciona un material que ya está en la lista de ingredientes
- THEN el sistema DEBE rechazar la adición y mostrar un mensaje de error indicando que el material ya existe

#### Scenario: Editar rendimiento de receta

- GIVEN que existe una receta con rendimiento de 10 unidades
- WHEN el usuario cambia el rendimiento a 20 unidades
- THEN el sistema DEBE actualizar automáticamente las cantidades de ingredientes según el nuevo rendimiento
- AND mostrar un mensaje de confirmación

### Requirement: Productos Elaborados en el Inventario

El sistema DEBE permitir que los productos elaborados (resultado de una receta) aparezcan en el inventario existente.

#### Scenario: Producto final en inventario

- GIVEN que se ha creado una receta con producto final "Refresco Instantáneo 1L Sin Marca"
- WHEN el usuario accede al inventario de productos
- THEN el sistema DEBE mostrar el producto en el inventario
- AND el producto debe ser seleccionable en operaciones de inventario (ventas, transferencias, etc.)

#### Scenario: Usar producto elaborado en otra receta

- GIVEN que existe un producto elaborado en el inventario resultado de una producción anterior
- WHEN el usuario crea una nueva receta
- THEN el sistema DEBE permitir seleccionar ese producto como ingrediente

### Requirement: Órdenes de Producción

El sistema DEBE permitir crear, aprobar y gestionar órdenes de producción.

#### Scenario: Crear orden de producción

- GIVEN que existen recetas definidas en el sistema
- WHEN el usuario crea una nueva orden de producción seleccionando una receta, cantidad a producir, y fecha objetivo
- THEN el sistema DEBE crear la orden con estado "pendiente"
- AND calcular automáticamente los materiales requeridos según la receta y cantidad

#### Scenario: Validar disponibilidad de materiales

- GIVEN que el usuario intenta aprobar una orden de producción
- WHEN la cantidad de materiales requeridos excede el inventario disponible
- THEN el sistema DEBE mostrar un mensaje de advertencia con los materiales faltantes
- AND no permitir aprobar la orden hasta que se disponga de los materiales suficientes

#### Scenario: Aprobar orden de producción

- GIVEN que existe una orden de producción con materiales suficientes
- WHEN el usuario aprueba la orden
- THEN el sistema DEBE cambiar el estado a "en_proceso"
- AND registrar la reserva de materiales del inventario

#### Scenario: Completar orden de producción

- GIVEN que una orden está en estado "en_proceso"
- WHEN el usuario registra la producción completada y confirma
- THEN el sistema DEBE cambiar el estado a "completada"
- AND incrementar el inventario del producto terminado
- AND decrementar el inventario de los materiales utilizados

### Requirement: Vales de Salida de Productos

El sistema DEBE permitir registrar la salida de productos del inventario por diversos conceptos (similar a los vales de gasto pero para productos).

#### Scenario: Crear vale de salida con conceptos de GastosDE

- GIVEN que existen tipos de GastosDE configurados en el sistema
- WHEN el usuario crea un nuevo vale de salida de productos
- THEN el sistema DEBE mostrar los conceptos disponibles (derivados de los tipos de GastosDE)
- AND permitir seleccionar un concepto de la lista para el vale

#### Scenario: Registrar vale de salida de productos

- GIVEN que el usuario accede al formulario de vale de salida
- WHEN selecciona el concepto (ej: "Mantenimiento", "Arrendamiento", etc.), agrega productos con cantidades, y guarda
- THEN el sistema DEBE crear el vale de salida
- AND decrementar el inventario de los productos especificados
- AND registrar el vale con el concepto seleccionado

#### Scenario: Vale de salida sin concepto de GastosDE

- GIVEN que se necesita un concepto no existente en GastosDE
- WHEN el usuario intenta crear un vale y no hay conceptos disponibles
- THEN el sistema DEBE permitir crear el vale con concepto libre (especificado manualmente)

#### Scenario: Validar disponibilidad para vale de salida

- GIVEN que el usuario intenta crear un vale de salida
- WHEN la cantidad de algún producto excede el inventario disponible
- THEN el sistema DEBE mostrar un mensaje de error indicando la cantidad disponible
- AND no permitir crear el vale hasta ajustar las cantidades

### Requirement: Historial de Vales de Salida

El sistema DEBE mantener un registro de todos los vales de salida y permitir consultarlos.

#### Scenario: Consultar historial de vales

- GIVEN que existen vales de salida en el sistema
- WHEN el usuario accede al historial de vales
- THEN el sistema DEBE mostrar una lista con: número de vale, fecha, concepto, productos, cantidades, usuario que registró

#### Scenario: Filtrar vales por concepto

- GIVEN que existen vales de salida con diferentes conceptos
- WHEN el usuario filtra por un concepto específico
- THEN el sistema DEBE mostrar solo los vales de ese concepto

### Requirement: Costos de Producción

El sistema DEBE calcular y registrar los costos asociados a cada orden de producción.

#### Scenario: Calcular costo de materiales

- GIVEN que existe una orden de producción con consumo de materiales registrado
- WHEN se solicita el costo de producción
- THEN el sistema DEBE calcular automáticamente: suma de (cantidad consumida × costo unitario) de cada material

#### Scenario: Calcular costo unitario

- GIVEN que existe una orden de producción completada
- WHEN se solicita el reporte de costos
- THEN el sistema DEBE mostrar el costo unitario = costo total / cantidad producida

### Requirement: Estados de Producción

El sistema DEBE mantener un registro del ciclo de vida de cada orden de producción.

#### Scenario: Estados de orden de producción

- GIVEN una orden de producción en el sistema
- WHEN el usuario consulta el estado
- THEN el sistema DEBE mostrar uno de los siguientes estados: pendiente, en_proceso, completada, cancelada

#### Scenario: Historial de cambios de estado

- GIVEN que existe una orden de producción con cambios de estado
- WHEN el usuario consulta el historial
- THEN el sistema DEBE mostrar: estado anterior, estado nuevo, fecha del cambio, y usuario que realizó el cambio
