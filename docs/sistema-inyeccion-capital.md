# Sistema de Inyección de Capital

Este documento detalla el diseño e implementación para el módulo de Inyeccion de Capital en el sistema de contabilidad.

## 1. Conceptos Generales

Se manejarán dos tipos de inyección de capital:

### A. Capital Social (Aportación de Socios)

Fondos aportados por los socios fundadores.

- **Flujo**: El dinero entra a una Cuenta Bancaria (Activo) y se registra en una cuenta de Patrimonio (Capital Social).
- **Efecto Contable**:
  - `[+]` Saldo Cuenta Bancaria Seleccionada.
  - `[+]` Saldo Cuenta Capital Social.

### B. Deuda Externa (Préstamos)

Fondos obtenidos de entidades externas con intereses.

- **Flujo**: El dinero entra a una Cuenta Bancaria (Activo) y se registra una Obligación de Pago (Pasivo) que incluye el capital más los intereses.
- **Efecto Contable**:
  - `[+]` Saldo Cuenta Bancaria Seleccionada (Monto Principal).
  - `[+]` Saldo Cuenta Deuda por Pagar (Monto Principal + Intereses Totales).
- **Pagos**: Se realizarán pagos mensuales que reducirán la deuda total.

## 2. Mapa de Implementación (Base de Datos)

Se añadirán nuevos modelos a `prisma/schema.prisma` para soportar estas operaciones.

```prisma
enum TipoInyeccion {
  CAPITAL_SOCIAL
  DEUDA_EXTERNA
}

enum EstadoDeuda {
  ACTIVA
  PAGADA
  EN_MORA
}

// Modelo principal para registrar la inyección
model InyeccionCapital {
  id              String        @id @default(cuid())
  tipo            TipoInyeccion
  
  // Datos Financieros
  montoRecibido   Decimal       // Lo que entra al banco
  moneda          String        @default("CUP")
  
  // Datos de la Deuda (Solo para DEUDA_EXTERNA)
  tasaInteres     Decimal?      // % de interés
  montoInteres    Decimal?      // Monto total de interés calculado
  montoTotalDeuda Decimal?      // Capital + Interés (Lo que se debe pagar)
  saldoPendiente  Decimal?      // Lo que falta por pagar
  plazoMeses      Int?          // Número de cuotas
  fechaInicioPago DateTime?
  
  // Entidades
  socio           String?       // Para Capital Social
  entidadPrestamista String?    // Para Deuda Externa
  
  // Relación Bancaria (Donde entra el dinero)
  cuentaBancaria  CuentaBancaria @relation(fields: [cuentaId], references: [cuentaId])
  cuentaId        String
  
  // Estado
  estado          EstadoDeuda?  @default(ACTIVA)
  
  // Historial de Pagos (Solo para DEUDA_EXTERNA)
  pagos           PagoDeuda[]
  
  descripcion     String?
  fechaRegistro   DateTime      @default(now())
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

// Modelo para registrar los pagos de la deuda
model PagoDeuda {
  id              String           @id @default(cuid())
  
  inyeccion       InyeccionCapital @relation(fields: [inyeccionId], references: [id])
  inyeccionId     String
  
  montoPagado     Decimal
  fechaPago       DateTime         @default(now())
  
  // Origen de los fondos para el pago
  cuentaBancaria  CuentaBancaria   @relation(fields: [cuentaId], references: [cuentaId])
  cuentaId        String
  
  numeroCuota     Int?
  comprobante     String?
  
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
}
```

## 3. Flujos de Usuario

### Crear Inyección de Capital Social

1. Usuario selecciona "Nueva Inyección" -> "Capital Social".
2. Ingresa: Monto, Cuenta Bancaria Destino, Nombre del Socio.
3. Sistema:
   - Crea registro en `InyeccionCapital`.
   - Actualiza saldo de `CuentaBancaria` (+ Monto).

### Crear Inyección de Deuda Externa

1. Usuario selecciona "Nueva Inyección" -> "Deuda Externa".
2. Ingresa: Monto Préstamo, Interés (%), Plazo (Meses), Cuenta Bancaria Destino, Entidad Prestamista.
3. Sistema:
   - Calcula `Monto Interés` y `Total Deuda`.
   - Crea registro en `InyeccionCapital`.
   - Actualiza saldo de `CuentaBancaria` (+ Monto Préstamo).

### Registrar Pago de Deuda

1. Usuario va al detalle de la Deuda.
2. Selecciona "Registrar Pago".
3. Ingresa: Monto a Pagar, Cuenta Bancaria Origen.
4. Sistema:
   - Crea registro en `PagoDeuda`.
   - Actualiza saldo de `CuentaBancaria` (- Monto Pago).
   - Actualiza `saldoPendiente` en `InyeccionCapital`.
   - Si `saldoPendiente` <= 0, actualiza estado a `PAGADA`.

## 4. Visualización

- **Dashboard de Capital**: Gráficos mostrando proporción de Capital Social vs Deuda.
- **Lista de Inyecciones**: Tabla con filtros por tipo.
- **Detalle de Deuda**: Calendario de pagos, barra de progreso de deuda pagada.
