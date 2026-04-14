# Delta for catalogo

## ADDED Requirements

### Requirement: Official Mode MUST Use CLAS Selectors Instead Of Free Text

When `usaCodigoEan13` is enabled, the category form MUST replace manual CLAS text entry with curated selectors for the official catalog path.

#### Scenario: Official mode shows structured selectors

- GIVEN EAN-13 mode is enabled
- WHEN the category form opens
- THEN the form MUST show a CLAS section/category selector
- AND a dependent CLAS specific/subcategory selector derived from the first selection
- AND the user MUST NOT need to type CLAS names manually or rely on case-sensitive matching

#### Scenario: Saving in official mode sends both values

- GIVEN EAN-13 mode is enabled
- AND the user selected a valid CLAS category in the first selector
- AND the user selected a valid CLAS subcategory in the second selector
- WHEN the form is submitted
- THEN the system MUST persist both the category and the subcategory selected from CLAS

#### Scenario: Non-official mode remains unchanged

- GIVEN EAN-13 mode is disabled
- WHEN the category form opens
- THEN the current free-text category flow MAY remain available

### Requirement: Second Selector MUST Show Only Categories Or Specifics Matching The First Selector

The system MUST only expose category/subcategory options that belong to the section or category chosen in the first selector, and MUST keep both values aligned.

#### Scenario: Section filters the specific list

- GIVEN the user selects a CLAS section
- WHEN the specific selector opens
- THEN only categories or specifics belonging to that section MUST be available
- AND unrelated specifics MUST NOT be shown

#### Scenario: Selecting a specific reveals its section

- GIVEN the user selects a CLAS specific
- WHEN the form resolves the selection
- THEN the matching section MUST be shown or auto-selected
- AND the section/specific pair MUST remain consistent

#### Scenario: Changing the first selector refreshes the second selector

- GIVEN the user already selected a value in the second selector
- WHEN the user changes the section or category in the first selector
- THEN the second selector MUST refresh to only the corresponding options
- AND any stale second selection MUST be cleared before save

### Requirement: Official Mode MUST Reject Invalid Or Tampered CLAS Combinations

The system MUST reject any section/specific combination that does not belong to the same official CLAS path, whether it reaches the client or the API.

#### Scenario: Invalid section is blocked with exact toast

- GIVEN EAN-13 mode is enabled
- WHEN the selected section is not part of CLAS
- THEN the submit MUST be aborted
- AND the UI MUST show `Estas en modo generacion ean-13 por lo q categoria debe coincidir con las secciones declaradas en el clasificador`

#### Scenario: Invalid specific is blocked with exact toast

- GIVEN EAN-13 mode is enabled
- WHEN the selected specific does not belong to the chosen section
- THEN the submit MUST be aborted
- AND the UI MUST show `Estas en modo generacion ean-13 por lo q la subcategoria ingresada debe coincidir con el especifico declarado en el clasificador`

#### Scenario: Direct API bypass is rejected

- GIVEN EAN-13 mode is enabled
- WHEN a client sends create or update data with a section/specific pair outside CLAS
- THEN the API MUST respond with a validation error
- AND the category MUST NOT be persisted

### Removed Requirement: Manual CLAS Text Entry In Official Mode

Reason: the user now chooses from curated CLAS selectors instead of typing category names.

### Requirement: Dedicated Subcategory Form MUST Use Existing Category Hierarchy

The dedicated subcategory form MUST only allow selecting categories that already exist, and MUST derive the selectable subcategories from that existing parent selection.

#### Scenario: Subcategory creation requires an existing parent category

- GIVEN the user opens the subcategory form
- WHEN no existing category is selected
- THEN the form MUST NOT allow submission
- AND the user MUST be prompted to select an existing category first

#### Scenario: Subcategory options come from the selected category

- GIVEN the user selects an existing category
- WHEN the subcategory selector is shown
- THEN only subcategories belonging to that selected category MUST be displayed
- AND the form MUST NOT offer unrelated subcategories from other parents

### Requirement: First Product Surtido In EAN-13 MUST Start At 0000

When EAN-13 is enabled and the system needs to assign the first surtido for a section/específico pair with no existing products, the initial surtido MUST be `0000` instead of `0001`.

#### Scenario: New product branch starts at 0000

- GIVEN EAN-13 mode is enabled
- AND no products exist yet for the resolved section/específico pair
- WHEN the system resolves the next available surtido
- THEN it MUST return `0000`
- AND the generated product code MUST use that value as the first surtido in the branch

#### Scenario: Existing branch continues from 0000

- GIVEN EAN-13 mode is enabled
- AND a product already exists with surtido `0000` for the same section/específico pair
- WHEN the system resolves the next available surtido
- THEN it MUST return `0001`
- AND later products MUST continue incrementing sequentially from there

#### Scenario: Product preview reflects the first surtido baseline

- GIVEN the product form is preparing a new EAN-13 preview
- AND the section/específico pair has not generated products yet
- WHEN the preview code is assembled
- THEN the preview MUST show `0000` as the initial surtido baseline
- AND the visible EAN-13 preview MUST stay aligned with the actual generation rule

### Removed Requirement: First Product Surtido Starts At 0001

Reason: the initial surtido for a new EAN-13 product branch must begin at `0000` to match the desired product catalog configuration.