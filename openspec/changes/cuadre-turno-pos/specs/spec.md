# Spec: Cuadre de Turno POS

## Contratos de Server Action

### `getCuadreTurnoAction` (NUEVA)

```typescript
// src/features/turnos-pos/actions-cuadre.ts

// Input
input: {
  turnoId: string;
}

// Output
{
  turno: {
    id: string;
    puntoDeVentaId: string;
    fondoInicialCup: number;       // centavos
    fondoInicialUsd: number;       // centavos
    fechaApertura: Date;
    tipo: string;
    empleado: { nombre: string; apellido: string } | null;
  };

  arqueo: {
    id: string;
    totalEfectivoCup: number;       // centavos
    totalEfectivoUsd: number;       // centavos
    totalTarjeta: number;           // centavos
    totalTransferencia: number;     // centavos
    totalCredito: number;           // centavos
    diferenciaCup: number;          // centavos
    diferenciaUsd: number;          // centavos
  } | null;

  totalVentaTurno: number;          // pesos — suma de Venta.total (incluye todos los métodos de pago)

  productos: Array<{
    id: string;
    nombre: string;
    codigoBarras: string | null;
    stockEnUbicacion: number;       // inventario actual en el PV
    vendidoEnTurno: number;         // cantidad vendida en este turno
    precioVenta: number;            // precio unitario en pesos
    restante: number;               // stockEnUbicacion (lo que queda después de cerrar)
    foto: string | null;            // primera foto del producto
    unidad: string | null;          // símbolo de unidad
  }>;

  resumen: {
    totalStock: number;             // suma de stockEnUbicacion
    totalVendido: number;           // suma de vendidoEnTurno
    totalVentaMonto: number;        // pesos — mismo que totalVentaTurno
  };
}
```

### `cerrarTurnoAction` (MODIFICADA — ya actualizada)

Ver spec de la fase anterior. Valida que exista arqueo y cierra el turno.

---

## Especificaciones Given/When/Then

### F1: Arqueo no cierra el turno

```
Given Un turno en estado ABIERTO
  And el usuario completa el arqueo de caja
When se ejecuta realizarArqueoAction
Then se crea el registro ArqueoCaja
  And el turno permanece en estado ABIERTO
  And fechaCierre sigue siendo null
```

### F2: Cierre requiere arqueo

```
Given Un turno en estado ABIERTO sin arqueo registrado
When se ejecuta cerrarTurnoAction
Then se rechaza con ActionError código NO_ARQUEO
  And el mensaje es "Debe realizar el arqueo de caja antes de cerrar el turno"
  And el turno permanece ABIERTO
```

### F3: Cierre exitoso con arqueo

```
Given Un turno en estado ABIERTO con arqueo registrado
When se ejecuta cerrarTurnoAction
Then el turno cambia a estado CERRADO
  And fechaCierre se establece
  And se retorna el turno actualizado
```

### F4: CuadreTurnoDialog — apertura post-arqueo

```
Given El usuario ha completado el arqueo de caja exitosamente
When se abre CuadreTurnoDialog con turnoId y puntoDeVentaId
Then se ejecuta getCuadreTurnoAction(turnoId)
  And se muestra:
    - datos del turno (POS, empleado, fondo inicial)
    - tabla de productos del PV con columnas:
      | Producto | Stock | Vendido | Precio Venta | Restante |
    - fila de totales: totalStock, totalVendido, totalVentaMonto
    - resumen del arqueo registrado (total efectivo contado CUP/USD)
    - diferencia: totalArqueo - totalVentaTurno
```

### F5: CuadreTurnoDialog — coincidencia arqueo = ventas

```
Given El cuadre del turno muestra totalVentaTurno = $853.00
  And el arqueo registrado suma $853.00
When se calcula la diferencia (arqueo - totalVentaTurno)
Then la diferencia es $0.00
  And el indicador de estado es VERDE (coincide)
  And el botón "Aprobar y Cerrar Turno" está HABILITADO
```

### F6: CuadreTurnoDialog — diferencia arqueo ≠ ventas

```
Given El cuadre del turno muestra totalVentaTurno = $853.00
  And el arqueo registrado suma $800.00
When se calcula la diferencia (arqueo - totalVentaTurno)
Then la diferencia es -$53.00
  And el indicador de estado es ROJO (diferencia)
  And todo el contenido del cuadre se muestra con borde/texto rojo
  And el botón "Aprobar y Cerrar Turno" está DESHABILITADO
  And se muestra el botón "Repetir Arqueo"
```

### F7: CuadreTurnoDialog — repetir arqueo

```
Given El cuadre del turno muestra diferencia ≠ 0
  And el usuario ve el botón "Repetir Arqueo"
When el usuario hace clic en "Repetir Arqueo"
Then CuadreTurnoDialog se cierra
  And ArqueoForm se abre con el mismo turnoId
  And el arqueo previo sigue existiendo (no se elimina)
  And el usuario puede hacer un nuevo arqueo
```

### F8: CuadreTurnoDialog — aprobar y cerrar

```
Given El cuadre del turno muestra diferencia = $0.00
  And el botón "Aprobar y Cerrar Turno" está HABILITADO
When el usuario hace clic en "Aprobar y Cerrar Turno"
Then se ejecuta cerrarTurnoAction(turnoId)
  And si es exitoso:
    - se muestra toast "Turno cerrado exitosamente"
    - CuadreTurnoDialog se cierra
    - el turno desaparece de la interfaz (turnoActivo = null)
    - onSuccess del padre se ejecuta
  And si falla:
    - se muestra mensaje de error en el diálogo
    - el diálogo no se cierra
```

### F9: CuadreTurnoDialog — lista de productos

```
Given El cuadre del turno está visible con productos cargados
When se renderiza la tabla de productos
Then cada fila muestra:
  - nombre del producto (con foto si tiene)
  - stockEnUbicacion (cantidad en inventario del PV)
  - vendidoEnTurno (cantidad vendida durante el turno)
  - precioVenta (precio unitario)
  - restante (stockEnUbicacion — lo que queda en inventario al cierre)
  And la última fila es de TOTALES:
    - suma de stockEnUbicacion
    - suma de vendidoEnTurno
    - suma de (vendidoEnTurno * precioVenta) = totalVentaTurno
```

### F10: CierreTurnoDialog — flujo sin arqueo

```
Given Un turno ABIERTO sin arqueo
  And se abre CierreTurnoDialog
When se renderiza el diálogo
Then se muestra:
  - resumen del turno (total ventas, tickets)
  - advertencia "Debe realizar el arqueo de caja"
  - botón "Cancelar" (cierra el diálogo)
  - botón "Ir a Arqueo" (abre ArqueoForm)
  - botón "Cerrar Turno" DESHABILITADO
```

### F11: CierreTurnoDialog — flujo con arqueo

```
Given Un turno ABIERTO con arqueo registrado
  And se abre CierreTurnoDialog
When se renderiza el diálogo
Then se muestra:
  - resumen del turno (total ventas, tickets)
  - indicador verde "Arqueo registrado"
  - botón "Cancelar"
  - botón "Cerrar Turno" HABILITADO
  - NO se muestra "Ir a Arqueo"
```

---

## Validaciones

| # | Condición | Respuesta esperada |
|---|-----------|-------------------|
| V1 | turnoId no existe o no pertenece al tenant | ActionError NOT_FOUND |
| V2 | turno no está ABIERTO | ActionError "El turno ya está cerrado" |
| V3 | turno sin ventas (productos vacío) | Cuadre con arrays vacíos, totales en 0 (no es error) |
| V4 | no hay arqueo registrado al llamar getCuadreTurnoAction | ActionError "Debe realizar el arqueo de caja primero" código NO_ARQUEO |
| V5 | producto sin stock (stockEnUbicacion = 0) | Se incluye igual en la lista para visibilidad |
| V6 | diferencia de arqueo exacta a 0 | Botón aprobar habilitado |

---

## Notas Técnicas

- `ventas` del turno se consultan desde `Venta` con `turnoId = turnoId` — suma `total` (está en pesos, no centavos)
- `stockEnUbicacion` se obtiene desde la tabla pivote `StockUbicacion` filtrando por `puntoDeVentaId = turno.puntoDeVentaId` y `cantidad > 0`
- `vendidoEnTurno` se calcula sumando `VentaItem.cantidad` para cada producto en las ventas del turno
- Un mismo producto puede aparecer en múltiples ventas del turno — se agrupa por `productoId`
- La foto del producto se toma de `producto.fotos[0]` (array de strings)
- `restante = stockEnUbicacion` — es el stock que queda después del turno (el inventario se descuenta al crear cada venta)
