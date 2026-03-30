# Spec Delta: Sistema inicial de categorías (categorías en 0)

## Requirement: Configuración dual de catálogo
El sistema MUST permitir elegir una de dos opciones de clasificación para creación de productos.

### Scenario: Opción 1 - Clasificador oficial
- **GIVEN** usuario en configuración de catálogo
- **WHEN** selecciona `Clasificador oficial (Clas.exe)`
- **THEN** el sistema MUST usar estructura:
  - `proveedor`: consecutivo `00..99`
  - `seccion`: códigos predefinidos del clasificador
  - `especificos`: códigos predefinidos del clasificador
  - `surtido`: consecutivo `0000..9999`
- **AND** `surtido` MUST reiniciarse al cambiar `proveedor`.

### Scenario: Opción 2 - Estructura creada por usuario
- **GIVEN** usuario en configuración de catálogo
- **WHEN** selecciona `Estructura creada por el usuario`
- **THEN** el sistema MUST permitir taxonomía personalizada sin depender de `Clas.exe`
- **AND** la generación de código de negocio/EAN MUST quedar deshabilitada.

## Requirement: Comportamiento del formulario de producto según modo

### Scenario: Formulario en modo oficial
- **GIVEN** catálogo en modo oficial
- **WHEN** usuario crea producto
- **THEN** el formulario MUST mostrar preview de segmentos/código generado
- **AND** MUST aplicar lógica de construcción de código por proveedor-sección-específico-surtido.

### Scenario: Formulario en modo usuario
- **GIVEN** catálogo en modo usuario
- **WHEN** usuario crea producto
- **THEN** el formulario MUST ocultar o deshabilitar campos/preview de código de negocio y EAN
- **AND** MUST permitir guardar producto sin generación automática de código.

## Requirement: Comunicación explícita de modo activo

### Scenario: Indicador en catálogo y creación de producto
- **GIVEN** cualquier modo seleccionado
- **WHEN** usuario abre configuración o alta de producto
- **THEN** el sistema MUST mostrar etiqueta clara del modo activo
- **AND** explicar si aplica o no la generación automática de código.

## Validation Rules (RFC 2119)
| Rule | Strength |
|------|----------|
| Deben existir exactamente dos modos seleccionables | **MUST** |
| En modo oficial, surtido se reinicia por proveedor | **MUST** |
| En modo usuario, generación EAN/código no aplica | **MUST** |
| UI debe informar modo activo y su impacto | **SHOULD** |
