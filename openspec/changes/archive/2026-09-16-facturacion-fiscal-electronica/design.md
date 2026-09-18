# Design — FE Facturación fiscal electrónica (Gap 4)

## Arquitectura por capas

```
[Venta / Oferta / DNC]  →  Factura (comprobante interno)  →  FiscalEmisionService  →  Adapter
        │                         │                                 │                     │
   POS/compras (no toca nada)     │ estado Pagada/Facturada          │ cola + eventos     │ LocalAdapter / SatCfdiAdapter / ...
                                 └→ FiscalDocument (UUID, XML, ...) ←──┘ (emisión asíncrona por job)
```

Puntos de diseño:

1. **La separación Factura ↔ FiscalDocument es obligatoria**. La factura interna sigue
   existiendo (numeración, cobro, CxC); el documento fiscal es el artefacto legal. Cada país
   mapea su comprobante (`FACTURA`/`NOTA_CREDITO`) a su tipo (`I`/`E` en CFDI, etc.).

2. **Emisión asíncrona**. Nada en el flujo de venta se bloquea esperando al PAC: la factura se
   crea, el documento queda `PENDIENTE`, y un job/cron lo procesa. En el POS rutina (Cuba) esto es
   inocuo porque la factura PDF operativa no espera; si el país exige pre-entrega, habría una
   transición `BLOQUEADA_HASTA_TIMBRADO` (fast-follow, fuera de esta fase).

3. **Un FiscalDocument por Factura** (`Factura` 1:1) — incluidas las del tipo `NOTA_CREDITO` de DNC.

## Modelo de datos

```prisma
enum EstadoFiscalDocumento {
  PENDIENTE       # generado, esperando proceso
  PROCESANDO
  TIMBRADA        # autorizada (o simulada por LocalAdapter)
  RECHAZADA
  CANCELADA
}

model FiscalDocument {
  fiscalDocumentId String                  @id @default(cuid())
  tenantId         String
  facturaId        String                  @unique   // 1 documento por factura
  jurisdiccion     String                  // "MX-SAT", "DO-DGII", "LOCAL"
  tipoDocumento    String                  // 'EMISION' | 'NOTA_CREDITO' | ...
  estado           EstadoFiscalDocumento   @default(PENDIENTE)
  uuidExterno      String?
  xml              String?
  folio            String?
  intentos         Int                     @default(0)
  ultimoError      String?
  createdAt        DateTime                @default(now())
  updatedAt        DateTime                @updatedAt
  factura          Factura                 @relation(...)

  @@unique([tenantId, facturaId])
  @@index([tenantId, estado])
}

model FiscalEmisionEvent {
  id               String          @id @default(cuid())
  tenantId         String
  fiscalDocumentId String
  estado           String          // 'GENERADO' 'EN_TIMBRADO' 'TIMBRADO' 'RECHAZADO' ...
  detalle          Json?
  createdAt        DateTime        @default(now())
  fiscalDocument   FiscalDocument  @relation(...)
}
```

Campos fiscales mínimos fuera del propio documento:

- `Tenant`: `regimenFiscal String?`, `taxId String?`, `razonSocial String?`, `codigoPostalFiscal String?`
- `Cliente`: `taxIdCliente String?` — no se exige; el PAC sí lo exigiría en un país final.

## Adaptador

```ts
interface FiscalAdapter {
  jurisdiccion: string;
  emitir(factura: FacturaConContexto): Promise<FiscalDocumentoEntrante>;
  estado(fiscalDocumentId: string): Promise<FiscalConsulta>;
  cancelar(fiscalDocumentId: string, motivo: string): Promise<FiscalCancelacion>;
}
```

`LocalAdapter` (desarrollo/qa): genera un XML sintético en memoria, "timbra" sin red, persiste
`uuidExterno = LOCAL-<factura>`, y termina TIMBRADA. Sirve para probar la cadena completa.

`SatCfdiAdapter.stub.ts`: pseudocódigo detallado del flujo real — creación del XML CFDI 4.0,
uso del certificado, conexión al PAC, manejo de cancelación — sin implementación.

## Flujo de la emisión (paso a paso)

```
1. Factura creada (estado PENDIENTE interno, NC incluidas).
2. Si feature fiscal on: tras el commit se llama a `FiscalEmisionService.encolar(factura)`.
3. El worker/cron toma el documento PENDIENTE más viejo y llama al adapter.
4. Eventos se persisten: GENERADO (al crear) → EN_TIMBRADO → TIMBRADO o RECHAZADO.
5. Si RECHAZADO, `ultimoError` queda visible y un reintento puede encolarse de nuevo.
```

## Interacciones con el código existente

- **Numeración**: el interno `NC-000001` sigue intacto. El folio fiscal es externo.
- **Estado de la venta**: el ciclo de vida ya no lo toca (los efectos se disparan en el flujo
  original; el timbrado no interviene en stock/FIFO).
- **Cancelación fiscal siempre delega**: una nota de crédito genera el doc fiscal `NOTA_CREDITO`
  asociado a la misma factura original — la anulación decisiva no ocurre en la venta de origen.

## Esquema REST de la UI

- Badge fiscal junto a la factura en la lista (`FiscalDocument.estado`).
- Panel "Documento fiscal" en el detalle: eventos, uuid, descarga XML, botón "Reintentar"
  (si RECHAZADA) — solo si feature activa.
- Configuración del emisor en tenant/settings: razón social, taxId, régimen, zip fiscal.

## Riesgos

- **P2025 en la cola**: el worker reintenta con backoff y eventos de reintento; deadlock por
  reintentos persistidos se mitiga con `intentos` limitado (máx 5).
- **XML grande**: el campo `xml` puede crecer; se alinea con el diseño de Postgres TEXT.
  Si fuera problema, sacarlo a storage externo es un fast-follow trivial.
- **Sin aislamiento por país**: la jurisdicción se fija por tenant; no puede existir una misma
  factura con dos jurisdicciones distintas (una venta una jurisdicción — regla del modelo).
