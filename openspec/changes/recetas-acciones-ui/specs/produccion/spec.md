# Delta for Producción — Acciones UI de Recetas

## Context

Tabla de Recetas en `src/app/busy/produccion/page.tsx`. Backend completo disponible
(`GET /[id]`, `PATCH /[id]`, `POST /[id]/ingredientes`, `DELETE /[id]`) con hooks RTK Query listos.
Los botones Eye y Edit no tienen `onClick` — son botones muertos. Eliminar funciona sin confirmación.
El endpoint de ingredientes no aplica el factor `desperdicio` al calcular `costoUnitario`.

---

## ADDED Requirements

### Requirement: Dialog de detalle de receta (Ver)

El sistema DEBE mostrar un diálogo de solo lectura con el detalle completo de la receta al pulsar el botón Eye.

#### Scenario: Ver detalle exitoso

- GIVEN que existe una receta en la tabla
- WHEN el usuario pulsa el botón Eye
- THEN el sistema DEBE abrir un Dialog con: nombre, rendimiento, producto asociado, instrucciones, tiempo de preparación, y la lista de ingredientes con cantidad, desperdicio (%) y costo estimado por ingrediente
- AND mostrar el costo unitario total calculado con desperdicio

#### Scenario: Receta sin instrucciones

- GIVEN que una receta no tiene `instrucciones` ni `tiempoPrep`
- WHEN el usuario abre el dialog de detalle
- THEN el sistema DEBE omitir esos campos o mostrar "No especificado"

#### Scenario: Receta sin ingredientes

- GIVEN que una receta tiene 0 ingredientes
- WHEN el usuario abre el dialog de detalle
- THEN el sistema DEBE mostrar el mensaje "Sin ingredientes definidos"

---

### Requirement: Dialog de edición de receta (Editar)

El sistema DEBE permitir editar una receta completa (metadatos e ingredientes) al pulsar el botón Edit.

#### Scenario: Editar metadatos exitosamente

- GIVEN que existe una receta
- WHEN el usuario pulsa Edit, modifica nombre o rendimiento, y guarda
- THEN el sistema DEBE llamar `PATCH /recetas/[id]` con los campos modificados
- AND refrescar la lista de recetas al completarse

#### Scenario: Gestionar ingredientes en edición

- GIVEN que el dialog de edición está abierto
- WHEN el usuario agrega, elimina o modifica la cantidad/desperdicio de un ingrediente
- THEN al confirmar el sistema DEBE llamar `POST /recetas/[id]/ingredientes` con la lista completa actualizada
- AND el costo unitario en tabla DEBE reflejar el desperdicio

#### Scenario: Validación — nombre vacío

- GIVEN que el dialog de edición está abierto
- WHEN el usuario borra el nombre y pulsa Guardar
- THEN el sistema DEBE impedir el envío y señalizar el campo nombre como inválido

#### Scenario: Cancelar edición sin cambios

- GIVEN que el usuario modifica campos en el dialog de edición
- WHEN pulsa Cancelar
- THEN el sistema DEBE cerrar el dialog sin hacer ninguna llamada API
- AND la tabla no debe cambiar

---

### Requirement: Confirmación antes de eliminar receta

El sistema DEBE mostrar un `AlertDialog` de confirmación antes de ejecutar la eliminación de una receta.

#### Scenario: Confirmar eliminación

- GIVEN que existe una receta en la tabla
- WHEN el usuario pulsa el botón Eliminar
- THEN el sistema DEBE mostrar un AlertDialog con el nombre de la receta
- AND solo ejecutar `DELETE /recetas/[id]` al confirmar

#### Scenario: Cancelar eliminación

- GIVEN que el AlertDialog de confirmación está abierto
- WHEN el usuario pulsa Cancelar
- THEN el sistema DEBE cerrar el dialog
- AND la receta DEBE permanecer sin cambios

---

## MODIFIED Requirements

### Requirement: Cálculo de costoUnitario con factor desperdicio

(Previously: `costoUnitario` se calculaba como `Σ(precioCosto × cantidad)` sin desperdicio)

El endpoint `POST /recetas/[id]/ingredientes` DEBE calcular `costoUnitario` aplicando el factor desperdicio:
`costoIngrediente = precioCosto × cantidad × (1 + desperdicio)`.

#### Scenario: Ingrediente con desperdicio 10%

- GIVEN un ingrediente con `precioCosto = 10`, `cantidad = 5`, `desperdicio = 0.10`
- WHEN se guarda la lista de ingredientes
- THEN `costoUnitario` para ese ingrediente DEBE ser `10 × 5 × 1.10 = 55`
- AND el total de la receta DEBE sumar todos los ingredientes con sus respectivos factores

#### Scenario: Ingrediente con desperdicio 0 (backward compat)

- GIVEN un ingrediente con `desperdicio = 0`
- WHEN se guarda la lista de ingredientes
- THEN el cálculo DEBE producir el mismo resultado que antes: `precioCosto × cantidad`
