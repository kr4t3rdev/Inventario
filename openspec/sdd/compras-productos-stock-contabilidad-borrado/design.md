# Design: Corrección de stock legacy, reconciliación contable y borrado seguro en compras-productos

## Technical Approach

Cuatro problemas con diferentes niveles de complejidad. La estrategia es:

1. **H1 (Stock legacy)**: Fix simple — agregar una línea de actualización de `producto.stock` después de `upsertStockUbicacion`.
2. **H3 (Borrado seguro)**: Validación condicional — verificar presencia de relaciones antes de permitir borrado.
3. **H2 (Reconciliación contable)**: Lógica condicional compleja — implementar reconciliación solo para casos simples (PAGO_PARCIAL ↔ PAGO_COMPLETO), bloquear casos con anticipo.
4. **H4 (Tests)**: Cobertura de invariantes — agregar tests que validen las propiedades críticas del sistema.

## Detailed Design

### H1 — Stock legacy (`src/features/compras-productos/actions.ts:137-147`)

**Current code:**
```typescript
for (const item of items) {
  const oldPrecioCosto = item.producto.precioCosto;

  await tx.producto.update({
    where: { id: item.producto.id },
    data: {
      precioCosto: item.nuevoPrecioCosto.precioCostoNuevo,
    },
  });

  await upsertStockUbicacion(tx, {
    tenantId, productoId: item.producto.id, tipoUbicacion: 'almacen',
    ubicacionId: item.producto.almacenId, modo: 'increment', delta: item.cantidad,
  });

  // ... cost history
}
```

**Fix:**
```typescript
for (const item of items) {
  const oldPrecioCosto = item.producto.precioCosto;

  await tx.producto.update({
    where: { id: item.producto.id },
    data: {
      precioCosto: item.nuevoPrecioCosto.precioCostoNuevo,
    },
  });

  await upsertStockUbicacion(tx, {
    tenantId, productoId: item.producto.id, tipoUbicacion: 'almacen',
    ubicacionId: item.producto.almacenId, modo: 'increment', delta: item.cantidad,
  });

  // Sincronizar producto.stock (legacy) con StockUbicacion
  await tx.producto.update({
    where: { id: item.producto.id },
    data: {
      stock: { increment: item.cantidad },
    },
  });

  // ... cost history
}
```

**Note:** Se hacen dos `producto.update` separados para mantener claridad. Podrían combinarse en uno solo, pero mantenerlos separados hace explícito que uno actualiza precio y el otro stock.

---

### H3 — Borrado seguro (`src/features/compras-productos/actions.ts:267-279`)

**Current code:**
```typescript
export const deleteCompraProductoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const compra = await prisma.compraDocumento.findFirst({ where: { compraDocumentoId: id, tenantId } });
  if (!compra) throw new ActionError('Compra no encontrada', 'NOT_FOUND');

  // Soft delete
  await prisma.compraDocumento.update({
    where: { compraDocumentoId: id },
    data: { deletedAt: new Date() },
  });

  revalidatePath('/busy/compras-productos');
  return { id, eliminado: true };
});
```

**Fixed code:**
```typescript
export const deleteCompraProductoAction = withAction(async (id: string, user: AuthenticatedUser) => {
  const tenantId = requireTenant(user);
  const compra = await prisma.compraDocumento.findFirst({ 
    where: { compraDocumentoId: id, tenantId },
    include: {
      cuentaPorPagar: true,
    }
  });
  if (!compra) throw new ActionError('Compra no encontrada', 'NOT_FOUND');

  // Validar que no tenga impacto contable
  if (compra.gastoCompraId) {
    throw new ActionError(
      'No se puede eliminar la compra porque tiene gasto contable asociado. Revierta el gasto desde Contabilidad primero.',
      'HAS_IMPACT'
    );
  }

  if (compra.cuentaPorPagarId) {
    throw new ActionError(
      'No se puede eliminar la compra porque tiene cuenta por pagar asociada. Revierta la cuenta desde Contabilidad primero.',
      'HAS_IMPACT'
    );
  }

  // Verificar si tiene anticipo aplicado
  const anticipoMovimiento = await prisma.anticipoMovimiento.findFirst({
    where: {
      documentoDestinoId: id,
      contexto: 'COMPRA_PRODUCTO',
    },
  });

  if (anticipoMovimiento) {
    throw new ActionError(
      'No se puede eliminar la compra porque tiene anticipo aplicado. Revierta el anticipo primero.',
      'HAS_IMPACT'
    );
  }

  // Soft delete
  await prisma.compraDocumento.update({
    where: { compraDocumentoId: id },
    data: { deletedAt: new Date() },
  });

  revalidatePath('/busy/compras-productos');
  return { id, eliminado: true };
});
```

**Decisiones:**
- Se usa `include: { cuentaPorPagar: true }` para cargar la relación y verificar estado/saldo si es necesario en el futuro.
- Se verifica `AnticipoMovimiento` con `documentoDestinoId` y `contexto: 'COMPRA_PRODUCTO'` para detectar anticipos aplicados.
- Los errores usan código `'HAS_IMPACT'` para que la UI pueda mostrar mensajes específicos.

---

### H2 — Reconciliación contable (`src/features/compras-productos/actions.ts:250-261`)

**Current code:**
```typescript
export const updateCompraProductoAction = withAction(async (input: UpdateCompraProductoInput, user: AuthenticatedUser) => {
  const parsed = updateCompraProductoSchema.parse(input);
  const { compraDocumentoId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.compraDocumento.findFirst({ where: { compraDocumentoId, tenantId } });
  if (!existing) throw new ActionError('Compra no encontrada', 'NOT_FOUND');

  const updateData: Record<string, any> = {};
  if (data.numeroFactura !== undefined) updateData.numeroFactura = data.numeroFactura;
  if (data.facturaUrl !== undefined) updateData.facturaUrl = data.facturaUrl;
  if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
  if (data.formaPago !== undefined) updateData.formaPago = data.formaPago;
  if (data.estado !== undefined) updateData.estado = data.estado;

  const updated = await prisma.compraDocumento.update({
    where: { compraDocumentoId },
    data: updateData,
    include: COMPRA_INCLUDE,
  });

  revalidatePath('/busy/compras-productos');
  return updated;
});
```

**Fixed code:**
```typescript
export const updateCompraProductoAction = withAction(async (input: UpdateCompraProductoInput, user: AuthenticatedUser) => {
  const parsed = updateCompraProductoSchema.parse(input);
  const { compraDocumentoId, ...data } = parsed;
  const tenantId = requireTenant(user);

  const existing = await prisma.compraDocumento.findFirst({ 
    where: { compraDocumentoId, tenantId },
    include: {
      cuentaPorPagar: true,
    }
  });
  if (!existing) throw new ActionError('Compra no encontrada', 'NOT_FOUND');

  // Si cambia formaPago, ejecutar reconciliación contable
  if (data.formaPago !== undefined && data.formaPago !== existing.formaPago) {
    await reconcileFormaPago(existing, data.formaPago);
  }

  const updateData: Record<string, any> = {};
  if (data.numeroFactura !== undefined) updateData.numeroFactura = data.numeroFactura;
  if (data.facturaUrl !== undefined) updateData.facturaUrl = data.facturaUrl;
  if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
  if (data.formaPago !== undefined) updateData.formaPago = data.formaPago;
  if (data.estado !== undefined) updateData.estado = data.estado;

  const updated = await prisma.compraDocumento.update({
    where: { compraDocumentoId },
    data: updateData,
    include: COMPRA_INCLUDE,
  });

  revalidatePath('/busy/compras-productos');
  return updated;
});

/**
 * @description Reconcilia entidades contables al cambiar formaPago
 */
async function reconcileFormaPago(
  compra: CompraDocumento & { cuentaPorPagar: CuentaPorPagar | null },
  nuevaFormaPago: string
): Promise<void> {
  const oldFormaPago = compra.formaPago;

  // Bloquear cambios desde/hacia ANTICIPO_PAGO (no hay reversión implementada)
  if (oldFormaPago === 'ANTICIPO_PAGO' || nuevaFormaPago === 'ANTICIPO_PAGO') {
    throw new ActionError(
      'No se puede cambiar desde/hacia ANTICIPO_PAGO porque la reconciliación de anticipos no está implementada. Anule la compra y cree una nueva.',
      'ANTICIPO_RECONCILIATION_NOT_IMPLEMENTED'
    );
  }

  // PAGO_PARCIAL → PAGO_COMPLETO: eliminar cuentaPorPagar
  if (oldFormaPago === 'PAGO_PARCIAL' && nuevaFormaPago === 'PAGO_COMPLETO') {
    if (!compra.cuentaPorPagarId || !compra.cuentaPorPagar) {
      throw new ActionError(
        'La compra no tiene cuenta por pagar asociada pero la forma de pago es PAGO_PARCIAL. Inconsistencia de datos.',
        'DATA_INCONSISTENCY'
      );
    }

    const cxp = compra.cuentaPorPagar;
    // Validar que no tenga pagos parciales
    if (cxp.saldoPendiente < cxp.montoDeuda) {
      throw new ActionError(
        'No se puede cambiar la forma de pago porque la cuenta por pagar tiene pagos parciales aplicados. Revierta los pagos desde Contabilidad primero.',
        'CXP_HAS_PAYMENTS'
      );
    }

    // Eliminar cuentaPorPagar
    await prisma.cuentaPorPagar.delete({
      where: { cuentaPorPagarId: compra.cuentaPorPagarId },
    });

    // Desvincular de la compra
    await prisma.compraDocumento.update({
      where: { compraDocumentoId: compra.compraDocumentoId },
      data: { cuentaPorPagarId: null },
    });
  }

  // PAGO_COMPLETO → PAGO_PARCIAL: crear cuentaPorPagar
  if (oldFormaPago === 'PAGO_COMPLETO' && nuevaFormaPago === 'PAGO_PARCIAL') {
    if (compra.cuentaPorPagarId) {
      throw new ActionError(
        'La compra ya tiene cuenta por pagar asociada pero la forma de pago es PAGO_COMPLETO. Inconsistencia de datos.',
        'DATA_INCONSISTENCY'
      );
    }

    // Crear cuentaPorPagar
    const cxp = await prisma.cuentaPorPagar.create({
      data: {
        tenantId: compra.tenantId,
        numeroFactura: compra.numeroFactura || '',
        gastoCompraId: compra.gastoCompraId || undefined,
        montoDeuda: compra.total,
        saldoPendiente: compra.total,
        moneda: 'CUP',
        estado: 'PENDIENTE',
        tipo: 'compra',
        proveedorId: compra.proveedorId,
      },
    });

    // Vincular a la compra
    await prisma.compraDocumento.update({
      where: { compraDocumentoId: compra.compraDocumentoId },
      data: { cuentaPorPagarId: cxp.cuentaPorPagarId },
    });
  }
}
```

**Decisiones:**
- Se extrae la lógica de reconciliación en una función separada `reconcileFormaPago` para mantener claridad.
- Se bloquean cambios desde/hacia `ANTICIPO_PAGO` porque no hay función de reversión de anticipo implementada.
- Se valida que `cuentaPorPagar.saldoPendiente === montoDeuda` antes de eliminar (no tiene pagos parciales).
- Se usa `prisma.$transaction` implícito (cada operación es atómica). Si se requiere atomicidad cruzada, envolver en transacción explícita.

**Riesgo:** Si `reconcileFormaPago` falla después de crear/eliminar `cuentaPorPagar`, la compra puede quedar en estado inconsistente. Mitigación: envolver todo en transacción si es necesario.

---

### H4 — Tests (`src/features/compras-productos/__tests__/actions.test.ts`)

**Estrategia:**
- Usar mocks realistas que reflejen el schema de Prisma.
- Validar llamadas a `producto.update` con `stock: { increment }`.
- Validar que `deleteCompraProductoAction` rechaza compras con impacto.
- Validar reconciliación de `cuentaPorPagar` al cambiar `formaPago`.

**Tests a agregar:**

```typescript
describe("createCompraProductoAction - stock legacy", () => {
  it("sincroniza producto.stock con StockUbicacion", async () => {
    // Setup mocks
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.producto.findFirst).mockResolvedValue({
      id: 'prod-1',
      almacenId: 'alm-1',
      precioCosto: 100,
      precioVenta: 150,
    } as any);
    vi.mocked(calcularPrecioCostoCompra).mockReturnValue(110);
    vi.mocked(upsertStockUbicacion).mockResolvedValue(undefined);
    vi.mocked(mockTx.producto.update).mockResolvedValue({});
    vi.mocked(mockTx.compraDocumento.create).mockResolvedValue({ compraDocumentoId: 'cd-1' });
    vi.mocked(mockTx.gastoCompra.create).mockResolvedValue({ gastoCompraId: 'gc-1' });
    vi.mocked(prisma.compraDocumento.update).mockResolvedValue({});
    vi.mocked(hasUnrevertedAnticipoExecution).mockResolvedValue(false);

    const input = {
      proveedorId: 'prov-1',
      numeroFactura: 'F-001',
      formaPago: 'PAGO_COMPLETO',
      items: [{
        productoId: 'prod-1',
        cantidad: 5,
        precioUnitario: 100,
      }],
      idempotencyKey: 'key-1',
    };

    await createCompraProductoAction(input);

    // Validar que producto.update se llamó con stock: { increment }
    expect(mockTx.producto.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-1' },
        data: { stock: { increment: 5 } },
      })
    );
  });
});

describe("deleteCompraProductoAction - borrado seguro", () => {
  it("rechaza borrar compra con gastoCompraId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
      compraDocumentoId: 'cd-1',
      gastoCompraId: 'gc-1',
      cuentaPorPagarId: null,
    } as any);

    const result = await deleteCompraProductoAction('cd-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HAS_IMPACT');
    expect(prisma.compraDocumento.update).not.toHaveBeenCalled();
  });

  it("rechaza borrar compra con cuentaPorPagarId", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
      compraDocumentoId: 'cd-1',
      gastoCompraId: null,
      cuentaPorPagarId: 'cxp-1',
    } as any);

    const result = await deleteCompraProductoAction('cd-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HAS_IMPACT');
  });

  it("rechaza borrar compra con anticipo aplicado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
      compraDocumentoId: 'cd-1',
      gastoCompraId: null,
      cuentaPorPagarId: null,
    } as any);
    vi.mocked(prisma.anticipoMovimiento.findFirst).mockResolvedValue({
      movimientoId: 'mov-1',
    } as any);

    const result = await deleteCompraProductoAction('cd-1');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('HAS_IMPACT');
  });

  it("permite borrar compra sin impacto", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
      compraDocumentoId: 'cd-1',
      gastoCompraId: null,
      cuentaPorPagarId: null,
    } as any);
    vi.mocked(prisma.anticipoMovimiento.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.compraDocumento.update).mockResolvedValue({});

    const result = await deleteCompraProductoAction('cd-1');

    expect(result.success).toBe(true);
    expect(prisma.compraDocumento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { compraDocumentoId: 'cd-1' },
        data: { deletedAt: expect.any(Date) },
      })
    );
  });
});

describe("updateCompraProductoAction - reconciliación contable", () => {
  it("cambia PAGO_PARCIAL a PAGO_COMPLETO eliminando cuentaPorPagar", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
      compraDocumentoId: 'cd-1',
      formaPago: 'PAGO_PARCIAL',
      cuentaPorPagarId: 'cxp-1',
      cuentaPorPagar: {
        cuentaPorPagarId: 'cxp-1',
        montoDeuda: 1000,
        saldoPendiente: 1000,
        estado: 'PENDIENTE',
      },
    } as any);
    vi.mocked(prisma.cuentaPorPagar.delete).mockResolvedValue({});
    vi.mocked(prisma.compraDocumento.update).mockResolvedValue({});

    const result = await updateCompraProductoAction({
      compraDocumentoId: 'cd-1',
      formaPago: 'PAGO_COMPLETO',
    });

    expect(prisma.cuentaPorPagar.delete).toHaveBeenCalledWith({
      where: { cuentaPorPagarId: 'cxp-1' },
    });
    expect(prisma.compraDocumento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cuentaPorPagarId: null }),
      })
    );
  });

  it("rechaza cambiar a ANTICIPO_PAGO", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
      compraDocumentoId: 'cd-1',
      formaPago: 'PAGO_COMPLETO',
    } as any);

    const result = await updateCompraProductoAction({
      compraDocumentoId: 'cd-1',
      formaPago: 'ANTICIPO_PAGO',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('ANTICIPO_RECONCILIATION_NOT_IMPLEMENTED');
  });

  it("rechaza cambiar PAGO_PARCIAL con pagos parciales", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(prisma.compraDocumento.findFirst).mockResolvedValue({
      compraDocumentoId: 'cd-1',
      formaPago: 'PAGO_PARCIAL',
      cuentaPorPagarId: 'cxp-1',
      cuentaPorPagar: {
        cuentaPorPagarId: 'cxp-1',
        montoDeuda: 1000,
        saldoPendiente: 500, // Tiene pagos parciales
        estado: 'PENDIENTE',
      },
    } as any);

    const result = await updateCompraProductoAction({
      compraDocumentoId: 'cd-1',
      formaPago: 'PAGO_COMPLETO',
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CXP_HAS_PAYMENTS');
  });
});
```
