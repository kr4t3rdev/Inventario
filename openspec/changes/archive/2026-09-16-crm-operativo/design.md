# Design — CRM-OP (Gap 6)

## Modelo

```prisma
model Cliente {
  // ... campos existentes ...
  /// Máximo permitido de saldo vivo (ventas ENTREGADA/FACTURADA + CxC pendiente) - centavos.
  limiteCredito Int?

  // Notas y seguimiento comerciales
  notasCredito CobroNota[]
}

model CobroNota {
  id              String    @id @default(cuid())
  tenantId        String
  clienteId       String
  texto           String
  causa           String?  // 'llamada' | 'cobro pendiente' | 'cumpleaños' | ...
  fecha           DateTime? @default(now())
  recordingDate   DateTime @default(now())
  createdById     String
  cliente         Cliente   @relation(fields: [clienteId], references: [clienteId])
  tenant          Tenant    @relation(fields: [tenantId], references: [tenantId])
}
```

## Política de enforcement (servidor)

Al registrar la venta con método `CREDITO` o con `montoCredito > 0`, el servidor calcula:

```
saldoActualVivo = CxC.saldoAbierto + Σnotas de ventas vivas y sin cobro del mismo periodo
                 (Venta.estado == ENTREGADA/FACTURADA no anulada, sin factura ANULADA,
                  incluidas devoluciones: su total resta al saldo vivo)

si saldoActualVivo + montoCreditoActual > limiteCredito → RECHAZA con CREDITO_EXCEDIDO
  salvo que el usuario tenga el permiso `operaciones.clientes.credito.override` →
  pasa y se registra en AuditLog con los montos usados.
```

## Vista 360 (buscando metricas simples)

En `/busy/cliente/update/[id]` (o en la tarjeta del listado):

- Datos maestros.
- Caja vivo: deuda actual + créditos pendientes + últimos pagos.
- Historial de ventas con estado y factura/NC asociada.
- Devoluciones y anticipos aplicados.
- Últimas notas del seguimiento (si usa CobroNota).

## Riesgos

- **Compliance**: el override queda auditado (quién, cuándo, cuánto excedió y por qué motivo).
- **UX**: rechazar sin contexto frustra al vendedor; el mensaje debe mostrar saldo, tope y
  saliente de inmediato.
- **Race**: dos ventas a crédito simultáneas pueden pasar ambas si el guard calcula antes de
  comitear; la validación ocurre dentro de la transacción serializable de la venta.

## Fases y tests

| Fase | Qué | Tests |
|---|---|---|
| T1 | modelo + permiso + refund | regla pura de saldo vivo |
| T2 | guarda en create/pedido | ventas rechazadas/permitidas/override auditado |
| T3 | UI ficha + notas + límite | control de UI del tope y navegación |
| T4 | cierre | regresión completa |
