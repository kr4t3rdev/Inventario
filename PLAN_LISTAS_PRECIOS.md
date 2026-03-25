# Plan de Implementación: Listas de Precios Multi-Sucursal

## 1. Análisis y Diseño

### Objetivo
Permitir que un mismo producto tenga diferentes precios de venta dependiendo del listado de precios asignado. Estos listados se asociarán a los Puntos de Venta (Sucursales), permitiendo precios diferenciados por ubicación.

### Modelo de Datos (Prisma Schema)

Se introducirán dos nuevos modelos y se modificarán los existentes:

1.  **`ListaPrecio`**: Representa una lista de precios (ej. "General", "Sucursal Norte", "VIP").
    *   `id`: Identificador único.
    *   `nombre`: Nombre de la lista.
    *   `descripcion`: Descripción opcional.
    *   `esDefault`: Booleano para identificar la lista por defecto.
    *   `puntosDeVenta`: Relación con `PuntoDeVenta`.
    *   `precios`: Relación con `PrecioProducto`.

2.  **`PrecioProducto`**: Almacena el precio específico de un producto en una lista.
    *   `id`: Identificador único.
    *   `listaPrecioId`: FK a `ListaPrecio`.
    *   `productoId`: FK a `Producto`.
    *   `precio`: Valor del precio (Int/Decimal).
    *   **Constraint**: Unicidad en `[listaPrecioId, productoId]`.

3.  **Modificación en `PuntoDeVenta`**:
    *   Agregar `listaPrecioId`: FK a `ListaPrecio` (Opcional, si es null usa la default).

4.  **Modificación en `Producto`**:
    *   Relación con `PrecioProducto`.
    *   *Nota*: Se mantendrá `precioVenta` actual como "Precio Base" para compatibilidad.

### Diseño UI/UX (Siguiendo `ui-ux-pro-max`)

*   **Gestión de Listas (Configuración)**:
    *   Tabla con Shadcn UI para listar las listas de precios.
    *   Dialog/Modal para crear/editar listas (Nombre, Descripción).
    *   Estilo limpio, sin emojis, iconos SVG (Lucide), espaciado consistente.

*   **Edición de Producto**:
    *   En el formulario de producto (`productos-form.tsx`), añadir una sección "Precios por Lista".
    *   Grid o tabla simple donde se listen las listas activas y un input para definir el precio en esa lista.
    *   Si no se define, hereda el precio base.

*   **Configuración de Punto de Venta**:
    *   Dropdown (Select) en el formulario de Punto de Venta para asignar su "Lista de Precios".

## 2. Fases de Implementación

### Fase 1: Backend y Base de Datos
*   **Task 1.1**: Modificar `prisma/schema.prisma` agregando `ListaPrecio`, `PrecioProducto` y relaciones.
*   **Task 1.2**: Generar migración y aplicar cambios (`npx prisma migrate dev`).
*   **Task 1.3**: Crear API Endpoints para gestión de Listas de Precios (`/api/listas-precios`).
    *   `GET`: Listar todas.
    *   `POST`: Crear nueva.
    *   `PUT/DELETE`: Actualizar/Eliminar.
*   **Task 1.4**: Actualizar API de Productos (`/api/productos`) para recibir y guardar `precios` adicionales.
*   **Task 1.5**: Actualizar API de Puntos de Venta para guardar la asociación de la lista.

### Fase 2: Frontend - Gestión de Listas
*   **Task 2.1**: Crear Store Slice (Redux) o servicio RTK Query para `listasPreciosApi`.
*   **Task 2.2**: Crear página de administración de Listas de Precios (ruta sugerida: `/configuracion/listas-precios` o dentro de Inventario).
*   **Task 2.3**: Implementar componente de Tabla y Modal de Creación/Edición siguiendo guías de diseño.

### Fase 3: Integración en Productos y Puntos de Venta
*   **Task 3.1**: Modificar `productos-form.tsx`.
    *   Hacer fetch de las listas de precios disponibles.
    *   Agregar campos dinámicos para ingresar precios por lista.
*   **Task 3.2**: Modificar formulario de Punto de Venta para seleccionar la lista de precios asociada.

### Fase 4: Lógica de Venta (POS)
*   **Task 4.1**: Actualizar la lógica de búsqueda de productos en el POS.
    *   Al cargar el POS, identificar la `listaPrecioId` del Punto de Venta actual.
    *   Al buscar producto, priorizar el precio de `PrecioProducto` correspondiente a esa lista.
    *   Fallback: Si no existe precio en la lista, usar `producto.precioVenta`.

## 3. Verificación
*   Crear una lista "Sucursal B" con precios más altos.
*   Asignar "Sucursal B" a un Punto de Venta.
*   Verificar que al vender en ese Punto de Venta, los productos carguen con el precio de la lista "Sucursal B".
*   Verificar que en otro Punto de Venta sigan con el precio base.
