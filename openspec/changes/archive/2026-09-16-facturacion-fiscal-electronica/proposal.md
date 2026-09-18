# FE — Facturación fiscal electrónica (Gap 4)

## Decisión ejecutiva

No se implementa un timbrado fiscal real contra ninguna autoridad. Lo que se construye es la
**capa interoperable** que hace posible cumplir la ley de cada país cuando el negocio cruce
fronteras: un modelo `FiscalDocument` (documento fiscal emitido vinculado a la `Factura` interna)
con bitácora de eventos, un emisor orquestado y adaptadores por jurisdicción detrás de un flag
de plan **apagado por defecto**. El adaptador de referencia es un stub local que no llama a nadie;
el esqueleto CFDI/SAT se deja documentado para cuando haya que entrar a México.

Justificación (de la comparativa Ventas vs Odoo): la facturación fiscal es el gap *determinante*
para LATAM fuera de Cuba, pero para Cuba **no es obligatoria** (ONAT no timbra por red
de la forma SAT/DIAN) y construir una integración concreta de un país sin confirmar el siguiente
mercado sería I+D costosa y desechable. La capa abierta es lo único que tiene sentido hoy: prueba
que `Factura` + serie + NC pueden alimentar un CFDI u otro comprobante sin rediseñar el núcleo.

## Problema

- No existe ningún concepto de documento fiscal: solo `Factura` interna con numeración propia.
- Entrar a cualquier país con facturación electrónica (México, Colombia, RD, Perú…) exigirá
  folios fiscales, UUID del timbre, XML firmado, cancelaciones y estados: hoy no hay dónde vivir.
- El marketing promete "factura electrónica" sin implementación → desalineación reputacional.

## Propuesta

1. **Nuevos modelos** (sin migraciones destructivas):
   - `FiscalDocument`: estado del documento, jurisdicción/país, tipo (factura/nota de crédito),
     enlace a `Factura`, hash, `uuidExterno`, XML (texto), intentos, folio fiscal.
   - `FiscalEmisionEvent`: eventos de ciclo (generado, en_timbrado, timbrado, rechazado,
     cancelado) con timestamp, payload y origen.
2. **Campos fiscales mínimos** en `Tenant` (régimen/razón social/clave fiscal),
   `Cliente` (taxId, código de país fiscal, zip) y `Producto`/`Servicio` (clave de catálogo
   fiscal opcional por jurisdicción).
3. **Servicio `fiscal-emision-service`**: flujo `emitir(factura)` → documento `PENDIENTE` →
   adaptador del país → `EVENTO` cada paso; la consulta del estado se hace por polling o webhook
   (fuera de alcance real; solo el mecanismo).
4. **Adaptadores**: interfaz `FiscalAdapter` (`generar`, `timbrar`, `cancelar`, `consultar`,
   `descargarXml`, `descargarPdf`). Implementación de referencia: `LocalAdapter` (no-sale-de-caja,
   todo en memoria). Esqueleto `SatCfdiAdapter` documentado (CFDI 4.0, con PAC, sin FIEL real).
5. **UI mínima**: badge fiscal en la lista de facturas + panel con estado/eventos/descarga del
   XML; configuración por tenant (datos del emisor).
6. **Impuestos por ítem**: no se implementa cálculo fiscal en la venta (fuera de alcance); la NC
   del Gap 2 ya genera el documento NC que la capa fiscal representa como tipo `NOTA_CREDITO`.

## No-goals

- No integración real con PAC/SAT/DGII/DIAN, sin certificados, sin sello digital.
- No cobro, ni validación de RFC/CI porpuestas por el internauta.
- Sin impuestos por línea (el campo `impuestos` de `Factura` sigue aditivo y manual).
- Sin cambios en la venta del POS; la capa fiscal opera sobre `Factura` ya emitida.
- Sin cancelación fiscal en f.1 (el documento solo se marca; la reversión contable es de la NC).

## Impacto sobre el sistema actual

| Elemento | Archivos | Cambio |
|---|---|---|
| Schema | `prisma/schema.prisma` | FiscalDocument, FiscalEmisionEvent, campos fiscales |
| Emisor | `src/features/facturas/services/fiscal-emision-service.ts` (nuevo) | orquestación |
| Portal | `src/features/facturas/services/fiscal-adapter.ts` (nuevo) | contrato |
| Adaptador stub | `src/features/facturas/services/fiscal/local-adapter.ts` (nuevo) | sin red |
| Esqueleto | `src/features/facturas/services/fiscal/sat-cfdi.adapter.stub.ts` | referencia |
| UI | `src/features/facturas/components/*` | badge/panel/settings |
| Tests | unitarios del emisor + adaptador | TDD |

## Criterios de aceptación

1. Con el flag `facturacion-fiscal` activo y el tenant configurado, una `Factura` genera un
   `FiscalDocument` y su ciclo (PENDIENTE → PROCESANDO → TIMBRADA o RECHAZADA) queda trazado con
   eventos, *sin* llamadas externas (LocalAdapter).
2. Sin el flag, la app es idéntica a hoy.
3. El adaptador stub sirve como guía viva: cualquier PAC real se enchufa implementando la misma
   interfaz.
4. Toda la capa es multi-tenant y cumple el aislamiento (querys `tenantId`).
