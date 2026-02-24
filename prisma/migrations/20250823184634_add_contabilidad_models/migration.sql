-- CreateTable
CREATE TABLE "Moneda" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "simbolo" TEXT NOT NULL,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Moneda_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "TasaCambio" (
    "tasaId" TEXT NOT NULL,
    "monedaOrigenId" TEXT NOT NULL,
    "monedaDestino" TEXT NOT NULL,
    "tasa" DECIMAL(65,30) NOT NULL,
    "fechaVigencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TasaCambio_pkey" PRIMARY KEY ("tasaId")
);

-- CreateTable
CREATE TABLE "TransaccionMoneda" (
    "transaccionId" TEXT NOT NULL,
    "tipoTransaccion" TEXT NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "monedaId" TEXT NOT NULL,
    "montoOriginal" DECIMAL(65,30) NOT NULL,
    "tasaCambio" DECIMAL(65,30) NOT NULL,
    "montoConvertido" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransaccionMoneda_pkey" PRIMARY KEY ("transaccionId")
);

-- CreateTable
CREATE TABLE "CuentaBancaria" (
    "cuentaId" TEXT NOT NULL,
    "nombreBanco" TEXT NOT NULL,
    "numeroCuenta" TEXT NOT NULL,
    "tipoCuenta" TEXT NOT NULL,
    "saldo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaBancaria_pkey" PRIMARY KEY ("cuentaId")
);

-- CreateTable
CREATE TABLE "TipoPago" (
    "tipoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "requiereCuenta" BOOLEAN NOT NULL DEFAULT true,
    "cuentaDefecto" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoPago_pkey" PRIMARY KEY ("tipoId")
);

-- CreateTable
CREATE TABLE "ReconciliacionVenta" (
    "reconciliacionId" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "tipoPagoId" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "tasaCambio" DECIMAL(65,30),
    "montoConvertido" DECIMAL(65,30),
    "fechaReconciliacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "reconciliadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliacionVenta_pkey" PRIMARY KEY ("reconciliacionId")
);

-- CreateTable
CREATE TABLE "ReconciliacionServicio" (
    "reconciliacionId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "tipoPagoId" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "tasaCambio" DECIMAL(65,30),
    "montoConvertido" DECIMAL(65,30),
    "fechaReconciliacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "reconciliadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliacionServicio_pkey" PRIMARY KEY ("reconciliacionId")
);

-- CreateTable
CREATE TABLE "ReconciliacionGasto" (
    "reconciliacionId" TEXT NOT NULL,
    "tipoGasto" TEXT NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "tipoPagoId" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "tasaCambio" DECIMAL(65,30),
    "montoConvertido" DECIMAL(65,30),
    "descripcion" TEXT NOT NULL,
    "periodo" TEXT,
    "fechaReconciliacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "reconciliadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliacionGasto_pkey" PRIMARY KEY ("reconciliacionId")
);

-- CreateTable
CREATE TABLE "AjusteBancario" (
    "ajusteId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "tasaCambio" DECIMAL(65,30),
    "montoConvertido" DECIMAL(65,30),
    "descripcion" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "realizadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AjusteBancario_pkey" PRIMARY KEY ("ajusteId")
);

-- CreateTable
CREATE TABLE "TransferenciaBancaria" (
    "transferenciaId" TEXT NOT NULL,
    "numeroComprobante" TEXT NOT NULL,
    "cuentaOrigenId" TEXT NOT NULL,
    "cuentaDestinoId" TEXT NOT NULL,
    "montoOrigen" DECIMAL(65,30) NOT NULL,
    "monedaOrigen" TEXT NOT NULL,
    "montoDestino" DECIMAL(65,30) NOT NULL,
    "monedaDestino" TEXT NOT NULL,
    "tasaCambio" DECIMAL(65,30),
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "realizadoPor" TEXT NOT NULL,
    "fechaTransferencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprobanteGenerado" BOOLEAN NOT NULL DEFAULT true,
    "rutaComprobante" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferenciaBancaria_pkey" PRIMARY KEY ("transferenciaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaBancaria_numeroCuenta_key" ON "CuentaBancaria"("numeroCuenta");

-- CreateIndex
CREATE UNIQUE INDEX "TransferenciaBancaria_numeroComprobante_key" ON "TransferenciaBancaria"("numeroComprobante");

-- AddForeignKey
ALTER TABLE "TasaCambio" ADD CONSTRAINT "TasaCambio_monedaOrigenId_fkey" FOREIGN KEY ("monedaOrigenId") REFERENCES "Moneda"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransaccionMoneda" ADD CONSTRAINT "TransaccionMoneda_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "Moneda"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionVenta" ADD CONSTRAINT "ReconciliacionVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("ventaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionVenta" ADD CONSTRAINT "ReconciliacionVenta_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionVenta" ADD CONSTRAINT "ReconciliacionVenta_tipoPagoId_fkey" FOREIGN KEY ("tipoPagoId") REFERENCES "TipoPago"("tipoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionServicio" ADD CONSTRAINT "ReconciliacionServicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicios"("servicioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionServicio" ADD CONSTRAINT "ReconciliacionServicio_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionServicio" ADD CONSTRAINT "ReconciliacionServicio_tipoPagoId_fkey" FOREIGN KEY ("tipoPagoId") REFERENCES "TipoPago"("tipoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionGasto" ADD CONSTRAINT "ReconciliacionGasto_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionGasto" ADD CONSTRAINT "ReconciliacionGasto_tipoPagoId_fkey" FOREIGN KEY ("tipoPagoId") REFERENCES "TipoPago"("tipoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AjusteBancario" ADD CONSTRAINT "AjusteBancario_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaBancaria" ADD CONSTRAINT "TransferenciaBancaria_cuentaOrigenId_fkey" FOREIGN KEY ("cuentaOrigenId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferenciaBancaria" ADD CONSTRAINT "TransferenciaBancaria_cuentaDestinoId_fkey" FOREIGN KEY ("cuentaDestinoId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE RESTRICT ON UPDATE CASCADE;
