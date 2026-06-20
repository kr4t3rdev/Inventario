# Glosario de Términos

> Definiciones de términos de negocio y técnicos usados en el sistema.

---

## A

### Almacén
Espacio físico donde se almacenan productos. Cada almacén puede tener múltiples ubicaciones. Los movimientos entre almacenes se gestionan via **Transferencias**.

### Anticipo
Pago adelantado a un proveedor, empleado o cliente, que se descuenta contra compras o servicios futuros. Se registra con un estado (`PENDIENTE`, `PARCIAL`, `CANCELADO`) y puede tener movimientos asociados.

### Arqueo de Caja
Proceso de cierre de caja al finalizar un turno POS. Consiste en verificar que el efectivo y otros métodos de pago coincidan con el total de ventas registradas. Todo turno debe ser arqueado antes de cerrarse.

### Asiento Contable
Registro contable que documenta una transacción financiera. Los asientos pueden ser **automáticos** (generados por el sistema al registrar ventas, compras, etc.) o **manuales** (registrados directamente por el usuario económico).

---

## B

### Backup (Respaldo)
Copia de seguridad de la base de datos. El sistema soporta respaldos **completos** e **incrementales** con frecuencia configurable (semanal, diario, horario). Los respaldos se almacenan en Railway Volume o almacenamiento externo.

---

## C

### Categoría
Taxonomía jerárquica para clasificar productos. Soporta una estructura de árbol con un nivel de profundidad (categoría padre → subcategoría). Las categorías pueden tener prefijos EAN-13 configurados.

### Cierre Contable
Proceso de cierre de un período contable. Una vez cerrado, no se pueden modificar los movimientos de ese período sin una **re-apertura** autorizada y auditada.

### Cliente
Entidad (persona natural o jurídica) que realiza compras. Los clientes pueden tener cuentas por cobrar asociadas.

### Código EAN-13
Código de barras estándar de 13 dígitos. El sistema puede generar códigos EAN-13 automáticamente basados en un prefijo de categoría y un contador secuencial. Se configura en **Mi Empresa** y por **Categoría**.

### Cuadre Diario
Reporte consolidado del día que resume ventas, gastos, ingresos y movimientos de caja para verificar la integridad financiera del día operativo.

### Cuenta Bancaria
Registro de una cuenta bancaria de la empresa. Incluye número de cuenta, nombre del banco, moneda, tipo (ahorro/corriente) y estado activo/inactivo.

### Cuenta por Cobrar
Monto que un cliente debe a la empresa, originado típicamente de una venta a crédito o factura. Tiene un estado: `PENDIENTE`, `PARCIAL`, `PAGADA`, `VENCIDA`.

### Cuenta por Pagar
Monto que la empresa debe a un proveedor. Puede ser de tipo comercial (compra de productos) o no comercial (servicios, gastos).

---

## D

### Defectación
Catálogo de defectos o problemas predefinidos usados en el taller de reparaciones y en el control de calidad.

### Deuda Cash
Deuda de caja registrada. Representa una obligación financiera que la empresa debe saldar. Se gestiona junto con **Préstamos Cash** e **Inyecciones de Capital**.

---

## E

### Empleado
Persona registrada en el sistema con datos laborales (salario base, cargo, fecha de contratación). No es lo mismo que un **User**: un empleado puede tener o no una cuenta de usuario en el sistema.

---

## F

### Factura
Documento fiscal que formaliza una venta. Se asocia a una **Serie de Facturación** y tiene un estado: `PENDIENTE`, `PAGADA`, `VENCIDA`, `CANCELADA`.

### Feature Flag
Indicador booleano en el plan de suscripción que habilita o deshabilita módulos del sistema. Se define en `Plan.features` (JSON) y se verifica via `requireFeature()`.

---

## G

### Gasto D/E (Distribución y Explotación)
Gastos operativos de la empresa. Se clasifican por **Concepto** (tipo de gasto) y **Elemento** (subclasificación). Se usan para el cálculo de costos y rentabilidad.

---

## I

### Inyección de Capital
Aporte de capital a la empresa, sea de socios o mediante préstamo. Puede incluir tasa de interés, plazo y calendario de pagos.

---

## L

### Licencia
Autorización para usar el sistema. Puede ser una licencia individual (asociada a un usuario) o una **TenantLicense** (asociada a una empresa). Determina el plan activo y sus límites.

### Lista de Precios
Conjunto de precios para productos. Una empresa puede tener múltiples listas (ej: "Precio Mayorista", "Precio Minorista", "Precio Promoción").

---

## M

### Merma
Pérdida o ajuste de inventario. Puede ser por vencimiento, rotura, robo, error de inventario, o ajuste contable. Se registra con tipo, cantidad y motivo.

### Mi Empresa
Configuración del perfil del negocio: nombre, dirección, NIT, logo, y opciones como generación de código EAN-13.

### Multi-tenant
Arquitectura donde múltiples empresas (tenants) comparten la misma instancia del sistema pero con datos aislados via `tenantId`.

---

## N

### Nómina
Registro de pagos de salario a empleados. Incluye salario base, comisiones, deducciones y bonificaciones. Se gestiona en el módulo **Pago de Salario**.

### Notificación
Alerta del sistema. Puede ser por stock mínimo, licencia próxima a vencer, factura vencida, etc. Se muestra en el centro de notificaciones.

---

## O

### Oferta
Promoción comercial. Puede ser por producto específico, por categoría, o por monto de compra. Incluye tipo de descuento (porcentaje, monto fijo) y fechas de vigencia.

### Onboarding
Flujo de registro inicial de un nuevo usuario. Puede incluir verificación de email, selección de tipo de usuario, selección/creación de empresa, y aprobación por manager.

### Orden de Producción
Autorización para producir una cantidad de un producto basado en una **Receta**. Incluye seguimiento de estado (`PENDIENTE`, `EN_PROCESO`, `COMPLETADO`).

---

## P

### Período Contable
Intervalo de tiempo (mensual, anual) para el cual se registran y cierran las operaciones contables. Estados: `ABIERTO`, `CERRADO`, `BLOQUEADO`.

### Plan de Suscripción
Define precios, límites (usuarios, productos, almacenes) y features habilitados para un tenant.

### Préstamo Cash
Préstamo otorgado por la empresa a un tercero. Se registra con monto, interés, plazo y estado.

### Producto
Ítem del catálogo de inventario. Incluye nombre, código interno, EAN-13, costo actual, precio de venta, stock mínimo, e imágenes.

### Punto de Venta (POS)
Sucursal o punto físico donde se realizan ventas. Cada POS puede tener sus propios turnos y arqueos de caja.

---

## R

### Receta
Fórmula de producción que define qué productos (ingredientes) y qué cantidades se necesitan para producir un producto terminado.

### Reconciliación Bancaria
Proceso de verificación entre los movimientos registrados en el sistema (ventas, servicios, gastos) y los movimientos reales de la cuenta bancaria.

### Reparación
Orden de trabajo del taller de reparaciones. Incluye equipos, piezas, materiales, mano de obra y estado de avance.

### Reporte Financiero
Informe de indicadores financieros: rentabilidad, ingresos vs gastos, balance, proyecciones. Exportable a PDF/CSV.

---

## S

### Serie de Facturación
Secuencia numérica para facturación fiscal. Define prefijo (ej: "FAC-"), rango de números, y estado activo/inactivo. Una empresa puede tener múltiples series.

### Server Action
Función asíncrona marcada con `'use server'` que se ejecuta en el servidor. Es el mecanismo principal de comunicación backend-frontend.

### Stock Ubicación
Registro de cantidad de un producto en una ubicación específica dentro de un almacén.

---

## T

### Tenant
Empresa u organización que usa el sistema. Es la unidad de aislamiento multi-tenant.

### Tasa de Cambio
Valor de conversión entre monedas (CUP→USD, USD→EUR, etc.). Se registra históricamente para permitir conversiones precisas en cualquier fecha.

### Transferencia
Movimiento de stock entre dos almacenes. Incluye origen, destino, productos, cantidades y estado (pendiente, completada, cancelada).

### Turno POS
Turno de trabajo de un empleado en un punto de venta. Cada turno tiene un arqueo de caja asociado.

---

## U

### Unidad de Medida
Unidad base para productos (kg, unidad, litro, metro, etc.). Cada producto tiene una unidad principal.

### Usuario (User)
Cuenta de acceso al sistema. Los usuarios tienen un rol (`admin`, `manager`, `economico`, `dependiente`) y pueden pertenecer a múltiples tenants.

---

## V

### Vale de Salida
Documento que autoriza la salida de materiales del almacén para producción. Se asocia a una **Orden de Producción**.

### Venta
Transacción comercial donde se entregan productos/servicios a cambio de un pago. Puede ser POS (contado) o facturada (crédito).

### Vendor (Proveedor)
Persona o empresa que provee productos o servicios al negocio. Tiene código interno único por tenant y puede tener múltiples compras asociadas.
