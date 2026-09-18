# Delta for Inventario — Paridad Odoo por Planes

## ADDED Requirements

### Requirement: Kardex auditable por producto y ubicación

The system MUST registrar cada movimiento de stock en `StockMoveLine`
de forma apendicular y MUST exponer el kardex filtrado por producto,
ubicación y rango de fechas con saldo acumulado y costo.

#### Scenario: Venta genera línea de kardex

* GIVEN un producto con disponible 10 en una ubicación
* WHEN se confirma una venta de 3 unidades
* THEN el sistema crea un `StockMoveLine` con `cantidad = -3`,
  `tipoOrigen = VENTA` y `origenId` = venta
* AND el kardex muestra la salida con saldo 7.

#### Scenario: Kardex cuadra con disponible

* GIVEN movimientos de compra (+10), venta (-3) y ajuste (-1)
* WHEN se consulta el kardex del producto y ubicación
* THEN la suma de cantidades es igual a `StockUbicacion.cantidadDisponible`.

#### Scenario: Movimiento inmutable

* GIVEN una línea de kardex creada
* WHEN se intenta editarla o eliminarla
* THEN el sistema lo rechaza; solo permite movimiento compensatorio nuevo.

### Requirement: Ajuste unificado con motivo y valorización

The system MUST permitir ajustes con motivo de catálogo y MUST
valorizarlos al costo vigente (CPP/FIFO) sin editar stock directo.

#### Scenario: Registrar sobrante con motivo

* GIVEN teórico 5 y contado 7 con motivo `SOBRANTE`
* WHEN se aplica el ajuste
* THEN se crea `StockMoveLine` con `+2` y `costoTotal` calculado
* AND el ajuste queda en estado `APLICADO` con usuario y fecha.

#### Scenario: Merma legacy genera ajuste

* GIVEN se registra una `Merma` existente de 2 unidades
* WHEN se guarda
* THEN el sistema crea además un `AjusteInventario` con motivo
  equivalente y su línea de kardex.

### Requirement: Conteo físico ciego en dos pasadas

The system MUST soportar conteo ciego con dos pasadas por usuarios
distintos y conciliación antes de ajustar.

#### Scenario: Doble conteo con diferencia

* GIVEN un conteo en `CONTEO_1` con 10 y `CONTEO_2` con 12
* WHEN el responsable concilia en 12
* THEN el sistema calcula varianza contra teórico y genera el ajuste
  correspondiente al pasar a `AJUSTADO`.

#### Scenario: Prohibir edición directa durante conteo

* GIVEN un conteo activo en una ubicación
* WHEN se intenta ajustar manualmente el mismo producto y ubicación
* THEN el sistema lo bloquea hasta conciliar o cancelar el conteo.

### Requirement: Órdenes de compra con recepción parcial

The system MUST (plan Profesional, flag `ordenes-compra`) permitir OC
con recepciones parciales y backorder, y MUST vincular la factura
(`CompraDocumento`) a la OC. El flujo de compra directa sin OC MUST
seguir funcionando.

#### Scenario: Recepción parcial deja backorder

* GIVEN una OC de 100 unidades en estado `CONFIRMADA`
* WHEN se registra una recepción de 60
* THEN la OC pasa a `PARCIAL` con pendiente 40
* AND una segunda recepción de 40 la pasa a `RECIBIDA`.

#### Scenario: Compra sin OC sigue válida

* GIVEN un tenant sin flag `ordenes-compra`
* WHEN registra `CompraDocumento` directa
* THEN el stock ingresa igual y genera su línea de kardex.

### Requirement: Reabastecimiento por reglas min/max

The system MUST (flag `reabastecimiento`) sugerir reposición cuando el
disponible cae bajo el mínimo, proponiendo OC o fabricación según si
el producto tiene receta.

#### Scenario: Sugerencia de compra bajo mínimo

* GIVEN regla min 10 / max 50 y disponible 8 sin receta
* WHEN se ejecuta la sugerencia
* THEN el sistema propone OC por 42 unidades.

### Requirement: Unidades con factor de conversión

The system MUST (flag `unidades-conversion`) convertir cantidades de
compra/venta a unidad stock mediante `factorAStock` antes de persistir
y de alimentar FIFO.

#### Scenario: Compra en caja y venta en unidad

* GIVEN `Unidad` caja con `factorAStock = 12`
* WHEN se compra 2 cajas
* THEN el ingreso a stock es 24 unidades con costo unitario prorrateado.

### Requirement: Lotes con vencimiento y FEFO

The system MUST (plan Profesional, flag `lotes-series`) asignar lote
en cada entrada y MUST descontar en salidas por FEFO (próximo a vencer
primero), con alerta de caducidad.

#### Scenario: Salida consume el lote próximo a vencer

* GIVEN lote A vence en 10 días con 5 y lote B en 60 días con 5
* WHEN se vende 6
* THEN se descuentan 5 de A y 1 de B, con trazabilidad a cada lote.

#### Scenario: Alerta de vencimiento

* GIVEN un lote que vence en menos de 30 días con disponible > 0
* WHEN se abre el panel de inventario
* THEN el sistema muestra la alerta con producto, lote y días restantes.

### Requirement: Variantes con SKU y stock propios

The system MUST (flag `variantes`) permitir plantilla con atributos y
variantes vendibles con SKU, precio y stock independientes. La
plantilla MUST NOT ser vendible ni mover stock.

#### Scenario: Venta de variante talla M

* GIVEN plantilla Remera con variantes S/M/L cada una con stock 5
* WHEN se vende 2 de M
* THEN solo la variante M baja a 3 y genera su kardex.

### Requirement: Ubicaciones anidadas nivel 1

The system MUST (flag `ubicaciones-avanzadas`) soportar jerarquía
almacén → zona/pasillo/estante para conteo y kardex, sin putaway
automático en Profesional.

#### Scenario: Kardex filtra por estante

* GIVEN stock en dos estantes del mismo almacén
* WHEN se filtra el kardex por un estante
* THEN solo muestra movimientos de esa ubicación hija.

### Requirement: MRP extendido Empresarial

The system MUST (plan Empresarial, flag `mrp-avanzado`) soportar BOM
multinivel (receta dentro de receta) y explosión de necesidades contra
disponible, generando sugerencias de OC y órdenes de producción.

#### Scenario: Explosión multinivel

* GIVEN producto P con receta que incluye subreceta S (2 unidades) y S
  requiere insumo I (3 unidades)
* WHEN se planifican 10 P
* THEN el sistema exige 20 S y 60 I y descuenta disponible antes de
  sugerir compra o fabricación.

## MODIFIED Requirements

### Requirement: Compras y FIFO respetan factor y lote

The system DEBE convertir a unidad stock antes de `allocateFifo` y
DEBE ordenar salidas por vencimiento (FEFO) cuando el producto usa
lotes. (Previously: FIFO puro por fecha de compra sin factor ni lote.)

#### Scenario: FIFO con factor

* GIVEN compra de 2 cajas x12 a costo 120 por caja
* WHEN se vende 12 unidades
* THEN el costo asignado es 120 (12 x 10 por unidad).

### Requirement: Gating de inventario por plan

The system DEBE proteger cada acción P1/P2 con `requireFeature` y
DEBE ocultar la opción en UI si el flag es falso, mostrando aviso de
actualización de plan. (Previously: transferencias/mermas sin gate
diferenciado.)

#### Scenario: Tenant Básico intenta crear OC

* GIVEN usuario Básico sin `ordenes-compra`
* WHEN llama a crear OC
* THEN recibe `FEATURE_NOT_AVAILABLE` y la UI ofrece cambiar de plan.
