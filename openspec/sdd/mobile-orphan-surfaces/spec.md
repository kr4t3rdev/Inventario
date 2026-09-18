# Spec: Superficies huérfanas y limpieza de código muerto

## Requisitos funcionales

### RF-1 — Detalle de producto navegable

DADO que el usuario ve el catálogo de Productos
CUANDO toca un producto
ENTONCES abre `ProductoDetailSurface` con el ID del producto y puede volver con "Volver".

### RF-2 — Stock masivo accesible

DADO que el usuario está en la pestaña Gestión
CUANDO pulsa "Stock Masivo"
ENTONCES abre `BulkStockSurface` con el adaptador de productos.

### RF-3 — Perfil accesible

DADO que el usuario está en la pestaña Configuración
CUANDO pulsa "Perfil"
ENTONCES abre `ProfileSurface` con usuario y cierre de sesión.

### RF-4 — Sin botón muerto "Contratos" en Configuración

La pestaña Configuración NO DEBE mostrar "Contratos". `ConfiguracionSurface` DEBE dejar de declarar `onSelectContratos`.

### RF-5 — Código muerto eliminado

Los archivos listados en H5 DEBEN desaparecer del repo junto a sus tests. No DEBE quedar ningún archivo fuente (no-test) sin importador, salvo los puntos de entrada de la app.

## Requisitos no funcionales

### RNF-1 — Suite verde

La suite DEBE mantenerse verde tras la limpieza (se restan los tests de archivos eliminados; los tests de wiring nuevos equilibran).

### RNF-2 — Accesibilidad

El detalle de producto y el perfil DEBEN conservar sus `accessibilityLabel` y roles existentes.

## RFC 2119

- "DEBE" / "NO DEBE" expresan requisitos normativos.
- "DEBE conservar" expresa invariante de accesibilidad.