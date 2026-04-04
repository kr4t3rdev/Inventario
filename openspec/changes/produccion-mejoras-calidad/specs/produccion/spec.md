# Delta for Producción — Mejoras de Calidad

## ADDED Requirements

### Requirement: Confirmación antes de acciones de estado irreversibles

El sistema DEBE mostrar un diálogo de confirmación antes de ejecutar Aprobar, Completar o Cancelar una orden de producción.

#### Scenario: Confirmación al Aprobar

- GIVEN que existe una orden en estado PENDIENTE
- WHEN el usuario pulsa "Aprobar"
- THEN el sistema DEBE mostrar un dialog con el nombre de la receta y cantidad
- AND solo ejecutar `aprobarOrden` al confirmar
- AND no hacer nada si el usuario cancela

#### Scenario: Confirmación al Completar

- GIVEN que existe una orden en estado EN_PROCESO
- WHEN el usuario pulsa "Completar"
- THEN el sistema DEBE mostrar un dialog advirtiendo que se incrementará el stock del producto terminado
- AND solo ejecutar `completarOrden` al confirmar

#### Scenario: Confirmación al Cancelar

- GIVEN que existe una orden en estado PENDIENTE o EN_PROCESO
- WHEN el usuario pulsa "Cancelar"
- THEN el sistema DEBE mostrar un dialog advirtiendo que si estaba EN_PROCESO los materiales serán liberados
- AND solo ejecutar `cancelarOrden` al confirmar

---

### Requirement: Atomicidad en la creación de Vales de Salida

El sistema DEBE validar la disponibilidad de stock DENTRO de la transacción de base de datos al crear un vale de salida, eliminando la ventana de race condition entre validación y escritura.

#### Scenario: Validación dentro de transacción

- GIVEN dos requests simultáneos que crean vales con el mismo producto
- WHEN ambos pasarían la validación pre-transacción con stock suficiente
- THEN solo el primero en adquirir el lock DEBE completarse
- AND el segundo DEBE recibir error 400 con mensaje de stock insuficiente

#### Scenario: Rollback ante stock insuficiente detectado en transacción

- GIVEN un vale de salida con múltiples ítems
- WHEN dentro de la transacción el stock de cualquier ítem resulta insuficiente
- THEN el sistema DEBE hacer rollback completo de todos los decrementos
- AND retornar error 400 con detalle de los productos faltantes

---

### Requirement: Factor de desperdicio en el cálculo de costos de producción

El sistema DEBE incorporar el campo `desperdicio` de `RecetaIngrediente` en el cálculo del costo de materiales.

#### Scenario: Costo con desperdicio positivo

- GIVEN un ingrediente con cantidad 10 y desperdicio 0.10 (10%)
- WHEN se calcula el costo de producción
- THEN la cantidad efectiva usada DEBE ser `10 * (1 + 0.10) = 11`
- AND el costo total DEBE reflejar esa cantidad ajustada

#### Scenario: Ingrediente sin desperdicio

- GIVEN un ingrediente con `desperdicio = 0`
- WHEN se calcula el costo de producción
- THEN el cálculo DEBE ser idéntico al comportamiento actual

---

### Requirement: Conceptos de Vales desacoplados de GastosDE

El sistema DEBE permitir definir conceptos de vales de salida de forma independiente de los tipos de GastosDE, mediante un campo de texto libre con sugerencias.

#### Scenario: Concepto libre al crear vale

- GIVEN que el usuario está creando un vale de salida
- WHEN escribe un concepto que no existe en la lista de GastosDE
- THEN el sistema DEBE aceptar ese valor como concepto válido

#### Scenario: Sugerencias basadas en GastosDE

- GIVEN que existen tipos configurados en GastosDE
- WHEN el usuario abre el selector de concepto
- THEN el sistema DEBE mostrar esos tipos como opciones predefinidas seleccionables
- AND permitir también escribir uno diferente

#### Scenario: Creación de vale si GastosDE está vacío

- GIVEN que no existe ningún registro en GastosDE
- WHEN el usuario intenta crear un vale de salida
- THEN el sistema DEBE seguir permitiendo la creación con concepto libre
- AND NO fallar ni mostrar error por lista vacía

---

## MODIFIED Requirements

### Requirement: Costos de Producción _(modificado)_

El sistema DEBE calcular el costo incluyendo el factor de desperdicio por ingrediente.
(Anteriormente: solo consideraba `cantidad * precioCosto` sin desperdicio.)

#### Scenario: Cálculo de costo unitario con merma

- GIVEN una orden completada con ingredientes que tienen desperdicio configurado
- WHEN se consulta el costo de la orden
- THEN el costo unitario DEBE incluir el sobreconsumo por merma
- AND mostrarse en la vista de detalle de la orden
