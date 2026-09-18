/**
 * @description Clasificación formal de los modelos Prisma por scope tenant (AS-01 T1).
 * Cada modelo del schema queda en una categoría: scoped (con
 * columna tenantId, enforcement directo), global (plataforma, nunca lleva
 * tenant), child (hereda el tenant del padre vía relación) o pending-scope
 * (lógicamente por tenant pero aún sin columna; backlog de AS-05).
 * La regla de oro es que el default es scoped: hay que argumentar lo contrario.
 * @module src/lib/db/model-classification
 */

/**
 * @description Kinds de scope válidos para un modelo.
 */
export const MODEL_SCOPE_KINDS = ['scoped', 'global', 'child', 'pending-scope'] as const;

/**
 * @description Kind de scope de un modelo.
 */
export type ModelScopeKind = (typeof MODEL_SCOPE_KINDS)[number];

/**
 * @description Entrada de clasificación de un modelo.
 * @param scope - Kind de scope del modelo.
 * @param reason - Justificación escrita (obligatoria; más exigente fuera de scoped).
 * @param parentModel - Solo child: modelo padre del que hereda el tenant.
 * @param parentField - Solo child: campo FK local hacia el padre.
 */
export interface ModelClassificationEntry {
  scope: ModelScopeKind;
  reason: string;
  parentModel?: string;
  parentField?: string;
}

const SCOPED = (reason = 'Modelo de negocio por tenant (columna tenantId).'): ModelClassificationEntry => ({
  scope: 'scoped',
  reason,
});

const GLOBAL = (reason: string): ModelClassificationEntry => ({ scope: 'global', reason });

const CHILD = (
  parentModel: string,
  parentField: string,
  reason: string,
): ModelClassificationEntry => ({ scope: 'child', parentModel, parentField, reason });

const PENDING = (reason: string): ModelClassificationEntry => ({ scope: 'pending-scope', reason });

/**
 * @description Clasificación total de los modelos del schema. El test de
 * contrato (model-classification.test.ts) falla si un modelo del DMMF falta
 * aquí o si sobra una entrada que ya no existe en el schema.
 */
export const MODEL_CLASSIFICATION: Record<string, ModelClassificationEntry> = {
  // ---- scoped: tienen columna tenantId ----
  AccountingPolicyRolloutEntry: SCOPED('Entrada de rollout por tenant (run global, fila por tenant).'),
  AccountingPolicyTenantApproval: SCOPED(),
  AffiliateCreditBalance: SCOPED('Saldo de crédito de afiliado por tenant.'),
  AffiliatePerkGrant: SCOPED('Beneficio otorgado al tenant referido.'),
  AffiliateProfile: SCOPED('Perfil de afiliado del tenant (1:1 por tenant).'),
  AjusteInventario: SCOPED('Ajuste físico/contable de inventario por tenant.'),
  AjusteBancario: SCOPED(),
  Almacen: SCOPED(),
  Anticipo: SCOPED(),
  AperturaPeriodo: SCOPED(),
  ArqueoCaja: SCOPED(),
  AuditoriaPeriodo: SCOPED(),
  BackupLog: SCOPED('Log de respaldos del tenant.'),
  BackupPlan: SCOPED('Plan de respaldos del tenant.'),
  Categoria: SCOPED(),
  CierreContable: SCOPED(),
  Cliente: SCOPED(),
  CloudinaryAsset: SCOPED('Activo multimedia del tenant (ownerType/ownerId polimórfico + tenantId propio).'),
  CompraDocumento: SCOPED(),
  CompraDocumentoItem: SCOPED('Ítem con tenantId propio denormalizado.'),
  CompraProducto: SCOPED(),
  CompraServicio: SCOPED(),
  CobroNota: SCOPED('Nota de seguimiento de cobro por tenant.'),
  ConteoInventario: SCOPED('Cabecera de conteo físico por tenant.'),
  ConteoLinea: SCOPED('Línea de conteo con tenantId propio denormalizado.'),
  Contrato: SCOPED(),
  CuentaBancaria: SCOPED(),
  CuentaPorCobrar: SCOPED(),
  CuentaPorPagar: SCOPED(),
  DefectacionCatalogo: SCOPED('Catálogo de defectos por tenant.'),
  DeudaCash: SCOPED(),
  DevolucionVenta: SCOPED('Devolución de venta por tenant.'),
  DevolucionVentaItem: CHILD(
    'DevolucionVenta',
    'devolucionId',
    'Línea de devolución; hereda el tenant de la devolución.',
  ),
  Empleado: SCOPED(),
  EquipoReparacion: SCOPED(),
  Factura: SCOPED(),
  FiscalDocument: SCOPED('Documento fiscal asociado a una factura del tenant.'),
  FiscalEmisionEvent: CHILD(
    'FiscalDocument',
    'fiscalDocumentId',
    'Evento fiscal; hereda el tenant del documento fiscal.',
  ),
  FinancialAuxiliaryCheckpoint: SCOPED('Checkpoint auxiliar contable por tenant.'),
  FxEvidence: SCOPED('Evidencia FX por tenant (clave única incluye tenantId).'),
  GastoCompra: SCOPED(),
  GastoConcepto: SCOPED(),
  GastoElemento: SCOPED(),
  GastosDE: SCOPED(),
  ListaPrecio: SCOPED(),
  Merma: SCOPED(),
  MiEmpresa: SCOPED('Ficha de empresa del tenant (1:1 por tenant).'),
  Oferta: SCOPED(),
  OrdenCompra: SCOPED('Orden de compra por tenant.'),
  OrdenCompraItem: SCOPED('Ítem de orden con tenantId propio denormalizado.'),
  OrdenProduccion: SCOPED(),
  OrdenProduccionHistorial: SCOPED(),
  OrdenReparacion: SCOPED(),
  OrdenReparacionEquipo: SCOPED(),
  OrdenReparacionItem: SCOPED(),
  OrdenReparacionMaterial: SCOPED(),
  PagoCuentaPorPagar: SCOPED(),
  Pagosalario: SCOPED(),
  PeriodoCache: SCOPED(),
  PeriodoContable: SCOPED(),
  PiezaReparacion: SCOPED(),
  PrestamoCash: SCOPED(),
  Producto: SCOPED(),
  ProductoCostSheetTemplate: SCOPED('Plantilla de hoja de costo por tenant.'),
  PuntoDeVenta: SCOPED(),
  PurchaseAllocation: SCOPED('Asignación compra→venta dentro del tenant.'),
  Receta: SCOPED(),
  RecetaIngrediente: SCOPED('Ingrediente con tenantId propio denormalizado.'),
  Recepcion: SCOPED('Recepción de orden de compra por tenant.'),
  RecepcionItem: SCOPED('Ítem de recepción con tenantId propio denormalizado.'),
  ReconciliacionGasto: SCOPED(),
  ReconciliacionServicio: SCOPED(),
  ReconciliacionVenta: SCOPED(),
  ReferralPerkRequest: SCOPED('Solicitud de beneficio del tenant referido.'),
  Review: SCOPED('Reseña del tenant.'),
  ReviewPrompt: SCOPED('Solicitud de reseña del tenant.'),
  ReglaReabastecimiento: SCOPED('Regla min/max de inventario por tenant y ubicación.'),
  SerieFacturacion: SCOPED('Serie de facturación por tenant (numeración aislada).'),
  Servicios: SCOPED(),
  SnapshotPeriodo: SCOPED(),
  StockMoveLine: SCOPED('Movimiento de stock con tenantId propio.'),
  StockUbicacion: SCOPED(),
  TenantAccountingPolicy: SCOPED('Política contable del tenant (tenantId como PK, 1:1).'),
  TenantLicense: SCOPED('Licencia del tenant.'),
  TenantLicensePayment: SCOPED('Pago de licencia del tenant.'),
  TenantMembership: SCOPED('Membresía usuario↔tenant (doble FK, fila por tenant).'),
  TenantRole: SCOPED('Rol personalizado del tenant.'),
  TipoPago: SCOPED(),
  Transferencia: SCOPED(),
  TransferenciaBancaria: SCOPED(),
  TurnoPuntoVenta: SCOPED(),
  Unidad: SCOPED(),
  ValeSalida: SCOPED(),
  ValeSalidaItem: SCOPED('Ítem con tenantId propio denormalizado.'),
  Vendor: SCOPED(),
  Venta: SCOPED(),
  VentaServicios: SCOPED(),

  // ---- global (22): plataforma, nunca llevan tenant ----
  Tenant: GLOBAL('Identidad del tenant: su PK es tenantId, no es una fila escopada.'),
  User: GLOBAL('Identidad de plataforma: un usuario puede pertenecer a varios tenants vía TenantMembership.'),
  UserSession: GLOBAL('Sesión de plataforma ligada al usuario, no a un tenant.'),
  UserActivityLog: GLOBAL('Actividad de plataforma ligada al usuario. El acceso por tenant se filtra vía membresías.'),
  Notification: GLOBAL('Notificación ligada al usuario (userId). El tenant se resuelve vía el destinatario.'),
  Plan: GLOBAL('Catálogo de planes de la plataforma (los tenants lo referencian vía TenantLicense).'),
  ReferralPerkCatalog: GLOBAL('Catálogo de beneficios de la plataforma, solo admin.'),
  Moneda: GLOBAL('Catálogo monetario compartido (CUP, USD…). La selección por tenant vive en TenantAccountingPolicy.'),
  TasaCambio: GLOBAL('Catálogo de tasas gobernado global (confirmado en auditoría FX 2026-09-05).'),
  CatalogoReparacionConfig: GLOBAL('Configuración global del catálogo de reparaciones (monedaId única).'),
  ConfiguracionSistema: GLOBAL('Configuración de plataforma de facto (una fila). Decisión pendiente: migrar diasAvisoVencimientoContrato a por-tenant o formalizar como plataforma.'),
  AffiliateReferral: GLOBAL('Relación cross-tenant por naturaleza (referrerTenantId + referredTenantId). Solo programa de afiliados.'),
  AffiliateCommissionLedger: GLOBAL('Ledger cross-tenant del programa de afiliados (referrerTenantId, sin tenantId único).'),
  SalesAgentProfile: GLOBAL('Perfil comercial de plataforma ligado al usuario.'),
  SalesAgentBalance: GLOBAL('Balance comercial de plataforma ligado al usuario.'),
  SalesAgentPayout: GLOBAL('Pago comercial de plataforma ligado al usuario.'),
  SalesAgentReferral: GLOBAL('Atribución comercial tenant↔agente (referredTenantId único). Solo programa comercial.'),
  SalesAgentCommissionLedger: GLOBAL('Ledger comercial cross-tenant (sourceTenantLicenseId). Solo programa comercial.'),
  SalesAgentEmailDelivery: GLOBAL('Entrega de email hija de Notification (global). Solo programa comercial.'),
  AccountingPolicyRolloutRun: GLOBAL('Ejecución de rollout operada por plataforma; las filas por tenant viven en AccountingPolicyRolloutEntry (scoped).'),
  VendorCodeSequence: GLOBAL('Secuencia global de códigos de proveedor (una fila id=1). RIESGO: contador compartido entre tenants; evaluar secuencia por tenant en AS-05.'),
  AuditLog: GLOBAL('Auditoría polimórfica de plataforma (entidad/entidadId libres + usuarioId). Decisión AS-01: se mantiene global; las vistas por tenant filtran vía usuarioId/membresías. Reevaluar tenantId en AS-05 si el volumen lo exige.'),

  // ---- child (17): heredan el tenant del padre ----
  VentaItem: CHILD('Venta', 'ventaId', 'Ítem intra-transacción; acceso siempre vía la venta.'),
  OfertaItem: CHILD('Oferta', 'ofertaId', 'Ítem intra-transacción; acceso siempre vía la oferta.'),
  ContratoVersion: CHILD('Contrato', 'contratoId', 'Versión intra-contrato; acceso siempre vía el contrato.'),
  ContratoFirma: CHILD('Contrato', 'contratoId', 'Firma intra-contrato; acceso siempre vía el contrato.'),
  ContratoAprobacion: CHILD('Contrato', 'contratoId', 'Aprobación intra-contrato; acceso siempre vía el contrato.'),
  ContratoArchivo: CHILD('Contrato', 'contratoId', 'Archivo intra-contrato; acceso siempre vía el contrato.'),
  ContratoAlerta: CHILD('Contrato', 'contratoId', 'Alerta intra-contrato; acceso siempre vía el contrato.'),
  PrecioProducto: CHILD('ListaPrecio', 'listaPrecioId', 'Precio dentro de lista; la lista ya es scoped.'),
  ProductoCostHistory: CHILD('Producto', 'productoId', 'Historial intra-producto. Candidato a denormalizar tenantId en AS-05 por valor de auditoría.'),
  AnticipoMovimiento: CHILD('Anticipo', 'anticipoId', 'Movimiento intra-anticipo. Candidato a denormalizar tenantId en AS-05.'),
  Attendance: CHILD('Empleado', 'employeeId', 'Asistencia del empleado; acceso vía empleado (scoped).'),
  EmployeeWorkSchedule: CHILD('Empleado', 'employeeId', 'Horario del empleado; acceso vía empleado (scoped).'),
  VacationRequest: CHILD('Empleado', 'employeeId', 'Solicitud del empleado; acceso vía empleado (scoped).'),
  VacationAccrual: CHILD('Empleado', 'employeeId', 'Acumulado del empleado; acceso vía empleado (scoped).'),
  InyeccionCapital: SCOPED('Inyección de capital denormalizada en AS-05 ola 3: tenantId nullable + índice. Writers: AccountingOperationsMutationService (createCapitalInjection, registerCapitalPayment), createCuentaBancariaAction, handlers legacy.'),
  PagoDeuda: SCOPED('Pago de deuda denormalizado en AS-05 ola 3: tenantId nullable + índice. Writers: AccountingOperationsMutationService.registerCapitalPayment, handlers legacy.'),
  SaldoSnapshot: SCOPED('Snapshot de saldo denormalizado en AS-05 ola 3: tenantId nullable + índice. Writer: SnapshotService.generarSnapshot (resuelve tenant desde PeriodoContable). No llamado desde producción actualmente.'),

  // ---- pending-scope (1): por tenant de hecho, sin columna; backlog AS-05 ----
  TransaccionMoneda: SCOPED('Espejo contable multimoneda denormalizado en AS-05: tenantId nullable, backfill desde la tabla padre por tipoTransaccion y escritura dual en todos los writers. Las históricas exchange (sin padre) quedan sin tenant: fail-closed (no se exponen).'),
  AlertHistory: SCOPED('Alertas operativas denormalizadas en AS-05 ola 2: tenantId nullable + índice. Sin escritores en código; filas históricas NULL quedan fail-closed (no se exponen). Futuros writers deben asignar tenantId desde el contexto.'),
  ReportHistory: SCOPED('Historial de reportes denormalizado en AS-05 ola 2: tenantId nullable + índice. Sin escritores en código; generadoPor es userId (no atribuible a un tenant); históricos NULL fail-closed.'),
  ScheduledReport: SCOPED('Reportes programados denormalizados en AS-05 ola 2: tenantId nullable + índice. Sin escritores en código; creadoPor es userId (no atribuible); históricos NULL fail-closed.'),
  ScenarioSimulation: SCOPED('Simulaciones denormalizadas en AS-05 ola 2: tenantId nullable + índice. Sin escritores en código; creadoPor es userId (no atribuible); históricos NULL fail-closed.'),
  TipoContratoCustom: PENDING('Tipos de contrato personalizados globales por accidente (nombre @unique global). Decisión tomada: por-tenant; migran a scoped con unicidad por tenant en AS-05.'),
};

/**
 * @description Resuelve el scope de un modelo. Falla cerrado ante modelos
 * desconocidos para no escopar por defecto algo no clasificado.
 * @param {string} model - Nombre del modelo Prisma.
 * @returns {ModelScopeKind} Kind de scope del modelo.
 */
export function getModelScope(model: string): ModelScopeKind {
  const entry = MODEL_CLASSIFICATION[model];
  if (!entry) throw new Error(`Modelo sin clasificar por scope tenant: ${model}`);
  return entry.scope;
}

/**
 * @description Indica si el modelo tiene enforcement directo por tenantId.
 * @param {string} model - Nombre del modelo Prisma.
 * @returns {boolean} true solo para modelos scoped.
 */
export function isTenantScoped(model: string): boolean {
  return getModelScope(model) === 'scoped';
}

/**
 * @description Lista derivada de modelos por kind (para reportes y auditoría).
 * @param {ModelScopeKind} scope - Kind de scope a listar.
 * @returns {string[]} Nombres de modelos en ese scope, ordenados.
 */
export function listModelsByScope(scope: ModelScopeKind): string[] {
  return Object.entries(MODEL_CLASSIFICATION)
    .filter(([, entry]) => entry.scope === scope)
    .map(([model]) => model)
    .sort();
}
