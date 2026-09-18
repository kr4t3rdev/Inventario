# Spec: Alertas de Margen Bajo

## ADDED Requirements

### Requirement: Server Action para productos con margen bajo
El sistema DEBE proveer una Server Action que retorne los productos con margen por debajo del 10%.

#### Scenario: Productos con margen bajo (< 10%)
- **GIVEN** un tenant con 3 productos: A (precioVenta=100, precioCosto=60, margen=40%), B (precioVenta=100, precioCosto=95, margen=5%), C (precioVenta=100, precioCosto=110, margen=-10%)
- **WHEN** se invoca `getProductosMargenBajoAction()`
- **THEN** retorna B y C (margen < 10%)
- **AND** A no aparece (margen ≥ 10%)
- **AND** ordenados por margen ascendente (C primero, B segundo)

#### Scenario: Sin productos con margen bajo
- **GIVEN** todos los productos del tenant tienen margen ≥ 10%
- **WHEN** se invoca la action
- **THEN** retorna array vacío `items: []`

#### Scenario: Productos sin precio de venta
- **GIVEN** un producto con precioVenta = 0
- **WHEN** se invoca la action
- **THEN** el producto NO se incluye (precioVenta > 0 requerido)

#### Scenario: Filtrado por tenantId
- **GIVEN** un tenant A con un producto de margen 5%
- **AND** un tenant B con un producto de margen 2%
- **WHEN** el usuario del tenant A invoca la action
- **THEN** solo ve el producto del tenant A (margen 5%)

#### Scenario: Límite configurable
- **GIVEN** 15 productos con margen < 10%
- **WHEN** se invoca `getProductosMargenBajoAction({ limit: 10 })`
- **THEN** retorna máximo 10 productos

### Requirement: Widget de Margen Bajo en Dashboard
El sistema DEBE mostrar un widget en el dashboard principal con los productos de margen bajo.

#### Scenario: Widget con productos
- **GIVEN** el tenant tiene 3 productos con margen bajo
- **WHEN** el usuario accede al dashboard
- **THEN** se muestra una card "Productos con Margen Bajo"
- **AND** una tabla con los 3 productos ordenados por margen
- **AND** badges de color según el estado (🟢🟡🔴)

#### Scenario: Widget vacío
- **GIVEN** el tenant no tiene productos con margen bajo
- **WHEN** el usuario accede al dashboard
- **THEN** se muestra la card con mensaje "No hay productos con margen bajo"

#### Scenario: Widget con loading state
- **GIVEN** la query está cargando
- **WHEN** el usuario accede al dashboard
- **THEN** se muestra un skeleton loader

### Requirement: Notificación de margen bajo
El sistema DEBE crear notificaciones cuando se detectan productos con margen bajo.

#### Scenario: Notificación creada al detectar margen bajo
- **GIVEN** un producto con margen = 3% que no fue notificado en las últimas 24h
- **WHEN** se invoca `verificarMargenBajo()`
- **THEN** se crea una notificación tipo `margen_bajo`
- **AND** contiene el nombre del producto y el porcentaje de margen

#### Scenario: Dedup 24h
- **GIVEN** un producto fue notificado hace 2 horas
- **WHEN** se invoca `verificarMargenBajo()` nuevamente
- **THEN** NO se crea una nueva notificación para ese producto

#### Scenario: Sin notificación para productos saludables
- **GIVEN** un producto con margen = 25%
- **WHEN** se invoca `verificarMargenBajo()`
- **THEN** NO se crea notificación para ese producto
