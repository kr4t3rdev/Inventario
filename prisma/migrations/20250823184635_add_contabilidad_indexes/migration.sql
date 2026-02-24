-- Add indexes for better performance on contabilidad queries

-- Indexes for ReconciliacionVenta
CREATE INDEX "ReconciliacionVenta_ventaId_idx" ON "ReconciliacionVenta"("ventaId");
CREATE INDEX "ReconciliacionVenta_cuentaId_idx" ON "ReconciliacionVenta"("cuentaId");
CREATE INDEX "ReconciliacionVenta_fechaReconciliacion_idx" ON "ReconciliacionVenta"("fechaReconciliacion");
CREATE INDEX "ReconciliacionVenta_reconciliadoPor_idx" ON "ReconciliacionVenta"("reconciliadoPor");

-- Indexes for ReconciliacionServicio
CREATE INDEX "ReconciliacionServicio_servicioId_idx" ON "ReconciliacionServicio"("servicioId");
CREATE INDEX "ReconciliacionServicio_cuentaId_idx" ON "ReconciliacionServicio"("cuentaId");
CREATE INDEX "ReconciliacionServicio_fechaReconciliacion_idx" ON "ReconciliacionServicio"("fechaReconciliacion");

-- Indexes for ReconciliacionGasto
CREATE INDEX "ReconciliacionGasto_tipoGasto_idx" ON "ReconciliacionGasto"("tipoGasto");
CREATE INDEX "ReconciliacionGasto_referenciaId_idx" ON "ReconciliacionGasto"("referenciaId");
CREATE INDEX "ReconciliacionGasto_cuentaId_idx" ON "ReconciliacionGasto"("cuentaId");
CREATE INDEX "ReconciliacionGasto_fechaReconciliacion_idx" ON "ReconciliacionGasto"("fechaReconciliacion");
CREATE INDEX "ReconciliacionGasto_periodo_idx" ON "ReconciliacionGasto"("periodo");

-- Indexes for TasaCambio
CREATE INDEX "TasaCambio_monedaOrigenId_idx" ON "TasaCambio"("monedaOrigenId");
CREATE INDEX "TasaCambio_fechaVigencia_idx" ON "TasaCambio"("fechaVigencia");
CREATE INDEX "TasaCambio_monedaOrigenId_fechaVigencia_idx" ON "TasaCambio"("monedaOrigenId", "fechaVigencia");

-- Indexes for TransaccionMoneda
CREATE INDEX "TransaccionMoneda_tipoTransaccion_idx" ON "TransaccionMoneda"("tipoTransaccion");
CREATE INDEX "TransaccionMoneda_referenciaId_idx" ON "TransaccionMoneda"("referenciaId");
CREATE INDEX "TransaccionMoneda_monedaId_idx" ON "TransaccionMoneda"("monedaId");
CREATE INDEX "TransaccionMoneda_tipoTransaccion_referenciaId_idx" ON "TransaccionMoneda"("tipoTransaccion", "referenciaId");

-- Indexes for CuentaBancaria
CREATE INDEX "CuentaBancaria_isActive_idx" ON "CuentaBancaria"("isActive");
CREATE INDEX "CuentaBancaria_moneda_idx" ON "CuentaBancaria"("moneda");

-- Indexes for TipoPago
CREATE INDEX "TipoPago_isActive_idx" ON "TipoPago"("isActive");

-- Indexes for AjusteBancario
CREATE INDEX "AjusteBancario_cuentaId_idx" ON "AjusteBancario"("cuentaId");
CREATE INDEX "AjusteBancario_tipo_idx" ON "AjusteBancario"("tipo");
CREATE INDEX "AjusteBancario_realizadoPor_idx" ON "AjusteBancario"("realizadoPor");

-- Indexes for TransferenciaBancaria
CREATE INDEX "TransferenciaBancaria_cuentaOrigenId_idx" ON "TransferenciaBancaria"("cuentaOrigenId");
CREATE INDEX "TransferenciaBancaria_cuentaDestinoId_idx" ON "TransferenciaBancaria"("cuentaDestinoId");
CREATE INDEX "TransferenciaBancaria_fechaTransferencia_idx" ON "TransferenciaBancaria"("fechaTransferencia");
CREATE INDEX "TransferenciaBancaria_realizadoPor_idx" ON "TransferenciaBancaria"("realizadoPor");

-- Indexes for Moneda
CREATE INDEX "Moneda_isActive_idx" ON "Moneda"("isActive");
CREATE INDEX "Moneda_esPrincipal_idx" ON "Moneda"("esPrincipal");