# Delta for catalogo

## ADDED Requirements

### Requirement: Official Mode MUST Validate Root Categories Against CLAS Sections

When `usaCodigoEan13` is enabled, the system MUST validate every root category name against the official CLAS sections before persisting it.

#### Scenario: Invalid root category is blocked in the form

- GIVEN EAN-13 mode is enabled
- AND the user is creating or editing a root category with no `parentId`
- WHEN the entered `nombre` does not match any CLAS section
- THEN the submit MUST be aborted before the category API call
- AND the UI MUST show the toast `Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador`

#### Scenario: Root category remains flexible when official mode is off

- GIVEN EAN-13 mode is disabled
- WHEN the user saves a root category whose name is outside CLAS
- THEN the system MAY allow the save
- AND no CLAS-specific toast SHALL be shown

### Requirement: Official Mode MUST Validate Subcategories Against CLAS Specifics

When `usaCodigoEan13` is enabled, the system MUST validate every subcategory name against the official CLAS specifics before persisting it.

#### Scenario: Invalid subcategory is blocked in the form

- GIVEN EAN-13 mode is enabled
- AND the user is creating or editing a category with a valid `parentId`
- WHEN the entered `nombre` does not match any CLAS specific
- THEN the submit MUST be aborted before the category API call
- AND the UI MUST show the toast `Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador`

#### Scenario: Valid subcategory continues with normal save flow

- GIVEN EAN-13 mode is enabled
- AND the user enters a subcategory name that exists in CLAS
- WHEN the user submits the form
- THEN the CLAS validation MUST pass silently
- AND the existing server validation and save flow MUST continue

### Requirement: Category API MUST Enforce The Same Rule In Official Mode

The categories API MUST reject create and update requests that violate CLAS naming rules when `MiEmpresa.usaCodigoEan13` is enabled.

#### Scenario: Direct API create bypass is rejected

- GIVEN EAN-13 mode is enabled
- WHEN a client sends `POST /api/categorias` with an invalid root category or subcategory name
- THEN the API MUST respond with a validation error
- AND the category MUST NOT be persisted

#### Scenario: API remains permissive when official mode is off

- GIVEN EAN-13 mode is disabled
- WHEN a client sends create or update requests with names outside CLAS
- THEN the API SHALL preserve the current non-rigorous behavior