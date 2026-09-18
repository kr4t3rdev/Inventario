# Diseño del Módulo de Restaurante

## Overview

Módulo para gestionar un restaurante dentro del sistema de inventario existente. Incluye carta digital, elaboración de platos con recetas, control de producción y un nuevo sistema de ventas (POS) paralelo al actual.

## Enfoque Híbrido

- **Platos con receta**: Consumen inventario existente al producir
- **Productos preparados**: Platos independientes del inventario
- **Sistema paralelo**: POS restaurante separado del sistema de ventas actual

---

## 1. Estructura de Datos (Prisma)

### Modelos Principales

```prisma
// Categorías de la carta del restaurante
CategoriaPlato {
  categoriaPlatoId, nombre, descripcion, orden, activo
}

// Plato/Carta del restaurante
Plato {
  platoId, nombre, descripcion, precio, imagen, disponible
  categoriaPlatoId, tipoPlato (COMIDA/BEBIDA/POSTRE)
  esElaborado, recetaId, inventarioId
}

// Receta para platos elaborados
Receta {
  recetaId, nombre, rendimiento, costoUnitario
  instrucciones, tiempoPrep
}

// Ingredientes de una receta (vinculados al inventario)
RecetaIngrediente {
  recetaIngredienteId, recetaId, productoId
  cantidad, unidadId, desperdicio
}

// Mesas del restaurante
Mesa {
  mesaId, numero, capacidad, estado (DISPONIBLE/OCUPADA/RESERVADA)
}

// Comandas activas
Comanda {
  comandaId, mesaId, empleadoId, estado
  fechaApertura, fechaCierre, total
}

// Items de una comanda
ComandaItem {
  comandaItemId, comandaId, platoId
  cantidad, precioUnitario, notas, estado
  (PENDIENTE/EN_PROCESO/LISTO/SERVIDO)
}

// Órdenes de producción
OrdenProduccion {
  ordenProduccionId, recetaId, cantidad
  estado (PENDIENTE/COMPLETADA/CANCELADA)
  empleadoId, fechaProduccion, observaciones
}
```

---

## 2. Workflow

### Flujo 1: Crear un Plato (Carta)

1. **Crear categoría de plato** (Ej: "Entrantes", "Bebidas", "Postres")
2. **Crear plato nuevo**:
   - Nombre, precio, imagen, tipo
   - ¿Es elaborado? → SÍ/NO
3. **Si es elaborado → Crear receta vinculada**:
   - Rendimiento: X porciones
   - Agregar ingredientes del inventario
   - Definir cantidad y desperdicio (%)
4. **Sistema calcula automáticamente**:
   - Costo total = (precio ingrediente × cantidad) + desperdicio
   - Costo por porción = costo total / rendimiento
   - Margen = precio plato - costo porción

### Flujo 2: Producción (Elaboración)

1. **Iniciar producción**: Seleccionar receta, ingresar cantidad
2. **Sistema verifica stock**: Calcula ingredientes necesarios
3. **Si stock insuficiente → ALERTA** (no permite producir)
4. **Si hay stock**:
   - Descuenta ingredientes del inventario
   - Registra: fecha, cantidad, empleado, observaciones
5. **Opcional**: Registrar rendimiento real vs estimado

### Flujo 3: Venta en Restaurante (POS)

1. **Abrir mesa**: Seleccionar mesa disponible, asignar mesero
2. **Tomar orden**: Agregar platos de la carta
3. **Enviar a cocina**: Estado PENDIENTE → EN_PROCESO → LISTO
4. **Pago y cierre**:
   - Seleccionar método de pago
   - Generar factura (integra con contabilidad)
   - Cerrar mesa → Libera para próximo cliente

### Flujo 4: Inventario Híbrido

```
Sistema paralelo de productos:
├── Productos del inventario general (tienda)
│   └── Se compran, se venden retail
│
└── Platos del restaurante
    ├── Con receta → consume inventario al producir
    ├── Sin receta → producto preparado independiente
    └── Ej: "Refresco" (compra directa, no requiere producción)
```

---

## 3. Diagrama de Relaciones

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Plato     │────▶│   Receta    │────▶│ RecetaIng   │
│ (Carta)     │     │ (Elaborac)  │     │(Inventario) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│   Comanda   │                         │  Producto   │
│ (POS/Venta) │                         │(Inventario) │
└─────────────┘                         └─────────────┘
       │
       ▼
┌─────────────┐
│   Factura   │
│(Contabilidad)│
└─────────────┘
```

---

## 4. API Routes

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/restaurante/categorias` | GET, POST | CRUD categorías de carta |
| `/api/restaurante/categorias/[id]` | GET, PUT, DELETE | Gestión categoría |
| `/api/restaurante/platos` | GET, POST | CRUD platos |
| `/api/restaurante/platos/[id]` | GET, PUT, DELETE | Gestión plato |
| `/api/restaurante/recetas` | GET, POST | CRUD recetas |
| `/api/restaurante/recetas/[id]` | GET, PUT, DELETE | Gestión receta |
| `/api/restaurante/recetas/[id]/ingredientes` | GET, POST, DELETE | Ingredientes de receta |
| `/api/restaurante/produccion` | GET, POST | Órdenes de producción |
| `/api/restaurante/produccion/[id]` | GET, PUT | Completar/cancelar orden |
| `/api/restaurante/mesas` | GET, POST | CRUD mesas |
| `/api/restaurante/mesas/[id]` | GET, PUT | Actualizar estado mesa |
| `/api/restaurante/comandas` | GET, POST | CRUD comandas |
| `/api/restaurante/comandas/[id]` | GET, PUT | Gestionar comanda |
| `/api/restaurante/comandas/[id]/items` | POST | Agregar items |
| `/api/restaurante/comandas/[id]/cerrar` | POST | Cerrar comanda y facturar |
| `/api/restaurante/ventas` | GET | Historial de ventas restaurante |

---

## 5. Componentes Frontend

- **CartaManager**: CRUD de platos y categorías
- **RecetaEditor**: Editor de recetas con búsqueda de productos
- **ProduccionPanel**: Panel de órdenes de producción
- **RestaurantePOS**: Interfaz de ventas (mesas, comandas)
- **MesaGrid**: Grid visual de mesas con estado

---

## 6. Integraciones

- **Inventario**: Al producir se descuenta stock
- **Contabilidad**: Las ventas generan facturas
- **Empleados**: Asignar meseros a comandas
- **Notificaciones**: Alertas de stock bajo para recetas

---

## 7. Pendientes de Decisión

- [ ] ¿Usar modelo de mesas predefinidas o dinámico?
- [ ] ¿Impresión de comandas a cocina? (API física)
- [ ] ¿Reportes específicos para restaurante?
- [ ] ¿Manejo de propinas?
