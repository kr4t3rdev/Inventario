# Design — VC Vuelto/cambio en el POS (Gap 3)

## Modelo de datos

```prisma
model Venta {
  // ... campos existentes ...
  /// Efecto recibido del cliente en efectivo (centavos; null = no aplica).
  montoRecibidoEfectivo  Int?
  /// Vuelto entregado (centavos; null = no aplica o cero).
  cambioDevuelto         Int?
  // ...
}
```

Decisión deliberada de **no** tocar el cuarteto `montoEfectivo/Tarjeta/Transferencia/Credito`:
esos montos son *lo retenido por la venta* (lo que el cajero se queda tras dar el vuelto) y son
los que el arqueo suma. Cambiarles la semántica rompería el cuadre histórico. Los nuevos campos
solo documentan la transacción física completa (recibido y devuelto).

Justificación frente a la alternativa única ("guardar recibido y derivar retenido"): la ruta
derivada exige reescribir cada lectura actual de `montoEfectivo` (arqueo, cuadre, reportes,
kardex financiero) y la persistencia directa del retenido ya existe y está probada. El precio
es una invariante explícita (`recibido = retenido + cambio`) que el schema Zod valida.

### Reglas aritméticas (server + UI)

```
si método incluye efectivo (EFECTIVO | MIXTO):
    exigido:   montoEfectivo = porción en efectivo (la misma de hoy)
    recibido ≥ montoEfectivo            // si no, cobro rechazado
    cambio = montoRecibidoEfectivo - montoEfectivo   // ≥ 0
si tarjeta / transferencia / crédito puros:
    montoRecibidoEfectivo = null, cambioDevuelto = null
```

Redondeos: todo centavo entero; sin redondeo adicional (la venta ya es entera).

## Captura del pago en el POS (hoy inexistente en el flujo rápido)

El Gap 3 incluye el **punto donde se captura el pago**, porque sin él el vuelto no tiene dónde
vivir. Decisión: un `pos-cobro-dialog.tsx` invocado desde "Cobrar" en `pv-interface`:

- Método: EFECTIVO / TARJETA / TRANSFERENCIA / CREDITO / MIXTO (componentes ya existen).
- Si hay efectivo: input "Recibido" (entero, centavos), vuelto vivo, botón Cobrar deshabilitado
  si recibido < porción en efectivo.
- Monto retenido por método, mismo patrón que hoy para MIXTO (los campos ya existen en el schema).
- Aplica tanto al flujo directo como al de factura (el diálogo de factura consume el panel
  compartido antes de emitir, o lo integra como paso previo).

El payload `CreateVentaInput` gana los dos campos opcionales; el servicio los persiste en el
`venta.create` (raíz única ya empleada por los flujos de pedido/factura).

## Interacción con el arqueo (sin cambio de fórmula)

- **Esperado de efectivo del turno**: Σ `montoEfectivo` (retenido) + ingresos manuales −
  reembolsos. No se añaden los campos nuevos a la fórmula.
- **Conteo físico del arqueo**: no cambia; el vuelto entregado ya salió del cajón antes del
  conteo, así que el esperado y el contado coinciden.
- **Cuadre diario**: sigue igual (el total del turno se calcula con lo retenido).
- Prueba de regresión explícita en T4: venta con vuelto no altera `esperadoEfectivoCup` ni los
  tests del cuadre.

Elegido frente a sumar lo recibido y luego restar el vuelto (equivale matemáticamente pero
duplica caminos y serializa la razón del vuelto en cada lugar); lo retenido es el valor
operativo canónico.

## Contrato de validación (Zod, `createVentaSchema`)

```
porcionEfectivo = montoEfectivo (si metodoPago usa efectivo), 0 en otro caso
montoRecibidoEfectivo && (montoRecibidoEfectivo >= porcionEfectivo)
si ambos montos: cambioDevuelto == montoRecibidoEfectivo - montoEfectivo (cuando se envíe)
```

El servidor deriva `cambioDevuelto` si solo llega `montoRecibidoEfectivo` (para que el cliente
mobile viejo, que no conoce el vuelto, siga funcionando con solo el recibido).

Email en UI y ticket solo cuando hay recibido (efectivo). Crédito y tarjeta no llevan vuelto.

## Guardas extra del service (sin cambiar semántica existente)

- Persistir los dos campos junto a los métodos de pago (misma tx del create).
- Registro en el audit ya existente (los montos de la venta cambian: recibido/cambio se
  anexan al detalle, sin acción nueva).
- `montoCredito` con crédito sin cliente → hoy ya se valida, fuera de alcance.

## Tests puros mínimos (`pos-cobro-calc.ts`)

- `calcularVuelto(recibido, aCobrar)` → número | null (null si n/a).
- `esCobroValido(metodo, montoEfectivo, recibido)` con MIXTO normalizado (solo efectivo puede
  soltar vuelto).

## Tests transversales a cubrir

- Venta en efectivo con recibido > total → persiste ambos campos; ticket imprime recibido/cambio.
- Recibido < porción → VALIDATION_ERROR, sin crear la venta.
- Recibido == total → cambio 0 (o null, mismo valor), ticket muestra "Cambio: $0".
- Tarjeta/crédito → campos null; sin input de recibido en el UI.
- Arqueo: con una venta con vuelto, `getEsperadosArqueoAction` devuelve el retenido (test de
  regresión del helper del turno).
- Mobile: la ruta existente que crea venta sin los campos sigue funcionando (regresión).
