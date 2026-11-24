export interface InitialInventoryDraft {
  referenciaFila: string;
  productoId: string;
  almacenId: string;
  loteCodigo: string;
  cantidad: string;
  costoUnitario: string;
  moneda: string;
  tasaCambio: string;
  ubicacionId: string;
  fechaCorte: string;
  fechaVencimiento: string;
}

export interface InitialReceivableDraft {
  referenciaFila: string;
  clienteId: string;
  referenciaExterna: string;
  moneda: string;
  saldo: string;
  fechaVencimiento: string;
  tasaCambio: string;
  tasaInteres: string;
  tasaInteresMoratorio: string;
}

export interface InitialPayableDraft {
  referenciaFila: string;
  proveedorId: string;
  referenciaExterna: string;
  moneda: string;
  saldo: string;
  fechaVencimiento: string;
  tasaCambio: string;
}

/**
 * @description Crea una fila de inventario vacía con una referencia estable.
 * @returns Borrador de inventario listo para edición.
 */
export function newInitialInventoryDraft(): InitialInventoryDraft {
  return {
    referenciaFila: crypto.randomUUID(), productoId: '', almacenId: '', loteCodigo: '',
    cantidad: '', costoUnitario: '', moneda: 'CUP', tasaCambio: '', ubicacionId: '',
    fechaCorte: '', fechaVencimiento: '',
  };
}

/**
 * @description Normaliza una fila parcial de inventario guardada como borrador.
 * @param raw - Fila persistida que puede omitir campos aún no completados.
 * @returns Fila editable con valores de texto seguros y fechas opcionales preservadas.
 */
export function toInitialInventoryDraft(raw: unknown): InitialInventoryDraft {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const defaults = newInitialInventoryDraft();
  return {
    referenciaFila: typeof row.referenciaFila === 'string' ? row.referenciaFila : defaults.referenciaFila,
    productoId: typeof row.productoId === 'string' ? row.productoId : '',
    almacenId: typeof row.almacenId === 'string' ? row.almacenId : '',
    loteCodigo: typeof row.loteCodigo === 'string' ? row.loteCodigo : '',
    cantidad: typeof row.cantidad === 'string' ? row.cantidad : '',
    costoUnitario: typeof row.costoUnitario === 'string' ? row.costoUnitario : '',
    moneda: typeof row.moneda === 'string' ? row.moneda : 'CUP',
    tasaCambio: typeof row.tasaCambio === 'string' ? row.tasaCambio : '',
    ubicacionId: typeof row.ubicacionId === 'string' ? row.ubicacionId : '',
    fechaCorte: typeof row.fechaCorte === 'string' ? row.fechaCorte : '',
    fechaVencimiento: typeof row.fechaVencimiento === 'string' ? row.fechaVencimiento : '',
  };
}

/**
 * @description Crea una fila vacía de cuentas por cobrar.
 * @returns Borrador de CxC listo para edición.
 */
export function newInitialReceivableDraft(): InitialReceivableDraft {
  return {
    referenciaFila: crypto.randomUUID(), clienteId: '', referenciaExterna: '', moneda: 'CUP',
    saldo: '', fechaVencimiento: '', tasaCambio: '', tasaInteres: '', tasaInteresMoratorio: '',
  };
}

/**
 * @description Normaliza una fila parcial de CxC para permitir completar el borrador.
 * @param raw - Fila persistida que puede omitir campos aún no completados.
 * @returns Fila editable con sus textos y tasas preservados.
 */
export function toInitialReceivableDraft(raw: unknown): InitialReceivableDraft {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const text = (key: keyof InitialReceivableDraft) =>
    typeof row[key] === 'string' ? row[key] as string : '';
  return {
    referenciaFila: text('referenciaFila') || crypto.randomUUID(),
    clienteId: text('clienteId'), referenciaExterna: text('referenciaExterna'),
    moneda: text('moneda') || 'CUP', saldo: text('saldo'),
    fechaVencimiento: text('fechaVencimiento'), tasaCambio: text('tasaCambio'),
    tasaInteres: text('tasaInteres'), tasaInteresMoratorio: text('tasaInteresMoratorio'),
  };
}

/**
 * @description Crea una fila vacía de cuentas por pagar.
 * @returns Borrador de CxP listo para edición.
 */
export function newInitialPayableDraft(): InitialPayableDraft {
  return {
    referenciaFila: crypto.randomUUID(), proveedorId: '', referenciaExterna: '', moneda: 'CUP',
    saldo: '', fechaVencimiento: '', tasaCambio: '',
  };
}

/**
 * @description Normaliza una fila parcial de CxP para permitir completar el borrador.
 * @param raw - Fila persistida que puede omitir campos aún no completados.
 * @returns Fila editable con sus textos y fechas preservados.
 */
export function toInitialPayableDraft(raw: unknown): InitialPayableDraft {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const text = (key: keyof InitialPayableDraft) =>
    typeof row[key] === 'string' ? row[key] as string : '';
  return {
    referenciaFila: text('referenciaFila') || crypto.randomUUID(),
    proveedorId: text('proveedorId'), referenciaExterna: text('referenciaExterna'),
    moneda: text('moneda') || 'CUP', saldo: text('saldo'),
    fechaVencimiento: text('fechaVencimiento'), tasaCambio: text('tasaCambio'),
  };
}
