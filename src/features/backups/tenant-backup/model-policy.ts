/**
 * @description Explicit model-level classification for the future tenant-backup policy.
 * This registry is not an export allowlist; field, relation, restore-order and FK-cycle policies
 * remain separately gated before any backup wiring is permitted.
 */

export type TenantBackupPolicyKind =
  | 'tenant-direct'
  | 'tenant-child'
  | 'reference-only'
  | 'excluded';

export interface TenantBackupModelPolicy {
  model: string;
  kind: TenantBackupPolicyKind;
  ownerPath: string;
  rationale: string;
  protectedEvidenceCandidate: boolean;
}

export interface TenantBackupBusinessManifestEntry {
  model: string;
  disposition: 'candidate';
  rationale: string;
  productImpact: string;
}

const DIRECT_TENANT_MODELS = [
  'Categoria', 'Unidad', 'Vendor', 'InyeccionCapital',
  'PagoDeuda', 'Cliente', 'MiEmpresa', 'Almacen',
  'PuntoDeVenta', 'TurnoPuntoVenta', 'ArqueoCaja', 'Producto', 'UnidadConversion',
  'StockUbicacion', 'AjusteInventario', 'ConteoInventario', 'ConteoLinea',
  'StockMoveLine', 'Venta', 'Merma', 'Transferencia',
  'Empleado', 'Pagosalario', 'CierreContable', 'GastoCompra',
  'CompraProducto', 'CompraDocumento', 'CompraDocumentoItem', 'OrdenCompra',
  'OrdenCompraItem', 'Recepcion', 'RecepcionItem', 'ReglaReabastecimiento',
  'PurchaseAllocation', 'Servicios', 'VentaServicios', 'CompraServicio',
  'GastoConcepto', 'GastoElemento', 'GastosDE', 'TenantAccountingPolicy',
  'FinancialAuxiliaryCheckpoint', 'FxEvidence', 'TransaccionMoneda', 'CuentaBancaria',
  'TipoPago', 'ReconciliacionVenta', 'ReconciliacionServicio', 'ReconciliacionGasto',
  'AjusteBancario', 'TransferenciaBancaria', 'CobroNota', 'Contrato',
  'Factura', 'SerieFacturacion', 'Oferta', 'CuentaPorCobrar',
  'CuentaPorPagar', 'DeudaCash', 'PrestamoCash', 'PagoCuentaPorPagar',
  'EquipoReparacion', 'PiezaReparacion', 'OrdenReparacion', 'OrdenReparacionEquipo',
  'OrdenReparacionItem', 'OrdenReparacionMaterial', 'DefectacionCatalogo', 'OrdenProduccion',
  'OrdenProduccionHistorial', 'Receta', 'RecetaIngrediente', 'ValeSalida',
  'ValeSalidaItem', 'ListaPrecio', 'Anticipo', 'DevolucionVenta',
  'FiscalDocument', 'FiscalEmisionEvent', 'PeriodoContable', 'CuentaContable',
  'Diario', 'CashPaymentInterestAllocation', 'Asiento', 'AsientoLinea',
  'CuentaRolTenant', 'SnapshotPeriodo', 'AperturaPeriodo', 'SaldoSnapshot',
  'AuditoriaPeriodo', 'Review', 'ReviewPrompt', 'TipoContratoCustom',
  'ConfiguracionContratos',
] as const;
const REFERENCE_ONLY_MODELS = [
  'Tenant', 'User', 'Plan', 'ReferralPerkCatalog',
  'Moneda', 'CatalogoReparacionConfig', 'TasaCambio', 'ConfiguracionSistema',
  'VendorCodeSequence', 'PlantillaAsiento',
] as const;
const EXCLUDED_MODELS = [
  'TenantMembership', 'TenantRole', 'TenantLicense', 'CloudinaryAsset',
  'AffiliateProfile', 'AffiliateReferral', 'AffiliateCommissionLedger', 'AffiliateCreditBalance',
  'SalesAgentProfile', 'SalesAgentReferral', 'SalesAgentCommissionLedger', 'TenantLicensePayment',
  'SalesAgentBalance', 'SalesAgentPayout', 'AffiliatePerkGrant', 'ReferralPerkRequest',
  'Notification', 'SalesAgentEmailDelivery', 'UserActivityLog', 'UserSession',
  'AccountingPolicyRolloutRun', 'AccountingPolicyRolloutEntry', 'AccountingPolicyTenantApproval', 'AlertHistory',
  'AuditLog', 'ReportHistory', 'ScheduledReport', 'ScenarioSimulation',
  'ProductoCostSheetTemplate', 'ReplayPreflight', 'ReplayApproval', 'ReplayRun',
  'ShadowPosteoOutbox', 'BackupLog', 'BackupPlan', 'PeriodoCache',
] as const;
const BUSINESS_MODEL_NAMES = [
  'Categoria', 'Unidad', 'UnidadConversion', 'Vendor', 'InyeccionCapital',
  'PagoDeuda', 'Cliente', 'MiEmpresa', 'Almacen',
  'PuntoDeVenta', 'TurnoPuntoVenta', 'ArqueoCaja', 'Producto',
  'StockUbicacion', 'AjusteInventario', 'ConteoInventario', 'ConteoLinea',
  'StockMoveLine', 'Venta', 'VentaItem', 'Merma',
  'Transferencia', 'Attendance', 'EmployeeWorkSchedule', 'VacationRequest',
  'VacationAccrual', 'Empleado', 'Pagosalario', 'CierreContable',
  'GastoCompra', 'CompraProducto', 'CompraDocumento', 'CompraDocumentoItem',
  'OrdenCompra', 'OrdenCompraItem', 'Recepcion', 'RecepcionItem',
  'ReglaReabastecimiento', 'PurchaseAllocation', 'Servicios', 'VentaServicios',
  'CompraServicio', 'GastoConcepto', 'GastoElemento', 'GastosDE',
  'TenantAccountingPolicy', 'FinancialAuxiliaryCheckpoint', 'FxEvidence', 'TransaccionMoneda',
  'CuentaBancaria', 'TipoPago', 'ReconciliacionVenta', 'ReconciliacionServicio',
  'ReconciliacionGasto', 'AjusteBancario', 'TransferenciaBancaria', 'CobroNota',
  'ConfiguracionContratos', 'Contrato', 'ContratoVersion', 'ContratoFirma', 'ContratoAprobacion',
  'ContratoArchivo', 'ContratoAlerta', 'Factura', 'SerieFacturacion',
  'Oferta', 'OfertaItem', 'CuentaPorCobrar', 'CuentaPorPagar',
  'DeudaCash', 'PrestamoCash', 'PagoCuentaPorPagar', 'EquipoReparacion',
  'PiezaReparacion', 'OrdenReparacion', 'ReciboOrdenReparacion', 'OrdenReparacionEquipo',
  'OrdenReparacionItem', 'OrdenReparacionMaterial', 'DefectacionCatalogo', 'OrdenProduccion',
  'OrdenProduccionHistorial', 'Receta', 'RecetaIngrediente', 'ValeSalida',
  'ValeSalidaItem', 'ListaPrecio', 'PrecioProducto', 'ProductoCostHistory',
  'Anticipo', 'AnticipoMovimiento', 'DevolucionVenta', 'DevolucionVentaItem',
  'FiscalDocument', 'FiscalEmisionEvent', 'PeriodoContable', 'CuentaContable',
  'Diario', 'CashPaymentInterestAllocation', 'Asiento', 'AsientoLinea',
  'CuentaRolTenant', 'SnapshotPeriodo', 'AperturaPeriodo', 'SaldoSnapshot',
  'AuditoriaPeriodo', 'Review', 'ReviewPrompt', 'TipoContratoCustom',
] as const;
const CHILD_OWNER_PATHS = {
  VentaItem: 'Venta.tenantId AND Producto.tenantId',
  Attendance: 'Empleado.tenantId',
  EmployeeWorkSchedule: 'Empleado.tenantId',
  VacationRequest: 'Empleado.tenantId',
  VacationAccrual: 'Empleado.tenantId',
  ContratoVersion: 'Contrato.tenantId',
  ContratoFirma: 'Contrato.tenantId',
  ContratoAprobacion: 'Contrato.tenantId',
  ContratoArchivo: 'Contrato.tenantId',
  ContratoAlerta: 'Contrato.tenantId',
  OfertaItem: 'Oferta.tenantId AND optional Producto.tenantId AND optional Servicios.tenantId',
  ReciboOrdenReparacion: 'OrdenReparacion.tenantId',
  PrecioProducto: 'ListaPrecio.tenantId AND Producto.tenantId',
  ProductoCostHistory: 'Producto.tenantId',
  AnticipoMovimiento: 'Anticipo.tenantId (must be non-null)',
  DevolucionVentaItem: 'DevolucionVenta.tenantId AND DevolucionVenta.ventaId -> Venta.tenantId AND DevolucionVenta.ventaId === ventaItem.ventaId AND ventaItem.venta.tenantId AND ventaItem.producto.tenantId AND productoId === ventaItem.productoId',
} as const;

const PROTECTED_EVIDENCE_CANDIDATES = [
  'PagoDeuda', 'StockMoveLine', 'AffiliateCommissionLedger',
  'SalesAgentCommissionLedger', 'TenantLicensePayment', 'TenantAccountingPolicy',
  'FinancialAuxiliaryCheckpoint', 'FxEvidence', 'DevolucionVenta',
  'FiscalDocument', 'FiscalEmisionEvent', 'CashPaymentInterestAllocation',
  'Asiento', 'AsientoLinea', 'SnapshotPeriodo',
] as const;
const PROTECTED_EVIDENCE_MODEL_SET: ReadonlySet<string> = new Set(PROTECTED_EVIDENCE_CANDIDATES);

/** Cycles have no reviewed deferred-write plan, so any selected member blocks restore. */
export const UNSUPPORTED_RESTORE_CYCLES = [
  ['Categoria'],
  ['Producto'],
  ['OrdenReparacion', 'Venta'],
  ['CuentaBancaria', 'MiEmpresa'],
  ['PeriodoContable'],
  ['CuentaContable'],
] as const;

const POLICY_RATIONALE: Record<TenantBackupPolicyKind, string> = {
  'tenant-direct': 'Tenant-owned candidate; scalar field and cross-tenant relation allowlists remain gated.',
  'tenant-child': 'Child-owned candidate; declared owner chain requires later relation validation.',
  'reference-only': 'Global/reference state is validated read-only and is never tenant-restored.',
  excluded: 'Control, security, external, or unsafe state is explicitly excluded from tenant artifacts.',
};

const MODEL_ROWS: readonly TenantBackupModelPolicy[] = [
  ...DIRECT_TENANT_MODELS.map((model) => ({
    model,
    kind: 'tenant-direct' as const,
    ownerPath: model === 'TipoContratoCustom'
      ? 'tenantId; exclude legacy NULL rows'
      : model === 'UnidadConversion'
        ? 'tenantId; composite Producto and Unidad foreign keys'
        : 'tenantId',
    rationale: model === 'TipoContratoCustom'
      ? 'Tenant-owned model; never infer tenant ownership for legacy NULL tenantId rows.'
      : model === 'UnidadConversion'
        ? 'Tenant-owned conversion with tenantId and composite same-tenant Producto and Unidad references; '
          + 'relation and field review still gates export and restore.'
      : POLICY_RATIONALE['tenant-direct'],
    protectedEvidenceCandidate: PROTECTED_EVIDENCE_MODEL_SET.has(model),
  })),
  ...Object.entries(CHILD_OWNER_PATHS).map(([model, ownerPath]) => ({
    model,
    kind: 'tenant-child' as const,
    ownerPath,
    rationale: POLICY_RATIONALE['tenant-child'],
    protectedEvidenceCandidate: PROTECTED_EVIDENCE_MODEL_SET.has(model),
  })),
  ...REFERENCE_ONLY_MODELS.map((model) => ({
    model,
    kind: 'reference-only' as const,
    ownerPath: 'none; read-only reference',
    rationale: POLICY_RATIONALE['reference-only'],
    protectedEvidenceCandidate: PROTECTED_EVIDENCE_MODEL_SET.has(model),
  })),
  ...EXCLUDED_MODELS.map((model) => ({
    model,
    kind: 'excluded' as const,
    ownerPath: 'none; excluded',
    rationale: POLICY_RATIONALE.excluded,
    protectedEvidenceCandidate: PROTECTED_EVIDENCE_MODEL_SET.has(model),
  })),
];

/**
 * @description Independently maintained business coverage expectation, separate from policy rows.
 * @param modelNames - Reviewed tenant-business model names from the policy inventory.
 * @returns Coverage entries that remain candidates until complete field policy review.
 */
function buildBusinessManifest(modelNames: readonly string[]): TenantBackupBusinessManifestEntry[] {
  return modelNames.map((model) => ({
    model,
    disposition: 'candidate',
    rationale: model === 'TipoContratoCustom'
      ? 'Tenant-owned model; include only validated non-null tenantId rows and never infer legacy NULL ownership.'
      : model === 'UnidadConversion'
        ? [
            'UnidadConversion is required to preserve tenant product-unit conversion state;',
            'include only after relation and field validation.',
          ].join(' ')
      : 'Tenant business data is expected to be represented; model-specific field and relation review is pending.',
    productImpact: model === 'TipoContratoCustom'
      ? 'Legacy unattributed custom types remain excluded; current tenant rows are candidates only.'
      : model === 'UnidadConversion'
        ? [
            'Omission can lose tenant conversion settings; export and restore eligibility remains',
            'blocked pending relation and ordering review.',
          ].join(' ')
      : 'Omission can lose tenant operational, accounting, or historical data; eligibility is not yet approved.',
  }));
}

export const TENANT_BACKUP_BUSINESS_MANIFEST = buildBusinessManifest(BUSINESS_MODEL_NAMES);

const MODEL_POLICY_BY_NAME = new Map(MODEL_ROWS.map((policy) => [policy.model, policy]));

/**
 * @description Returns the explicit model policy without applying any implicit default.
 * @param model - Exact Prisma model name.
 * @returns Reviewed model policy, or undefined when the model is unclassified.
 */
export function getModelPolicy(model: string): TenantBackupModelPolicy | undefined {
  return MODEL_POLICY_BY_NAME.get(model);
}

/**
 * @description Compares supplied generated-model names with the explicit policy registry.
 * @param dmmfModels - Model names from generated Prisma DMMF metadata only.
 * @returns Unknown, missing, and duplicate model policy names; any nonempty list blocks coverage.
 */
export function inspectPolicyCoverage(dmmfModels: readonly { name: string }[]) {
  const supplied = dmmfModels.map(({ name }) => name);
  const suppliedNames = new Set(supplied);
  const policyNames = MODEL_ROWS.map(({ model }) => model);
  const policyNameSet = new Set(policyNames);

  return {
    unknownModels: [...new Set(supplied.filter((name) => !policyNameSet.has(name)))].sort(),
    unregisteredModels: [...policyNameSet].filter((name) => !suppliedNames.has(name)).sort(),
    duplicatePolicies: [...new Set(policyNames.filter((name, index) => policyNames.indexOf(name) !== index))].sort(),
  };
}

/**
 * @description Finds selected models that participate in known unsupported relation cycles.
 * @param selectedModels - Exact model names selected by a future policy evaluation.
 * @returns Every intersecting cycle, which must block the operation until explicitly reviewed.
 */
export function findUnsupportedRestoreCycles(selectedModels: readonly string[]) {
  const selected = new Set(selectedModels);
  return UNSUPPORTED_RESTORE_CYCLES.filter((cycle) => cycle.some((model) => selected.has(model)));
}

/**
 * @description Finds business-manifest entries without an eligible tenant ownership class.
 * @param manifest - Independent business coverage manifest to validate.
 * @param policies - Explicit registry rows; defaults to the checked-in registry.
 * @returns Missing and ineligible business model names; any result blocks future wiring.
 */
export function inspectBusinessManifestCoverage(
  manifest: readonly TenantBackupBusinessManifestEntry[] = TENANT_BACKUP_BUSINESS_MANIFEST,
  policies: readonly TenantBackupModelPolicy[] = MODEL_ROWS,
) {
  const policyByName = new Map(policies.map((policy) => [policy.model, policy]));
  const missingBusinessModels = manifest
    .filter(({ model }) => !policyByName.has(model))
    .map(({ model }) => model);
  const ineligibleBusinessModels = manifest
    .filter(({ model }) => {
      const kind = policyByName.get(model)?.kind;
      return kind !== 'tenant-direct' && kind !== 'tenant-child';
    })
    .map(({ model }) => model);

  return { missingBusinessModels, ineligibleBusinessModels };
}

/**
 * @description Requires a child model's owner path to exactly match its reviewed registry path.
 * @param model - Exact Prisma model name.
 * @param ownerPath - Canonical DMMF-derived path being checked.
 * @returns True only for a child model with the exact declared owner path.
 */
export function matchesDeclaredChildOwnerPath(model: string, ownerPath: string): boolean {
  const policy = getModelPolicy(model);
  return policy?.kind === 'tenant-child' && policy.ownerPath === ownerPath;
}
