# Especificación: Módulo Ficha de Costo

**Change**: `add-cost-sheet-module`
**Fecha**: 2026-06-18
**Status**: Spec written

---

## 1. Overview

El módulo Ficha de Costo provee una vista calculada on-demand que consolida datos de costo dispersos (CompraDocumentoItem, GastoCompra, RecetaIngrediente, ProductoCostHistory) en una ficha unificada por producto. Para productos simples calcula el Costo Promedio Ponderado (CPP) desde las compras registradas; para productos compuestos desglosa materiales, mano de obra y costos indirectos. Incluye historial de costos de compra, comparación costo vs precio de venta con margen, y exportación a PDF. No crea nuevas entidades persistentes — todos los cálculos se realizan en vuelo desde datos existentes.

---

## 2. Functional Requirements

### FR-001: Ficha de costo de producto simple (CPP + margen)

El sistema DEBE calcular y mostrar la ficha de costo para productos simples (no compuestos) utilizando el método de Costo Promedio Ponderado (CPP).

**Comportamiento:**
- El CPP se calcula desde `CompraDocumentoItem` + `GastoCompra` de las compras del producto en los últimos 12 meses
- Fórmula: `CPP = Σ(cantidad × precioUnitario + gastos proporcionales) / Σ(cantidad)`
- La ficha DEBE mostrar: CPP actual, precio de costo registrado (`Producto.precioCosto`), precio de venta, margen absoluto y margen porcentual
- Si no existen compras registradas, la ficha DEBE mostrar un estado vacío con mensaje explicativo

#### Escenario: Producto simple con compras registradas

- GIVEN un producto "Harina 50kg" con `esCompuesto = false`
- AND existen 3 compras registradas en los últimos 12 meses: 100 unidades a 500 CUP, 200 unidades a 520 CUP, 50 unidades a 480 CUP
- AND gastos proporcionales totales: 3000 CUP
- WHEN el usuario accede a la ficha de costo del producto
- THEN el sistema DEBE mostrar CPP = ((100×500 + 200×520 + 50×480) + 3000) / (100+200+50) = 365.71 CUP (redondeado a 2 decimales)
- AND mostrar el margen calculado: `(precioVenta - CPP) / precioVenta × 100`

#### Escenario: Producto simple sin compras registradas

- GIVEN un producto "Nuevo Producto" con `esCompuesto = false`
- AND no existen registros en `CompraDocumentoItem` para este producto
- WHEN el usuario accede a la ficha de costo
- THEN el sistema DEBE mostrar un estado vacío
- AND un mensaje: "No hay compras registradas para calcular el costo"
- AND los campos de CPP y margen DEBEN mostrar "N/A"

#### Escenario: Producto con compras fuera de ventana de 12 meses

- GIVEN un producto con la última compra registrada hace 15 meses
- WHEN el usuario accede a la ficha de costo
- THEN el sistema DEBE mostrar CPP = 0 (sin datos en ventana)
- AND mostrar advertencia: "No hay compras en los últimos 12 meses"

---

### FR-002: Ficha de costo de producto compuesto (desglose)

El sistema DEBE calcular y mostrar la ficha de costo para productos compuestos (con receta) desglosando materiales, mano de obra y costos indirectos.

**Comportamiento:**
- Costo de materiales = `Σ(ingrediente.cantidad × CPP_del_ingrediente)` desde `RecetaIngrediente`
- Mano de obra: input manual del usuario (no persistido en MVP)
- Costos indirectos: input manual del usuario (no persistido en MVP)
- Costo total = materiales + mano de obra + indirectos
- La ficha DEBE mostrar el desglose completo con porcentajes de cada componente

#### Escenario: Producto compuesto con receta definida

- GIVEN un producto "Caja de Cigarrillos" con `esCompuesto = true`
- AND tiene una receta con 3 ingredientes: Tabaco (CPP=100, cantidad=5), Papel (CPP=20, cantidad=10), Filtro (CPP=15, cantidad=20)
- WHEN el usuario accede a la ficha de costo
- THEN el sistema DEBE mostrar costo de materiales = (5×100) + (10×20) + (20×15) = 1000 CUP
- AND mostrar campos editables para mano de obra e indirectos
- AND calcular costo total = materiales + MO + indirectos

#### Escenario: Producto compuesto sin receta

- GIVEN un producto con `esCompuesto = true`
- AND no tiene receta asociada
- WHEN el usuario accede a la ficha de costo
- THEN el sistema DEBE mostrar error: "Este producto no tiene receta definida"
- AND un enlace para crear la receta

#### Escenario: Ingrediente sin compras (CPP desconocido)

- GIVEN un producto compuesto con receta que incluye "Ingrediente X"
- AND "Ingrediente X" no tiene compras registradas
- WHEN el usuario accede a la ficha de costo
- THEN el sistema DEBE mostrar advertencia junto al ingrediente: "Sin datos de costo"
- AND el costo de materiales DEBE excluir este ingrediente del total
- AND mostrar nota: "X ingredientes sin costo calculado"

#### Escenario: Usuario ingresa mano de obra e indirectos

- GIVEN un producto compuesto con costo de materiales = 1000 CUP
- WHEN el usuario ingresa mano de obra = 300 CUP e indirectos = 150 CUP
- THEN el sistema DEBE recalcular: costo total = 1000 + 300 + 150 = 1450 CUP
- AND actualizar los porcentajes: materiales 68.97%, MO 20.69%, indirectos 10.34%
- AND recalcular margen vs precio de venta

---

### FR-003: Historial de costos de compra

El sistema DEBE mostrar un historial cronológico de los costos de compra del producto con trazabilidad completa.

**Comportamiento:**
- Listar todas las `CompraDocumentoItem` del producto ordenadas por fecha descendente
- Mostrar: fecha, proveedor, cantidad, precio unitario, total, moneda
- Paginación: 20 registros por página
- Filtros por rango de fechas y proveedor

#### Escenario: Historial con múltiples compras

- GIVEN un producto con 45 registros de compra en los últimos 6 meses
- WHEN el usuario abre la pestaña "Historial"
- THEN el sistema DEBE mostrar las primeras 20 compras (más recientes primero)
- AND mostrar controles de paginación (página 1 de 3)
- AND cada registro debe incluir: fecha, proveedor, cantidad, precio unitario, total y moneda

#### Escenario: Filtrar historial por rango de fechas

- GIVEN un producto con compras en enero, marzo y mayo de 2026
- WHEN el usuario filtra por rango "01/03/2026 - 31/03/2026"
- THEN el sistema DEBE mostrar solo las compras de marzo
- AND actualizar el conteo total de registros

#### Escenario: Historial vacío

- GIVEN un producto sin compras registradas
- WHEN el usuario abre la pestaña "Historial"
- THEN el sistema DEBE mostrar: "No hay registros de compra para este producto"

---

### FR-004: Comparación costo vs precio de venta

El sistema DEBE calcular y mostrar la comparación entre el costo calculado y el precio de venta actual, incluyendo margen absoluto y porcentual.

**Comportamiento:**
- Margen absoluto = `precioVenta - costoCalculado`
- Margen porcentual = `(precioVenta - costoCalculado) / precioVenta × 100`
- Si margen < 0, mostrar en rojo (pérdida)
- Si margen < 10%, mostrar en amarillo (margen bajo)
- Si margen >= 10%, mostrar en verde (margen saludable)

#### Escenario: Margen saludable

- GIVEN un producto con CPP = 500 CUP y precioVenta = 800 CUP
- WHEN se calcula el margen
- THEN mostrar margen absoluto = 300 CUP
- AND margen porcentual = 37.5%
- AND indicador visual verde

#### Escenario: Margen bajo

- GIVEN un producto con CPP = 750 CUP y precioVenta = 800 CUP
- WHEN se calcula el margen
- THEN mostrar margen absoluto = 50 CUP
- AND margen porcentual = 6.25%
- AND indicador visual amarillo

#### Escenario: Pérdida (margen negativo)

- GIVEN un producto con CPP = 900 CUP y precioVenta = 800 CUP
- WHEN se calcula el margen
- THEN mostrar margen absoluto = -100 CUP
- AND margen porcentual = -12.5%
- AND indicador visual rojo

#### Escenario: Precio de venta en cero

- GIVEN un producto con CPP = 500 CUP y precioVenta = 0
- WHEN se calcula el margen
- THEN el sistema DEBE mostrar margen = "N/A (sin precio de venta)"
- AND NO dividir por cero

---

### FR-005: Integración con vista de producto

El sistema DEBE proveer navegación desde la ficha de producto hacia la ficha de costo.

**Comportamiento:**
- Ruta: `/busy/productos/[id]/ficha-costo`
- Botón o enlace visible en la vista de detalle de producto
- El enlace DEBE estar disponible tanto para productos simples como compuestos
- La ficha de costo DEBE mostrar el nombre y código del producto en el encabezado

#### Escenario: Navegación desde ficha de producto

- GIVEN el usuario está viendo la ficha de detalle de un producto
- WHEN hace clic en el botón "Ver ficha de costo"
- THEN el sistema DEBE navegar a `/busy/productos/[id]/ficha-costo`
- AND cargar la ficha de costo del producto

#### Escenario: Acceso directo por URL

- GIVEN un producto con ID "abc123"
- WHEN el usuario accede directamente a `/busy/productos/abc123/ficha-costo`
- THEN el sistema DEBE cargar la ficha de costo correspondiente
- AND mostrar encabezado con nombre y código del producto

#### Escenario: Producto no existe

- GIVEN un ID de producto inexistente "xyz999"
- WHEN el usuario accede a `/busy/productos/xyz999/ficha-costo`
- THEN el sistema DEBE mostrar página de error 404
- AND mensaje: "Producto no encontrado"

---

### FR-006: Normalización de monedas CUP/USD

El sistema DEBE normalizar todos los valores monetarios a una moneda base utilizando las tasas de cambio del sistema de contabilidad (`ExchangeRate`).

**Comportamiento:**
- Si la compra está en CUP y la moneda base es CUP: sin conversión
- Si la compra está en USD y la moneda base es CUP: convertir usando `ExchangeRate` de la fecha de compra
- Si no existe tasa de cambio para la fecha, usar la tasa más reciente disponible
- Mostrar en la ficha la moneda original y el valor normalizado
- El CPP calculado SIEMPRE se presenta en la moneda base del tenant

#### Escenario: Compra en CUP con moneda base CUP

- GIVEN un tenant con moneda base CUP
- AND una compra de 100 unidades a 500 CUP
- WHEN se calcula el CPP
- THEN el valor normalizado = 500 CUP (sin conversión)

#### Escenario: Compra en USD con moneda base CUP

- GIVEN un tenant con moneda base CUP
- AND una compra de 100 unidades a 10 USD
- AND existe ExchangeRate para la fecha: 1 USD = 120 CUP
- WHEN se calcula el CPP
- THEN el valor normalizado = 10 × 120 = 1200 CUP por unidad

#### Escenario: Compra en USD sin ExchangeRate para la fecha

- GIVEN una compra registrada el 2026-01-15 en USD
- AND no existe ExchangeRate exacto para 2026-01-15
- AND existe ExchangeRate más cercano: 2026-01-10 con tasa 1 USD = 118 CUP
- WHEN se calcula el CPP
- THEN el sistema DEBE usar la tasa del 2026-01-10
- AND mostrar nota: "Tasa de cambio aproximada (10/01/2026)"

#### Escenario: Mezcla de compras en CUP y USD

- GIVEN un producto con 2 compras: 100 unidades a 500 CUP y 50 unidades a 10 USD (tasa: 120 CUP/USD)
- WHEN se calcula el CPP
- THEN CPP = (100×500 + 50×1200) / (100+50) = (50000 + 60000) / 150 = 733.33 CUP
- AND mostrar en el historial las monedas originales de cada compra

---

### FR-007: Exportación a PDF

El sistema DEBE permitir exportar la ficha de costo completa a formato PDF.

**Comportamiento:**
- El PDF DEBE incluir: datos del producto, CPP/costo calculado, desglose (si es compuesto), historial resumido, margen vs precio de venta
- Incluir fecha de generación en el PDF
- Nombre del archivo: `ficha-costo-{codigoProducto}-{fecha}.pdf`

#### Escenario: Exportar ficha de producto simple

- GIVEN el usuario está viendo la ficha de costo de un producto simple
- WHEN hace clic en "Exportar PDF"
- THEN el sistema DEBE generar un PDF con: encabezado del producto, CPP, precio de venta, margen, historial de últimas 10 compras
- AND descargar el archivo `ficha-costo-{codigo}-{fecha}.pdf`

#### Escenario: Exportar ficha de producto compuesto

- GIVEN el usuario está viendo la ficha de costo de un producto compuesto
- AND ha ingresado valores de mano de obra e indirectos
- WHEN hace clic en "Exportar PDF"
- THEN el PDF DEBE incluir el desglose completo: materiales, MO, indirectos, costo total y margen

---

### FR-008: Multi-tenant isolation

El sistema DEBE garantizar que cada usuario solo vea datos de su tenant.

**Comportamiento:**
- Todos los Server Actions DEBEN usar `requireTenant(user)` para filtrar datos
- Las compras, recetas y productos consultados DEBEN pertenecer al mismo tenant
- No debe haber fuga de datos entre tenants en ningún cálculo

#### Escenario: Usuario solo ve datos de su tenant

- GIVEN un usuario del tenant "A"
- AND el producto consultado pertenece al tenant "A"
- WHEN se calcula la ficha de costo
- THEN solo se incluyen `CompraDocumentoItem` del tenant "A"
- AND solo se incluyen `ExchangeRate` del tenant "A"

#### Escenario: Intento de acceso a producto de otro tenant

- GIVEN un usuario del tenant "A"
- WHEN intenta acceder a `/busy/productos/{id-tenant-B}/ficha-costo`
- THEN el sistema DEBE retornar error 404 (no 403, para no revelar existencia)

---

## 3. Non-Functional Requirements

### NFR-001: Performance

- El cálculo de ficha de costo DEBE responder en menos de 2 segundos para productos con hasta 500 registros de compra
- El historial paginado DEBE cargar en menos de 1 segundo por página

### NFR-002: Precisión monetaria

- Todos los cálculos monetarios DEBEN usar `Decimal` de Prisma (no `Float`)
- El redondeo al render DEBE ser a 2 decimales
- La suma de componentes desglosados DEBE coincidir con el total (sin errores de redondeo acumulados)

### NFR-003: Accesibilidad

- Los indicadores de margen (verde/amarillo/rojo) NO DEBEN depender exclusivamente del color — incluir texto o icono
- Los inputs de MO e indirectos DEBEN tener labels accesibles (ARIA)

### NFR-004: Estructura de código

- El módulo DEBE seguir la estructura: `src/features/ficha-costo/` con `actions.ts`, `lib/cost-calculator.ts`, `components/`
- La lógica de cálculo puro DEBE estar en `lib/cost-calculator.ts` (testeable sin dependencias de servidor)
- Los Server Actions DEBEN usar el wrapper `withAction`

---

## 4. Out of Scope (Explícitamente fuera)

| Ítem | Razón |
|------|-------|
| Persistencia de `FichaCosto` como entidad Prisma | MVP calcula on-demand; se evalúa en fase 2 |
| Costo estándar vs costo real (comparativa planificada/ejecutada) | Requiere modelo de planificación no existente |
| Integración con contabilidad para cierres de período | Fuera del scope de ficha individual |
| Actualización automática de `precioCosto` al registrar compras | Requiere cambio en módulo de compras (scope separado) |
| Gestión de listas de precios desde la ficha | Ya existe módulo `listas-precios` independiente |
| Persistencia de mano de obra e indirectos | MVP: inputs manuales no persistidos; modelo en fase 2 |
| Cálculo de merma esperada vs real | Requiere datos de producción no consolidados |
| Alertas automáticas por margen bajo | Puede agregarse en iteración posterior |

---

## 5. Acceptance Criteria

- [ ] **AC-01**: La ficha muestra CPP correcto para producto simple con ≥1 compra registrada (verificar con cálculo manual)
- [ ] **AC-02**: La ficha muestra desglose materiales + MO + indirectos para producto compuesto
- [ ] **AC-03**: El historial muestra timeline de costos de compra con fechas, montos y proveedores
- [ ] **AC-04**: El margen calculado coincide con `(precioVenta - CPP) / precioVenta × 100`
- [ ] **AC-05**: El PDF exportable contiene todos los datos de la ficha (producto, costo, margen, historial)
- [ ] **AC-06**: Multi-tenant: ficha solo muestra datos del tenant del usuario autenticado (verificar con 2 tenants)
- [ ] **AC-07**: Cálculo responde en <2s para producto con hasta 500 registros de compra
- [ ] **AC-08**: Compras en USD se normalizan a CUP usando ExchangeRate del sistema de contabilidad
- [ ] **AC-09**: Producto sin compras muestra estado vacío con mensaje explicativo (no error)
- [ ] **AC-10**: Los indicadores de margen usan color + texto/icono (accesibilidad)
- [ ] **AC-11**: Navegación desde ficha de producto a ficha de costo funciona correctamente
- [ ] **AC-12**: No se crean nuevas tablas en `prisma/schema.prisma` (100% aditivo, zero migration)

---

## 6. Scenarios Summary

| Requirement | Happy Path | Edge Cases | Error Cases | Total |
|-------------|-----------|------------|-------------|-------|
| FR-001 | 1 | 1 | 1 | 3 |
| FR-002 | 2 | 1 | 1 | 4 |
| FR-003 | 1 | 1 | 1 | 3 |
| FR-004 | 3 | 1 | 0 | 4 |
| FR-005 | 2 | 0 | 1 | 3 |
| FR-006 | 2 | 2 | 0 | 4 |
| FR-007 | 2 | 0 | 0 | 2 |
| FR-008 | 1 | 1 | 0 | 2 |
| **Total** | **14** | **7** | **4** | **25** |
