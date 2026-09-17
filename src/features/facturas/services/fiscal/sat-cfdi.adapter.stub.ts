/**
 * CFDI 4.0 (SAT, México) — esqueleto de adaptador fiscal (Gap 4)
 * ==============================================================
 *
 * OBJETIVO DE ESTE ARCHIVO
 * Servir de referencia viva para quien implemente el adaptador real: muestra
 * dónde vive cada paso del flujo SAT dentro del contrato `FiscalAdapter`
 * (`fiscal-adapter.ts`). No contiene código ejecutable porque no hay PAC ni
 * certificados reales todavía; toda la cadena ya funciona contra
 * `LocalAdapter` de `./local-adapter.ts` (proceso y eventos idénticos).
 *
 * REQUISITOS FISCALES MÍNIMOS DE SAT/CFDI 4.0 (para cuando toque)
 * ---------------------------------------------------------------
 * 1. Identidad del emisor: RFC (TaxId), Régimen Fiscal clave, Razón Social
 *    exactamente como en la constancia, CP del lugar de expedición.
 *    → Tenant: `taxId`, `regimenFiscal`, `razonSocial`, `codigoPostalFiscal`.
 * 2. Certificados: .cer/.key (FIEL o CSD del PAC intermedio); NUNCA en la
 *    base de datos de la app: se gestionan en secrets del entorno.
 * 3. Comprobante (XML CFDI 4.0):
 *      - Comprobante [TipoDeComprobante I|E, Serie, Folio, Fecha, SubTotal,
 *        Descuento?, Moneda, Total, FormaPago?, MetodoPago, LugarExpedicion]
 *      - Emisor [Rfc, Nombre, RegimenFiscal]
 *      - Receptor [Rfc, Nombre, DomicilioFiscalReceptor, RegimenFiscalReceptor (fis/moral),
 *                  UsoCFDI] ← el cliente TCP necesita estos campos nuevos vía settings o una
 *                  captura en el momento de "requisitos fiscales" del cliente.
 *      - Conceptos + Impuestos (Traslados por tasa/base) — NO aplican en esta fase
 *        porque TCP aún desconoce tasas por ítem; habrá que extender `Factura`.
 * 4. Timbrado: el EMISOR sella el XML con su propio CSD (.cer/.key de las secrets);
 *    el PAC valida y añade el TimbreFiscalDigital con el UUID del SAT.
 *    → En este diseño: `adapter.generar()` construye el XML y llama al PAC; el
 *    retorno llena `FiscalDocument.xml`, `folio`, `uuidExterno` y el evento
 *    `TIMBRADO` queda como trazabilidad.
 * 5. Cancelación: SAT exige motivo (01..04) y sustitución opcional → mapear a
 *    `FiscalEmisionEvent.estado = 'CANCELADO'` + Nota de Crédito de DNC
 *    correspondiente del propio flujo TCP.
 *
 * VIDEOS / ORDENES DE TRABAJO RESTANTES PARA IR A MX (fuera de este change)
 * -------------------------------------------------------------------------
 * - Impuestos por ítem en Factura (traslados por tasa).
 * - Catálogos SAT (ClaveProdServ, Unidad, FormaPago, UsoCFDI...) y validaciones
 *   de captura.
 * - Envío/recepción al PAC con timeouts, idempotencia y reintentos de alto nivel.
 * - Almacenamiento del XML timbrado fuera de la DB si se excede un tamaño útil.
 *
 * NOTA: este archivo no se importa en ningún lugar; sigue siendo TypeScript válido
 * y el typecheck siempre lo valida como parte del proyecto.
 */
export const CFDI_STUB = true;
