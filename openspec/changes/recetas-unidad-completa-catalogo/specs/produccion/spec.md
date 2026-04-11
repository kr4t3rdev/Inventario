# Spec: Recetas — Unidad completa del producto de catálogo

## Feature Overview

Reorganizar la lógica de reconocimiento de unidades en recetas de producción para distinguir entre:

- unidades soportadas para conversión real, y
- unidades de catálogo que solo representan la unidad completa del producto en inventario.

El objetivo es que, cuando un producto del catálogo no usa una unidad convertible soportada, el sistema lo trate como consumo por unidad completa de inventario en lugar de bloquear la receta con error de unidad desconocida.

---

## Requirements

### REQ-01: Reconocimiento diferenciado de unidad de catálogo

**Descripción**: La unidad del producto en catálogo no debe evaluarse con la misma regla que la unidad ingresada en la receta.

**Criterios de aceptación**:
- Si la unidad del producto pertenece al conjunto soportado de masa, su categoría es `mass`
- Si la unidad del producto pertenece al conjunto soportado de volumen, su categoría es `volume`
- Si la unidad del producto es `unidad`, `pieza` o no pertenece al conjunto soportado de conversión, su categoría funcional para catálogo es `unit`
- Una unidad de catálogo fuera del conjunto soportado NO debe disparar por sí sola el error `unknown_unit`

---

### REQ-02: La unidad ingresada en la receta mantiene validación estricta

**Descripción**: La unidad elegida en la receta sigue validándose contra el conjunto soportado cuando el usuario pretende medir una fracción convertible del producto.

**Criterios de aceptación**:
- Si el usuario ingresa una unidad de masa no soportada, el sistema responde con `unknown_unit`
- Si el usuario ingresa una unidad de volumen no soportada, el sistema responde con `unknown_unit`
- Si el usuario deja la unidad vacía para un producto tratado como `unit`, el ingrediente es válido
- Si el usuario deja la unidad vacía para un producto tratado como `mass` o `volume`, el sistema mantiene el error `missing_unit`

---

### REQ-03: Productos de catálogo no convertibles se consumen como unidad completa

**Descripción**: Cuando el producto del catálogo no usa una unidad convertible soportada, la receta debe interpretarlo como consumo de unidades completas de inventario.

**Criterios de aceptación**:
- El ingrediente puede guardarse con `unidadSimbolo = null`, `unidad`, o `pieza`
- La cantidad del ingrediente representa cuántas unidades completas del producto de inventario se consumen
- El costo del ingrediente se calcula usando esa cantidad sin conversión adicional
- El descuento de stock en flujos de producción usa esa cantidad 1:1

---

### REQ-04: El formulario de creación no debe bloquear el caso de unidad completa

**Descripción**: El formulario de creación y edición de recetas debe acompañar el flujo dominante donde se consume el producto completo del inventario.

**Criterios de aceptación**:
- Al agregar un ingrediente cuyo producto de catálogo se trate como `unit`, el preview no debe bloquear por `unknown_unit`
- El botón de guardar receta no debe quedar deshabilitado en ese caso si no hay otros errores
- El mensaje de ayuda o normalización debe reflejar que la cantidad se guarda como unidades completas cuando corresponda

---

### REQ-05: Compatibilidad con conversión existente

**Descripción**: El cambio no debe romper el comportamiento actual de ingredientes realmente medibles en masa o volumen.

**Criterios de aceptación**:
- `g`, `kg`, `lb`, `oz` siguen comportándose como masa convertible
- `ml`, `L`, `fl oz`, `tsp`, `tbsp`, `cup` siguen comportándose como volumen convertible
- Las incompatibilidades entre masa y volumen siguen bloqueando el guardado
- Las normalizaciones entre unidades equivalentes siguen devolviendo `unitNormalizations`

---

### REQ-06: Regla explícita para el rendimiento de la receta

**Descripción**: El rendimiento de la receta representa cuántas unidades del producto final produce la cantidad completa de ingredientes usados, sin depender de que cada ingrediente sea una fracción del producto en inventario.

**Criterios de aceptación**:
- La cantidad del ingrediente puede representar unidades completas del inventario consumidas
- El rendimiento sigue siendo el divisor del costo unitario de la receta
- El cambio no obliga al usuario a expresar el ingrediente en subunidades convertibles cuando lo que usa es el producto completo

---

## Scenarios

### Scenario A: Producto de catálogo con unidad no soportada

``` 
DADO un producto de catálogo con unidad `paquete`
CUANDO se agrega como ingrediente en una receta con cantidad 2 y sin unidad ingresada
ENTONCES el sistema lo trata como categoría `unit`
Y el ingrediente es válido
Y se interpreta como consumo de 2 paquetes completos
```

### Scenario B: Producto medible sigue requiriendo unidad

``` 
DADO un producto de catálogo con unidad `kg`
CUANDO se agrega como ingrediente con cantidad 3 y unidad vacía
ENTONCES el sistema rechaza el ingrediente con error `missing_unit`
```

### Scenario C: Unidad ingresada no soportada sigue siendo error

``` 
DADO un producto de catálogo tratado como `unit`
CUANDO el usuario ingresa `docena` como unidad en la receta
ENTONCES el sistema responde con error `unknown_unit`
```

### Scenario D: Unidad completa no rompe costo ni stock

``` 
DADO un ingrediente con cantidad 4 y unidad de catálogo tratada como `unit`
CUANDO se calcula costo unitario y luego se aprueba una orden de producción
ENTONCES el costo usa la cantidad 4 sin conversión
Y el stock se descuenta 4 a 1
```

### Scenario E: Conversión soportada sigue funcionando

``` 
DADO un producto de catálogo con unidad `kg`
CUANDO el usuario ingresa 500 `g`
ENTONCES el ingrediente es válido
Y se normaliza a 0.5 `kg`
```

---

## Affected Areas

- `src/lib/validators/production-units.ts` — separar clasificación de unidad ingresada y unidad canónica del catálogo
- `src/app/busy/produccion/page.tsx` — reflejar en preview y bloqueo del form el nuevo criterio de unidad completa
- `src/app/api/produccion/recetas/[id]/ingredientes/route.ts` — aceptar el nuevo comportamiento al validar y normalizar ingredientes
- `src/lib/validators/production-units.test.ts` — cubrir la nueva semántica para unidades de catálogo no soportadas
- `src/app/busy/produccion/__tests__/unit-validation-e2e.test.ts` — cubrir que creación/edición no bloquean el caso de unidad completa