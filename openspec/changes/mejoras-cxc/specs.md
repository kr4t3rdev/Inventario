# Mejoras Cuentas por Cobrar — Especificaciones

## 1. Columna Saldo Pendiente

La columna "Pagado" DEBE ser reemplazada por "Pendiente" en la tabla de CxC.
- La nueva columna DEBE mostrar `saldoFactura` (totalFactura - totalPagadoFactura).
- Los valores DEBEN mostrarse en rojo cuando saldo > 0, en verde cuando saldo = 0.
- La columna "Total" DEBE permanecer.
- La columna "Saldo" DEBE permanecer (es el mismo valor, se unifica: una sola columna "Pendiente").

**Escenario: Tabla muestra saldo pendiente**
- Given una cuenta con total=1000 y pagado=300
- When se renderiza la tabla
- Then la columna "Pendiente" muestra $700.00 en rojo
- And la columna "Pagado" NO existe

## 2. Dashboard de Métricas

El dashboard DEBE mostrar cards de resumen arriba de la tabla:
- **Total Pendiente**: Suma de saldoFactura de cuentas no pagadas.
- **Por Vencer**: Cuentas sin fechaVencimiento o con fecha > hoy.
- **Vencidas**: Cuentas con fechaVencimiento < hoy y estado != PAGADA.
- **Total Cuentas**: Conteo total de cuentas.

Cada card DEBE tener icono, color, y formato monetario.
Los datos DEBEN calcularse del lado servidor y pasarse a la página.

**Escenario: Dashboard muestra métricas correctas**
- Given 3 cuentas: 2 pendientes (saldo 500 y 300) y 1 pagada (saldo 0)
- When se carga la página
- Then el dashboard muestra "Total Pendiente: $800"
- And "Total Cuentas: 3"

## 3. Búsqueda Textual

El schema `getCuentasPorCobrarSchema` DEBE aceptar un campo `search: string` opcional.
La query DEBE buscar por:
- `cliente.nombre` (contains, insensitive)
- `numeroFactura` (contains, insensitive)

El input de búsqueda en la UI DEBE usar este campo en lugar del filtro local actual.

**Escenario: Búsqueda por nombre de cliente**
- Given cuentas de "Juan Perez" y "Maria Gomez"
- When se busca "juan"
- Then solo se muestran las cuentas de "Juan Perez"

## 4. Aging de Saldos

El endpoint `getCuentasPorCobrarAction` DEBE enriquecer cada cuenta con:
- `diasTranscurridos`: Días desde `createdAt` hasta hoy.
- `rangoAntiguedad`: "0-30" | "31-60" | "61-90" | "90+"

La tabla DEBE mostrar una columna "Antigüedad" con badges de color:
- 0-30: verde "Al día"
- 31-60: amarillo "30+ días"
- 61-90: naranja "60+ días"
- 90+: rojo "90+ días"

Usar el mismo patrón que `computeAging()` en CxP.

**Escenario: Antigüedad se calcula correctamente**
- Given una cuenta creada hace 45 días
- When se carga la tabla
- Then la columna Antigüedad muestra "31-60" con badge amarillo

## 5. Paginación Real

La página DEBE usar paginación server-side en lugar de cargar 1000 registros.
- El default DEBE ser `limit: 20`, `page: 1`.
- La tabla DEBE mostrar controles de paginación (Anterior/Siguiente/número de páginas).
- Al cambiar de página, se DEBE llamar a `getCuentasPorCobrarAction` con la nueva página.
- El total de páginas DEBE venir del server.

**Escenario: Paginación cambia de página**
- Given 50 cuentas totales con limit=20
- When el usuario hace clic en "Siguiente"
- Then se llama a getCuentasPorCobrarAction({ page: 2, limit: 20 })
- And se muestran las siguientes 20 cuentas

## 6. Tests de createCuentaPorCobrarAction

SE DEBEN agregar tests para `createCuentaPorCobrarAction` cubriendo:
- AUTH_REQUIRED cuando no hay usuario
- NOT_FOUND cuando la venta no existe
- DUPLICATE cuando ya existe CxC para esa venta
- Creación exitosa con datos válidos

## 7. Tipado Fuerte

`enriquecerCuentaPorCobrar()` DEBE aceptar el tipo real de Prisma en lugar de `Record<string, unknown>`.
- Crear un tipo `CuentaPorCobrarRaw` que refleje la estructura con includes.
- Eliminar casts a `Record<string, unknown>`.
