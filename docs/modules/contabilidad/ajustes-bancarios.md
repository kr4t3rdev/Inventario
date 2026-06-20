# Ajustes Bancarios, Anticipos, Deudas y Préstamos Cash

> **Submódulo de**: [Contabilidad](README.md)
> **Server Actions**: `actions-ajustes-bancarios.ts`, `actions-anticipos.ts`, `actions-deudas-cash.ts`, `actions-prestamos-cash.ts`, `actions-capital.ts`

---

## Ajustes Bancarios

> **Archivo**: `src/features/contabilidad/actions-ajustes-bancarios.ts`
> **Modelo**: `AjusteBancario`

Registro de ajustes y correcciones en cuentas bancarias. Se usan para regularizar diferencias entre el saldo registrado y el saldo real del banco.

**Campos**: cuenta bancaria, monto, tipo de ajuste, descripción, fecha, comprobante.

**Server Actions**: CRUD de ajustes bancarios.

---

## Anticipos

> **Archivo**: `src/features/contabilidad/actions-anticipos.ts`
> **Modelos**: `Anticipo`, `AnticipoMovimiento`, `Vendor`, `Cliente`

### Descripción

Gestión de anticipos a proveedores y anticipos de clientes. Los anticipos representan pagos adelantados que se descuentan contra compras o ventas futuras.

### Tipos de Anticipo

| Tipo | Dirección | Descripción |
|------|-----------|-------------|
| `PAGO` | Empresa → Tercero | Anticipo a proveedor (se descuenta de compras futuras) |
| `COBRO` | Tercero → Empresa | Anticipo de cliente (se descuenta de ventas futuras) |

### Estados

`PENDIENTE` → `PARCIAL` → `CANCELADO`

### Funcionalidades

- **Creación**: Registra anticipo con tipo, monto, moneda, proveedor/cliente, cuenta origen.
- **Ejecución**: Aplica parte o todo el anticipo a una compra/venta específica.
- **Reversión**: Revierte total o parcialmente un anticipo ejecutado.
- **Movimientos**: Cada ejecución/reversión crea un `AnticipoMovimiento` con trazabilidad.

### Server Actions

| Action | Propósito |
|--------|-----------|
| `getAnticiposAction` | Listar anticipos (filtros: tipo, estado, proveedor, moneda) |
| `getAnticipoByIdAction` | Obtener anticipo por ID |
| `createAnticipoAction` | Crear anticipo |
| `executeAnticipoAction` | Ejecutar (aplicar) anticipo |
| `reverseAnticipoAction` | Revertir anticipo |

### Reglas de Negocio

1. Feature flag: `anticipos` debe estar habilitado.
2. Un anticipo `PAGO` se asocia a un proveedor; uno `COBRO` a un cliente.
3. `montoEjecutar` no puede exceder el saldo pendiente del anticipo.
4. La ejecución requiere período contable abierto (`withPeriodValidation`).

---

## Deudas Cash

> **Archivo**: `src/features/contabilidad/actions-deudas-cash.ts`
> **Modelo**: `DeudaCash`, `PagoDeuda`, `Vendor`, `CuentaBancaria`, `TipoPago`

### Descripción

Registro y control de deudas de caja con proveedores. Incluye cálculo de intereses, pagos parciales, y seguimiento de saldo pendiente.

### Funcionalidades

- Registro de deuda con monto capital, tasa de interés, fecha de vencimiento.
- Pagos parciales con actualización de saldo pendiente.
- Cálculo automático de saldo pendiente e intereses.
- Reconciliación de pagos contra cuentas bancarias.

### Server Actions

| Action | Propósito |
|--------|-----------|
| CRUD deudas | Listar, crear, actualizar, eliminar deudas |
| `registrarPagoDeudaAction` | Registrar pago de deuda |

---

## Préstamos Cash

> **Archivo**: `src/features/contabilidad/actions-prestamos-cash.ts`
> **Modelo**: `PrestamoCash`, `PagoDeuda`

### Descripción

Gestión de préstamos otorgados por la empresa a terceros. Similar a deudas cash pero en dirección inversa (la empresa presta, no recibe).

### Server Actions

| Action | Propósito |
|--------|-----------|
| CRUD préstamos | Listar, crear, actualizar, eliminar préstamos |
| `registrarPagoPrestamoAction` | Registrar pago de préstamo |

---

## Inyecciones de Capital

> **Archivo**: `src/features/contabilidad/actions-capital.ts`
> **Modelos**: `InyeccionCapital`, `PagoDeuda`, `CuentaBancaria`

### Descripción

Registro de aportes de capital a la empresa, sea de socios o mediante préstamo. Incluye tasa de interés, plazo, calendario de pagos y seguimiento de saldo pendiente.

### Server Actions

| Action | Propósito |
|--------|-----------|
| `getInyeccionesCapitalAction` | Listar inyecciones |
| `createInyeccionCapitalAction` | Registrar nueva inyección |
| `registrarPagoCapitalAction` | Registrar pago de inyección |

---

## UI y Navegación

| Ruta | Tabs |
|------|------|
| `/busy/finanzas` | Anticipos, Deudas Cash, Préstamos Cash, Inyecciones de Capital |

## Permisos

| Acción | Rol |
|--------|-----|
| Ver | `admin`, `manager`, `economico` |
| Crear/Editar | `admin`, `manager` |
