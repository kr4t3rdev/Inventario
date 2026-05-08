# Productos - Server Actions Migration Specification

## Purpose

Define el comportamiento de las operaciones CRUD de productos usando Server Actions, incluyendo el manejo de stock y validaciones complejas.

## Requirements

### Requirement: Listar Productos (Server Component)

El sistema **DEBE** listar productos directamente desde el Server Component.

#### Scenario: Listado con filtros

- GIVEN parámetros de búsqueda opcionales (categoría, stock bajo, nombre)
- WHEN carga `/busy/products`
- THEN el page.tsx **DEBE** ser un Server Component
- AND **DEBE** aplicar filtros en la query de Prisma
- AND **DEBE** soportar paginación via query params

#### Scenario: Stock bajo

- GIVEN el filtro "stock bajo" activado
- WHEN se lista productos
- THEN solo **DEBEN** mostrarse productos donde `cantidad <= stockMinimo`

### Requirement: Crear Producto (Server Action)

El sistema **DEBE** proveer `createProductoAction()` que maneje la creación compleja de productos.

#### Scenario: Creación con categorías

- GIVEN datos de producto con categorías asignadas
- WHEN se ejecuta la Server Action
- THEN el producto **DEBE** crearse con sus relaciones
- AND las categorías **DEBEN** vincularse correctamente
- AND la respuesta **DEBE** incluir el producto completo con relaciones

#### Scenario: Código EAN13 duplicado

- GIVEN un producto con EAN13 "1234567890123" ya existe
- WHEN se intenta crear otro con el mismo EAN13
- THEN la acción **DEBE** retornar error de duplicado

### Requirement: Actualizar Stock (Server Action)

El sistema **DEBE** proveer `updateStockAction()` para actualizar stock mínimo y cantidad.

#### Scenario: Restock

- GIVEN un producto con cantidad 5 y stock mínimo 10
- WHEN se ejecuta `updateStockAction({ productoId, cantidad: 15 })`
- THEN la cantidad **DEBE** actualizarse a 15
- AND la alerta de stock bajo **DEBE** desaparecer

### Requirement: Upload de Imagen

El sistema **DEBE** manejar upload de imágenes de producto.

#### Scenario: Upload vía Server Action

- GIVEN un archivo de imagen válido
- WHEN se sube como parte de `createProductoAction` o `updateProductoAction`
- THEN la imagen **DEBE** procesarse
- AND **DEBE** almacenarse en el sistema de archivos o servicio de storage

#### Scenario: Upload separado

- GIVEN que Server Actions con archivos grandes pueden tener limitaciones
- WHEN se sube una imagen > 1MB
- THEN el sistema **PUEDE** usar una API route dedicada para uploads
- AND el Server Action solo **DEBE** recibir la URL de la imagen

## Data Flow

```
page.tsx (Server Component)
  ↓ await prisma.producto.findMany({ include: { categorias: true } })
  ↓ props
ProductList.tsx (Server/Client)
  ↓ onUpdate → updateProductoAction()
ProductForm.tsx (Client - React Hook Form)
  ↓ useTransition()
  ↓ Optimistic update con useOptimistic
```

## Edge Cases

- **Producto compuesto**: La creación **DEBE** validar que los ingredientes existan.
- **Precio negativo**: La validación **DEBE** rechazar precios <= 0.
- **Categoría inexistente**: Si se pasa un `catId` que no existe, **DEBE** retornar error.
