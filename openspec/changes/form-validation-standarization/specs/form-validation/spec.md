# Form Validation — Specification (New Domain)

## Purpose

Define los requisitos de validación de campos, mensajes de error y comportamiento de schemas Zod
para todos los forms de negocio del proyecto TCP.

---

## Requirements

### Requirement: Patrón de Mensajes de Error Obligatorios

Los mensajes de error para campos requeridos DEBEN seguir el patrón:
- Campos de texto/número: `"El campo {Nombre} no ha sido rellenado"`
- Campos de selección (Select/Combobox): `"El campo {Nombre} no ha sido seleccionado"` / `"...seleccionada"` (según género)

Los mensajes MUST NOT usar patrones informales como "escriba un...", "es requerido", "Ingrese...".

#### Scenario: Campo de texto obligatorio vacío

- GIVEN un form con un `<Input>` de texto obligatorio vacío
- WHEN el usuario intenta hacer submit
- THEN el `<FormMessage>` muestra `"El campo {Nombre} no ha sido rellenado"`

#### Scenario: Campo Select obligatorio sin selección

- GIVEN un form con un `<Select>` obligatorio sin valor seleccionado
- WHEN el usuario intenta hacer submit
- THEN el `<FormMessage>` muestra `"El campo {Nombre} no ha sido seleccionado/a"`

#### Scenario: Mensaje de error personalizado fuera del patrón

- GIVEN un schema con `required_error: "escriba un nombre"`
- WHEN se ejecuta la migración de este cambio
- THEN el `required_error` se actualiza a `"El campo Nombre no ha sido rellenado"`

---

### Requirement: Validación de Campos Numéricos

Los campos de importe/precio/monto DEBEN validar con `z.preprocess` para distinguir campo vacío de valor cero, y SHOULD incluir `.positive()`.

Los campos de cantidad entera (stock, cantidades) DEBEN incluir `.int()` para rechazar decimales.

#### Scenario: Campo de precio dejado vacío

- GIVEN un campo de precio con `z.preprocess` correctamente configurado
- WHEN el usuario deja el campo vacío y hace submit
- THEN el error es `"El campo {Nombre} no ha sido rellenado"`
- AND NO muestra "NaN" ni "Expected number, received nan"

#### Scenario: Campo de precio con valor cero

- GIVEN un campo de precio con `z.preprocess` y `.positive()`
- WHEN el usuario ingresa `0` y hace submit
- THEN el error es `"El {campo} debe ser mayor a 0"`

#### Scenario: Campo de stock con decimal

- GIVEN un campo de stock con `.int()`
- WHEN el usuario ingresa `2.5` y hace submit
- THEN el error es `"El stock debe ser un número entero"` o equivalente

---

### Requirement: Validación de Longitud Máxima en Campos Texto

Los campos de texto libre SHOULD tener `.max()` definido para prevenir inserciones inadecuadas en DB.

| Campo tipo | Límite recomendado |
|---|---|
| Nombre / título | 120 caracteres |
| Descripción corta | 300 caracteres |
| Descripción larga / motivo | 500 caracteres |
| Código / identificador | Según dominio |

#### Scenario: Campo nombre con texto excedido

- GIVEN un campo nombre con `.max(120)`
- WHEN el usuario ingresa más de 120 caracteres
- THEN el `<FormMessage>` muestra `"El {campo} no puede superar los {N} caracteres"`

---

### Requirement: Campos Opcionales Explícitos

Los campos no obligatorios DEBEN estar marcados visualmente en el label con `"(opcional)"`.
El schema Zod DEBE usar `.optional()` o `.optional().or(z.literal(''))` para dichos campos.

#### Scenario: Campo opcional vacío en submit

- GIVEN un campo marcado como `(opcional)` en el label
- WHEN el usuario lo deja vacío y hace submit (con el resto válido)
- THEN el submit se ejecuta correctamente
- AND NO aparece error de validación para ese campo

---

### Requirement: `value` controlado en inputs numéricos

Los inputs de precio/monto con default `undefined` DEBEN incluir `value={field.value ?? ''}` para prevenir el warning de React sobre componentes uncontrolled → controlled.

#### Scenario: Input de precio sin valor inicial

- GIVEN un `<Input type="number">` con `defaultValue: undefined`
- WHEN el componente monta
- THEN no aparece warning de React en consola sobre uncontrolled component
- AND el input se muestra visualmente vacío (no "0")
