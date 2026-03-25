/*
  Warnings:

  - You are about to drop the column `cargo` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `empresa` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `vendorId` on the `CompraProducto` table. All the data in the column will be lost.
  - The `tipoOperacion` column on the `CompraProducto` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `saldo` on the `CuentaBancaria` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the column `bonificaciones` on the `Empleado` table. All the data in the column will be lost.
  - You are about to drop the column `deducciones` on the `Empleado` table. All the data in the column will be lost.
  - You are about to drop the column `horasExtras` on the `Empleado` table. All the data in the column will be lost.
  - You are about to drop the column `periodo` on the `Empleado` table. All the data in the column will be lost.
  - You are about to drop the column `servicioId` on the `ReconciliacionServicio` table. All the data in the column will be lost.
  - You are about to drop the column `creadoPor` on the `TasaCambio` table. All the data in the column will be lost.
  - You are about to drop the column `realizadoPor` on the `TransferenciaBancaria` table. All the data in the column will be lost.
  - You are about to drop the column `serviciosId` on the `Venta` table. All the data in the column will be lost.
  - You are about to drop the `TransferenciaCabecera` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TransferenciaItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[numeroTransferencia]` on the table `Transferencia` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ofertaId]` on the table `Venta` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `proveedorId` to the `CompraProducto` table without a default value. This is not possible if the table is not empty.
  - Made the column `numeroFactura` on table `CompraProducto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `facturaUrl` on table `CompraProducto` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `formaPago` on the `CompraProducto` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `estado` on the `CompraProducto` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `fechaContratacion` to the `Empleado` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ventaServicioId` to the `ReconciliacionServicio` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoInyeccion" AS ENUM ('CAPITAL_SOCIAL', 'DEUDA_EXTERNA');

-- CreateEnum
CREATE TYPE "EstadoDeuda" AS ENUM ('ACTIVA', 'PAGADA', 'EN_MORA');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('VENTA', 'SERVICIO', 'PROVEEDOR');

-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'ACTIVO', 'FINALIZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoFirma" AS ENUM ('CLIENTE', 'PROVEEDOR', 'INTERNO');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('PENDIENTE', 'PAGADA', 'ANULADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'FACTURA_RECTIFICATIVA', 'PROFORMA');

-- CreateEnum
CREATE TYPE "EstadoOferta" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'FACTURADA');

-- CreateEnum
CREATE TYPE "EstadoCuentaPorCobrar" AS ENUM ('PENDIENTE', 'PAGADA', 'PARCIAL');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('RECIBIDO', 'EN_DIAGNOSTICO', 'ESPERANDO_APROBACION', 'EN_REPARACION', 'ESPERANDO_REPUESTOS', 'TERMINADO', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ComplejidadReparacion" AS ENUM ('PEQUENO', 'MEDIANO', 'GRANDE');

-- CreateEnum
CREATE TYPE "TipoPlato" AS ENUM ('COMIDA', 'BEBIDA', 'POSTRE', 'APERITIVO');

-- CreateEnum
CREATE TYPE "EstadoMesa" AS ENUM ('DISPONIBLE', 'OCUPADA', 'RESERVADA');

-- CreateEnum
CREATE TYPE "EstadoComanda" AS ENUM ('ABIERTA', 'CERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoComandaItem" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'LISTO', 'SERVIDO');

-- CreateEnum
CREATE TYPE "EstadoProduccion" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA');

-- DropForeignKey
ALTER TABLE "CompraProducto" DROP CONSTRAINT "CompraProducto_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "ReconciliacionServicio" DROP CONSTRAINT "ReconciliacionServicio_servicioId_fkey";

-- DropForeignKey
ALTER TABLE "TransferenciaCabecera" DROP CONSTRAINT "TransferenciaCabecera_creadoPorId_fkey";

-- DropForeignKey
ALTER TABLE "TransferenciaItem" DROP CONSTRAINT "TransferenciaItem_cabeceraId_fkey";

-- DropForeignKey
ALTER TABLE "TransferenciaItem" DROP CONSTRAINT "TransferenciaItem_productoId_fkey";

-- DropForeignKey
ALTER TABLE "Venta" DROP CONSTRAINT "Venta_serviciosId_fkey";

-- DropIndex
DROP INDEX "AjusteBancario_cuentaId_idx";

-- DropIndex
DROP INDEX "AjusteBancario_realizadoPor_idx";

-- DropIndex
DROP INDEX "AjusteBancario_tipo_idx";

-- DropIndex
DROP INDEX "CompraProducto_tipoOperacion_idx";

-- DropIndex
DROP INDEX "CompraProducto_vendorId_idx";

-- DropIndex
DROP INDEX "CuentaBancaria_isActive_idx";

-- DropIndex
DROP INDEX "CuentaBancaria_moneda_idx";

-- DropIndex
DROP INDEX "Moneda_esPrincipal_idx";

-- DropIndex
DROP INDEX "Moneda_isActive_idx";

-- DropIndex
DROP INDEX "ReconciliacionGasto_cuentaId_idx";

-- DropIndex
DROP INDEX "ReconciliacionGasto_fechaReconciliacion_idx";

-- DropIndex
DROP INDEX "ReconciliacionGasto_periodo_idx";

-- DropIndex
DROP INDEX "ReconciliacionGasto_referenciaId_idx";

-- DropIndex
DROP INDEX "ReconciliacionGasto_tipoGasto_idx";

-- DropIndex
DROP INDEX "ReconciliacionServicio_cuentaId_idx";

-- DropIndex
DROP INDEX "ReconciliacionServicio_fechaReconciliacion_idx";

-- DropIndex
DROP INDEX "ReconciliacionServicio_servicioId_idx";

-- DropIndex
DROP INDEX "ReconciliacionVenta_cuentaId_idx";

-- DropIndex
DROP INDEX "ReconciliacionVenta_fechaReconciliacion_idx";

-- DropIndex
DROP INDEX "ReconciliacionVenta_reconciliadoPor_idx";

-- DropIndex
DROP INDEX "ReconciliacionVenta_ventaId_idx";

-- DropIndex
DROP INDEX "TasaCambio_fechaVigencia_idx";

-- DropIndex
DROP INDEX "TasaCambio_monedaOrigenId_fechaVigencia_idx";

-- DropIndex
DROP INDEX "TasaCambio_monedaOrigenId_idx";

-- DropIndex
DROP INDEX "TipoPago_isActive_idx";

-- DropIndex
DROP INDEX "TransaccionMoneda_monedaId_idx";

-- DropIndex
DROP INDEX "TransaccionMoneda_referenciaId_idx";

-- DropIndex
DROP INDEX "TransaccionMoneda_tipoTransaccion_idx";

-- DropIndex
DROP INDEX "TransaccionMoneda_tipoTransaccion_referenciaId_idx";

-- DropIndex
DROP INDEX "TransferenciaBancaria_cuentaDestinoId_idx";

-- DropIndex
DROP INDEX "TransferenciaBancaria_cuentaOrigenId_idx";

-- DropIndex
DROP INDEX "TransferenciaBancaria_fechaTransferencia_idx";

-- DropIndex
DROP INDEX "TransferenciaBancaria_realizadoPor_idx";

-- AlterTable
ALTER TABLE "Cliente" DROP COLUMN "cargo",
DROP COLUMN "empresa",
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "listaPrecioId" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "numeroContrato" TEXT,
ADD COLUMN     "numeroCuentaCUP" TEXT,
ADD COLUMN     "numeroCuentaUSD" TEXT,
ADD COLUMN     "telefono" TEXT;

-- AlterTable
ALTER TABLE "CompraProducto" DROP COLUMN "vendorId",
ADD COLUMN     "proveedorId" TEXT NOT NULL,
ALTER COLUMN "numeroFactura" SET NOT NULL,
ALTER COLUMN "facturaUrl" SET NOT NULL,
DROP COLUMN "formaPago",
ADD COLUMN     "formaPago" TEXT NOT NULL,
DROP COLUMN "estado",
ADD COLUMN     "estado" TEXT NOT NULL,
DROP COLUMN "tipoOperacion",
ADD COLUMN     "tipoOperacion" TEXT NOT NULL DEFAULT 'REGULAR';

-- AlterTable
ALTER TABLE "CuentaBancaria" ALTER COLUMN "saldo" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "isActive" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Empleado" DROP COLUMN "bonificaciones",
DROP COLUMN "deducciones",
DROP COLUMN "horasExtras",
DROP COLUMN "periodo",
ADD COLUMN     "diasVacacionesAnuales" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "esTiempoCompleto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fechaContratacion" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vacationDaysAccrued" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "vacationDaysUsed" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MiEmpresa" ADD COLUMN     "nominaFactorHorasExtras" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
ADD COLUMN     "nominaHorasMensuales" INTEGER NOT NULL DEFAULT 240,
ADD COLUMN     "nominaPorcentajeDeduccion" DOUBLE PRECISION NOT NULL DEFAULT 10.0;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "vendorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PuntoDeVenta" ADD COLUMN     "listaPrecioId" TEXT;

-- AlterTable
ALTER TABLE "ReconciliacionGasto" ADD COLUMN     "cuentaPorPagarId" TEXT,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "gastoCompraId" TEXT,
ADD COLUMN     "gastosDEId" TEXT,
ADD COLUMN     "isReconciliada" BOOLEAN DEFAULT false,
ADD COLUMN     "pgId" TEXT;

-- AlterTable
ALTER TABLE "ReconciliacionServicio" DROP COLUMN "servicioId",
ADD COLUMN     "ventaServicioId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ReconciliacionVenta" ADD COLUMN     "idTransferencia" TEXT,
ADD COLUMN     "verificacionTransferenciaId" TEXT;

-- AlterTable
ALTER TABLE "TasaCambio" DROP COLUMN "creadoPor";

-- AlterTable
ALTER TABLE "Transferencia" ADD COLUMN     "costoTotal" INTEGER,
ADD COLUMN     "costoUnitario" INTEGER,
ADD COLUMN     "creadoPorId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'COMPLETADA',
ADD COLUMN     "numeroTransferencia" TEXT;

-- AlterTable
ALTER TABLE "TransferenciaBancaria" DROP COLUMN "realizadoPor",
ADD COLUMN     "existe" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastFailedLogin" TIMESTAMP(3),
ADD COLUMN     "lastModifiedBy" TEXT,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "loginAttempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "contrato" TEXT,
ADD COLUMN     "cuentaCUP" TEXT,
ADD COLUMN     "cuentaUSD" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "telefono" TEXT;

-- AlterTable
ALTER TABLE "Venta" DROP COLUMN "serviciosId",
ADD COLUMN     "esVentaUnica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ofertaId" TEXT,
ADD COLUMN     "ventaPadreId" TEXT;

-- DropTable
DROP TABLE "TransferenciaCabecera";

-- DropTable
DROP TABLE "TransferenciaItem";

-- DropEnum
DROP TYPE "EstadoCompraProducto";

-- DropEnum
DROP TYPE "FormaPagoCompra";

-- DropEnum
DROP TYPE "TipoOperacionCompra";

-- CreateTable
CREATE TABLE "InyeccionCapital" (
    "id" TEXT NOT NULL,
    "tipo" "TipoInyeccion" NOT NULL,
    "montoRecibido" DECIMAL(65,30) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "tasaInteres" DECIMAL(65,30),
    "montoInteres" DECIMAL(65,30),
    "montoTotalDeuda" DECIMAL(65,30),
    "saldoPendiente" DECIMAL(65,30),
    "plazoMeses" INTEGER,
    "fechaInicioPago" TIMESTAMP(3),
    "socio" TEXT,
    "entidadPrestamista" TEXT,
    "cuentaId" TEXT NOT NULL,
    "estado" "EstadoDeuda" DEFAULT 'ACTIVA',
    "descripcion" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InyeccionCapital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoDeuda" (
    "id" TEXT NOT NULL,
    "inyeccionId" TEXT NOT NULL,
    "montoPagado" DECIMAL(65,30) NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cuentaId" TEXT NOT NULL,
    "numeroCuota" INTEGER,
    "comprobante" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagoDeuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaPrecio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaPrecio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioProducto" (
    "id" TEXT NOT NULL,
    "listaPrecioId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecioProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockUbicacion" (
    "stockId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipoUbicacion" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "cantidadReservada" INTEGER NOT NULL DEFAULT 0,
    "cantidadDisponible" INTEGER NOT NULL DEFAULT 0,
    "ultimaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockUbicacion_pkey" PRIMARY KEY ("stockId")
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" TEXT NOT NULL,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "attendanceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "totalHours" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'present',
    "manualCheckIn" TIMESTAMP(3),
    "manualCheckOut" TIMESTAMP(3),
    "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "scheduledHours" DECIMAL(4,2),
    "overtimeHours" DECIMAL(4,2),
    "breakHours" DECIMAL(3,2),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("attendanceId")
);

-- CreateTable
CREATE TABLE "EmployeeWorkSchedule" (
    "scheduleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakStartTime" TEXT,
    "breakEndTime" TEXT,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "scheduledHours" DECIMAL(4,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeWorkSchedule_pkey" PRIMARY KEY ("scheduleId")
);

-- CreateTable
CREATE TABLE "VacationRequest" (
    "requestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysRequested" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacationRequest_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "VacationAccrual" (
    "accrualId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "diasAcumulados" DOUBLE PRECISION NOT NULL,
    "diasPorAntiguedad" INTEGER NOT NULL,
    "diasPorTiempoTrabajado" DOUBLE PRECISION NOT NULL,
    "tipoAcumulacion" TEXT NOT NULL,
    "fechaCalculo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacationAccrual_pkey" PRIMARY KEY ("accrualId")
);

-- CreateTable
CREATE TABLE "Pagosalario" (
    "pgId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "salario" INTEGER NOT NULL,
    "bonificaciones" INTEGER DEFAULT 0,
    "deducciones" INTEGER DEFAULT 0,
    "horasExtras" INTEGER DEFAULT 0,
    "observaciones" TEXT,
    "periodo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pagosalario_pkey" PRIMARY KEY ("pgId")
);

-- CreateTable
CREATE TABLE "CierreContable" (
    "cierreId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "totalVentas" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalGastos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ganancias" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "perdidas" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ingresosCaja" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "egresosCaja" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deudasClientes" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deudasProveedores" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "inventarioVendido" INTEGER NOT NULL DEFAULT 0,
    "inventarioRebajado" INTEGER NOT NULL DEFAULT 0,
    "stockFinal" INTEGER NOT NULL DEFAULT 0,
    "margenGanancia" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "margenPerdida" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ventasVsExistencias" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'abierto',
    "creadoPor" TEXT NOT NULL,
    "aprobadoPor" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CierreContable_pkey" PRIMARY KEY ("cierreId")
);

-- CreateTable
CREATE TABLE "VentaServicios" (
    "ventaServicioId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "observaciones" TEXT,
    "reconciliado" BOOLEAN,
    "clienteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VentaServicios_pkey" PRIMARY KEY ("ventaServicioId")
);

-- CreateTable
CREATE TABLE "CatalogoReparacionConfig" (
    "id" INTEGER NOT NULL,
    "monedaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogoReparacionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertHistory" (
    "id" TEXT NOT NULL,
    "tipoAlerta" TEXT NOT NULL,
    "severidad" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "metric" TEXT,
    "umbral" DECIMAL(65,30),
    "entidadTipo" TEXT,
    "entidadId" TEXT,
    "moneda" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "revisadaPor" TEXT,
    "fechaRevision" TIMESTAMP(3),
    "notasRevision" TEXT,
    "fechaAlerta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "detalles" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportHistory" (
    "id" TEXT NOT NULL,
    "tipoReporte" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "parametros" TEXT,
    "resumenEjecutivo" TEXT,
    "numeroAlertas" INTEGER NOT NULL DEFAULT 0,
    "metricasClave" TEXT,
    "rutaArchivo" TEXT,
    "tamanhoArchivo" INTEGER,
    "generadoPor" TEXT NOT NULL,
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporteBaseId" TEXT,
    "comparacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledReport" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoReporte" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "parametros" TEXT,
    "frecuencia" TEXT NOT NULL,
    "diaSemana" INTEGER,
    "diaMes" INTEGER,
    "hora" TEXT NOT NULL,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Havana',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "enviarEmail" BOOLEAN NOT NULL DEFAULT false,
    "destinatarios" TEXT,
    "asuntoEmail" TEXT,
    "cuerpoEmail" TEXT,
    "ultimaEjecucion" TIMESTAMP(3),
    "proximaEjecucion" TIMESTAMP(3),
    "totalEjecuciones" INTEGER NOT NULL DEFAULT 0,
    "ultimaEjecucionExitosa" BOOLEAN NOT NULL DEFAULT true,
    "creadoPor" TEXT NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaModificacion" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioSimulation" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tasasSimuladas" TEXT NOT NULL,
    "fechaProyeccion" TIMESTAMP(3) NOT NULL,
    "resultados" TEXT NOT NULL,
    "alertas" TEXT,
    "creadoPor" TEXT NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaModificacion" TIMESTAMP(3) NOT NULL,
    "etiquetas" TEXT,
    "esFavorito" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "contratoId" TEXT NOT NULL,
    "numeroContrato" TEXT NOT NULL,
    "tipo" "TipoContrato" NOT NULL,
    "estado" "EstadoContrato" NOT NULL DEFAULT 'BORRADOR',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "monto" DECIMAL(65,30),
    "moneda" TEXT NOT NULL DEFAULT 'CUP',
    "condiciones" JSONB,
    "observaciones" TEXT,
    "clienteId" TEXT,
    "vendorId" TEXT,
    "creadoPor" TEXT NOT NULL,
    "aprobadoPor" TEXT,
    "fechaAprobacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "esMultiMoneda" BOOLEAN NOT NULL DEFAULT false,
    "diasAvisoVencimiento" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("contratoId")
);

-- CreateTable
CREATE TABLE "ContratoVersion" (
    "versionId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "numeroVersion" INTEGER NOT NULL,
    "contenido" JSONB NOT NULL,
    "cambios" TEXT,
    "creadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoVersion_pkey" PRIMARY KEY ("versionId")
);

-- CreateTable
CREATE TABLE "ContratoFirma" (
    "firmaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "firmanteId" TEXT NOT NULL,
    "tipoFirma" "TipoFirma" NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "firmaDigital" TEXT,
    "fechaFirma" TIMESTAMP(3),
    "comentarios" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratoFirma_pkey" PRIMARY KEY ("firmaId")
);

-- CreateTable
CREATE TABLE "ContratoAprobacion" (
    "aprobacionId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "aprobadorId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "comentarios" TEXT,
    "fechaAprobacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratoAprobacion_pkey" PRIMARY KEY ("aprobacionId")
);

-- CreateTable
CREATE TABLE "ContratoArchivo" (
    "archivoId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "versionId" TEXT,
    "tipo" TEXT NOT NULL,
    "rutaArchivo" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "generadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoArchivo_pkey" PRIMARY KEY ("archivoId")
);

-- CreateTable
CREATE TABLE "ContratoAlerta" (
    "alertaId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaAlerta" TIMESTAMP(3) NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "mensaje" TEXT NOT NULL,
    "accionRequerida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoAlerta_pkey" PRIMARY KEY ("alertaId")
);

-- CreateTable
CREATE TABLE "facturas" (
    "idFactura" TEXT NOT NULL,
    "numeroConsecutivo" SERIAL NOT NULL,
    "serieId" TEXT NOT NULL,
    "numeroFactura" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'FACTURA',
    "ventaId" TEXT,
    "clienteId" TEXT NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "impuestos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "observaciones" TEXT,
    "terminosPago" TEXT,
    "metodoPago" TEXT,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'PENDIENTE',
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "creadoPor" TEXT NOT NULL,
    "actualizadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tipoTarjeta" TEXT,
    "cargoTransporte" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cuentaBancariaId" TEXT,
    "tasaCambio" DECIMAL(65,30) DEFAULT 1,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("idFactura")
);

-- CreateTable
CREATE TABLE "series_facturacion" (
    "serieId" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "consecutivo" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "esPorDefecto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_facturacion_pkey" PRIMARY KEY ("serieId")
);

-- CreateTable
CREATE TABLE "Oferta" (
    "id" TEXT NOT NULL,
    "numeroOferta" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "estado" "EstadoOferta" NOT NULL DEFAULT 'PENDIENTE',
    "subtotal" DECIMAL(65,30) NOT NULL,
    "impuestos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfertaItem" (
    "id" TEXT NOT NULL,
    "ofertaId" TEXT NOT NULL,
    "productoId" TEXT,
    "servicioId" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OfertaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaPorCobrar" (
    "id" TEXT NOT NULL,
    "idCC" SERIAL NOT NULL,
    "facturaId" TEXT,
    "numeroFactura" TEXT,
    "clienteId" TEXT NOT NULL,
    "montoDeuda" DECIMAL(65,30) NOT NULL,
    "montoPagado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "idTransferencia" TEXT,
    "estado" "EstadoCuentaPorCobrar" NOT NULL DEFAULT 'PENDIENTE',
    "fechaVencimiento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaPorCobrar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagoCuentaPorPagar" (
    "pagoCuentaPorPagarId" TEXT NOT NULL,
    "cuentaPorPagarId" TEXT NOT NULL,
    "monto" DECIMAL(65,30) NOT NULL,
    "numeroTransaccion" TEXT NOT NULL,
    "cuentaProveedor" TEXT NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagoCuentaPorPagar_pkey" PRIMARY KEY ("pagoCuentaPorPagarId")
);

-- CreateTable
CREATE TABLE "EquipoReparacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipoReparacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PiezaReparacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "costoPequeno" DECIMAL(65,30) NOT NULL,
    "costoMediano" DECIMAL(65,30) NOT NULL,
    "costoGrande" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PiezaReparacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenReparacion" (
    "id" TEXT NOT NULL,
    "numeroOrden" SERIAL NOT NULL,
    "clienteId" TEXT NOT NULL,
    "equipoTipoId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "contrasena" TEXT,
    "accesorios" TEXT,
    "problemaReportado" TEXT NOT NULL,
    "diagnosticoTecnico" TEXT,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'RECIBIDO',
    "prioridad" TEXT NOT NULL DEFAULT 'normal',
    "esGarantia" BOOLEAN NOT NULL DEFAULT false,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEstimada" TIMESTAMP(3),
    "fechaEntrega" TIMESTAMP(3),
    "tecnicoId" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ventaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complejidad" "ComplejidadReparacion",
    "moneda" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "OrdenReparacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenReparacionEquipo" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "equipoTipoId" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "contrasena" TEXT,
    "accesorios" TEXT,
    "fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "problemaReportado" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenReparacionEquipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenReparacionItem" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "piezaId" TEXT,
    "complejidad" "ComplejidadReparacion",
    "precio" DECIMAL(65,30) NOT NULL,
    "observaciones" TEXT,
    "tecnicoId" TEXT,
    "defectacionId" TEXT,
    "ordenEquipoId" TEXT,

    CONSTRAINT "OrdenReparacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenReparacionMaterial" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "OrdenReparacionMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReciboOrdenReparacion" (
    "id" TEXT NOT NULL,
    "numeroRecibo" SERIAL NOT NULL,
    "ordenId" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "equipoInfo" TEXT NOT NULL,
    "problema" TEXT NOT NULL,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estadoInicial" TEXT NOT NULL,
    "fotosIniciales" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReciboOrdenReparacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefectacionCatalogo" (
    "id" TEXT NOT NULL,
    "defecto" TEXT NOT NULL,
    "costo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefectacionCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionSistema" (
    "configId" TEXT NOT NULL,
    "diasAvisoVencimientoContrato" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionSistema_pkey" PRIMARY KEY ("configId")
);

-- CreateTable
CREATE TABLE "CategoriaPlato" (
    "categoriaPlatoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaPlato_pkey" PRIMARY KEY ("categoriaPlatoId")
);

-- CreateTable
CREATE TABLE "Plato" (
    "platoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" INTEGER NOT NULL,
    "imagen" TEXT,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "tipoPlato" "TipoPlato" NOT NULL,
    "esElaborado" BOOLEAN NOT NULL DEFAULT false,
    "categoriaPlatoId" TEXT,
    "recetaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plato_pkey" PRIMARY KEY ("platoId")
);

-- CreateTable
CREATE TABLE "Receta" (
    "recetaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rendimiento" INTEGER NOT NULL DEFAULT 1,
    "costoUnitario" INTEGER NOT NULL DEFAULT 0,
    "instrucciones" TEXT,
    "tiempoPrep" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receta_pkey" PRIMARY KEY ("recetaId")
);

-- CreateTable
CREATE TABLE "RecetaIngrediente" (
    "recetaIngredienteId" TEXT NOT NULL,
    "recetaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "desperdicio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecetaIngrediente_pkey" PRIMARY KEY ("recetaIngredienteId")
);

-- CreateTable
CREATE TABLE "Mesa" (
    "mesaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "capacidad" INTEGER NOT NULL DEFAULT 4,
    "estado" "EstadoMesa" NOT NULL DEFAULT 'DISPONIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("mesaId")
);

-- CreateTable
CREATE TABLE "Comanda" (
    "comandaId" TEXT NOT NULL,
    "mesaId" TEXT NOT NULL,
    "empleadoId" TEXT,
    "estado" "EstadoComanda" NOT NULL DEFAULT 'ABIERTA',
    "total" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comanda_pkey" PRIMARY KEY ("comandaId")
);

-- CreateTable
CREATE TABLE "ComandaItem" (
    "comandaItemId" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "platoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "notas" TEXT,
    "estado" "EstadoComandaItem" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComandaItem_pkey" PRIMARY KEY ("comandaItemId")
);

-- CreateTable
CREATE TABLE "OrdenProduccion" (
    "ordenProduccionId" TEXT NOT NULL,
    "recetaId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "estado" "EstadoProduccion" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "fechaProduccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenProduccion_pkey" PRIMARY KEY ("ordenProduccionId")
);

-- CreateTable
CREATE TABLE "Plan" (
    "planId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "duracionDias" INTEGER NOT NULL DEFAULT 30,
    "funcionalidades" JSONB,
    "maxUsuarios" INTEGER NOT NULL DEFAULT 1,
    "maxAlmacenes" INTEGER NOT NULL DEFAULT 1,
    "maxProductos" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "Licencia" (
    "licenciaId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiracion" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Licencia_pkey" PRIMARY KEY ("licenciaId")
);

-- CreateTable
CREATE TABLE "LicenciaAudit" (
    "auditId" TEXT NOT NULL,
    "licenciaId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalles" TEXT,
    "realizadoPor" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenciaAudit_pkey" PRIMARY KEY ("auditId")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrecioProducto_listaPrecioId_productoId_key" ON "PrecioProducto"("listaPrecioId", "productoId");

-- CreateIndex
CREATE INDEX "StockUbicacion_productoId_idx" ON "StockUbicacion"("productoId");

-- CreateIndex
CREATE INDEX "StockUbicacion_tipoUbicacion_ubicacionId_idx" ON "StockUbicacion"("tipoUbicacion", "ubicacionId");

-- CreateIndex
CREATE INDEX "StockUbicacion_ubicacionId_idx" ON "StockUbicacion"("ubicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "StockUbicacion_productoId_tipoUbicacion_ubicacionId_key" ON "StockUbicacion"("productoId", "tipoUbicacion", "ubicacionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeWorkSchedule_employeeId_dayOfWeek_key" ON "EmployeeWorkSchedule"("employeeId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoReparacionConfig_monedaId_key" ON "CatalogoReparacionConfig"("monedaId");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_numeroContrato_key" ON "Contrato"("numeroContrato");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoVersion_contratoId_numeroVersion_key" ON "ContratoVersion"("contratoId", "numeroVersion");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_numeroFactura_key" ON "facturas"("numeroFactura");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_ventaId_key" ON "facturas"("ventaId");

-- CreateIndex
CREATE UNIQUE INDEX "series_facturacion_prefijo_key" ON "series_facturacion"("prefijo");

-- CreateIndex
CREATE UNIQUE INDEX "Oferta_numeroOferta_key" ON "Oferta"("numeroOferta");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaPorCobrar_facturaId_key" ON "CuentaPorCobrar"("facturaId");

-- CreateIndex
CREATE INDEX "PagoCuentaPorPagar_cuentaPorPagarId_idx" ON "PagoCuentaPorPagar"("cuentaPorPagarId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenReparacion_ventaId_key" ON "OrdenReparacion"("ventaId");

-- CreateIndex
CREATE UNIQUE INDEX "Plato_recetaId_key" ON "Plato"("recetaId");

-- CreateIndex
CREATE UNIQUE INDEX "RecetaIngrediente_recetaId_productoId_key" ON "RecetaIngrediente"("recetaId", "productoId");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_numero_key" ON "Mesa"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Licencia_clave_key" ON "Licencia"("clave");

-- CreateIndex
CREATE INDEX "Licencia_usuarioId_idx" ON "Licencia"("usuarioId");

-- CreateIndex
CREATE INDEX "Licencia_clave_idx" ON "Licencia"("clave");

-- CreateIndex
CREATE INDEX "LicenciaAudit_licenciaId_idx" ON "LicenciaAudit"("licenciaId");

-- CreateIndex
CREATE INDEX "LicenciaAudit_accion_idx" ON "LicenciaAudit"("accion");

-- CreateIndex
CREATE INDEX "LicenciaAudit_createdAt_idx" ON "LicenciaAudit"("createdAt");

-- CreateIndex
CREATE INDEX "CompraProducto_estado_idx" ON "CompraProducto"("estado");

-- CreateIndex
CREATE INDEX "CompraProducto_proveedorId_idx" ON "CompraProducto"("proveedorId");

-- CreateIndex
CREATE INDEX "CuentaPorPagar_estado_idx" ON "CuentaPorPagar"("estado");

-- CreateIndex
CREATE INDEX "CuentaPorPagar_tipo_idx" ON "CuentaPorPagar"("tipo");

-- CreateIndex
CREATE INDEX "CuentaPorPagar_numeroFactura_idx" ON "CuentaPorPagar"("numeroFactura");

-- CreateIndex
CREATE UNIQUE INDEX "Transferencia_numeroTransferencia_key" ON "Transferencia"("numeroTransferencia");

-- CreateIndex
CREATE INDEX "Transferencia_estado_idx" ON "Transferencia"("estado");

-- CreateIndex
CREATE INDEX "Transferencia_creadoPorId_idx" ON "Transferencia"("creadoPorId");

-- CreateIndex
CREATE INDEX "Transferencia_createdAt_idx" ON "Transferencia"("createdAt");

-- CreateIndex
CREATE INDEX "Transferencia_productoId_idx" ON "Transferencia"("productoId");

-- CreateIndex
CREATE INDEX "Transferencia_origenId_idx" ON "Transferencia"("origenId");

-- CreateIndex
CREATE INDEX "Transferencia_destinoId_idx" ON "Transferencia"("destinoId");

-- CreateIndex
CREATE INDEX "Transferencia_deletedAt_idx" ON "Transferencia"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_ofertaId_key" ON "Venta"("ofertaId");

-- AddForeignKey
ALTER TABLE "InyeccionCapital" ADD CONSTRAINT "InyeccionCapital_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoDeuda" ADD CONSTRAINT "PagoDeuda_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoDeuda" ADD CONSTRAINT "PagoDeuda_inyeccionId_fkey" FOREIGN KEY ("inyeccionId") REFERENCES "InyeccionCapital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "ListaPrecio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoDeVenta" ADD CONSTRAINT "PuntoDeVenta_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "ListaPrecio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioProducto" ADD CONSTRAINT "PrecioProducto_listaPrecioId_fkey" FOREIGN KEY ("listaPrecioId") REFERENCES "ListaPrecio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioProducto" ADD CONSTRAINT "PrecioProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockUbicacion" ADD CONSTRAINT "StockUbicacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "Oferta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("ventaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivityLog" ADD CONSTRAINT "UserActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Empleado"("empleadoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWorkSchedule" ADD CONSTRAINT "EmployeeWorkSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Empleado"("empleadoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationRequest" ADD CONSTRAINT "VacationRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Empleado"("empleadoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationAccrual" ADD CONSTRAINT "VacationAccrual_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Empleado"("empleadoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagosalario" ADD CONSTRAINT "Pagosalario_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("empleadoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraProducto" ADD CONSTRAINT "CompraProducto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Vendor"("vendorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaServicios" ADD CONSTRAINT "VentaServicios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaServicios" ADD CONSTRAINT "VentaServicios_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicios"("servicioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogoReparacionConfig" ADD CONSTRAINT "CatalogoReparacionConfig_monedaId_fkey" FOREIGN KEY ("monedaId") REFERENCES "Moneda"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionServicio" ADD CONSTRAINT "ReconciliacionServicio_ventaServicioId_fkey" FOREIGN KEY ("ventaServicioId") REFERENCES "VentaServicios"("ventaServicioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionGasto" ADD CONSTRAINT "ReconciliacionGasto_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "CuentaPorPagar"("cuentaPorPagarId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionGasto" ADD CONSTRAINT "ReconciliacionGasto_gastoCompraId_fkey" FOREIGN KEY ("gastoCompraId") REFERENCES "GastoCompra"("gastoCompraId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionGasto" ADD CONSTRAINT "ReconciliacionGasto_gastosDEId_fkey" FOREIGN KEY ("gastosDEId") REFERENCES "GastosDE"("gastosDEId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliacionGasto" ADD CONSTRAINT "ReconciliacionGasto_pgId_fkey" FOREIGN KEY ("pgId") REFERENCES "Pagosalario"("pgId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_aprobadoPor_fkey" FOREIGN KEY ("aprobadoPor") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("vendorId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoVersion" ADD CONSTRAINT "ContratoVersion_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("contratoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoVersion" ADD CONSTRAINT "ContratoVersion_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoFirma" ADD CONSTRAINT "ContratoFirma_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("contratoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoFirma" ADD CONSTRAINT "ContratoFirma_firmanteId_fkey" FOREIGN KEY ("firmanteId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoAprobacion" ADD CONSTRAINT "ContratoAprobacion_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoAprobacion" ADD CONSTRAINT "ContratoAprobacion_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("contratoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoArchivo" ADD CONSTRAINT "ContratoArchivo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("contratoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoArchivo" ADD CONSTRAINT "ContratoArchivo_generadoPor_fkey" FOREIGN KEY ("generadoPor") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoArchivo" ADD CONSTRAINT "ContratoArchivo_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ContratoVersion"("versionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoAlerta" ADD CONSTRAINT "ContratoAlerta_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("contratoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "CuentaBancaria"("cuentaId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "series_facturacion"("serieId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("ventaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oferta" ADD CONSTRAINT "Oferta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaItem" ADD CONSTRAINT "OfertaItem_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "Oferta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaItem" ADD CONSTRAINT "OfertaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaItem" ADD CONSTRAINT "OfertaItem_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicios"("servicioId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaPorCobrar" ADD CONSTRAINT "CuentaPorCobrar_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaPorCobrar" ADD CONSTRAINT "CuentaPorCobrar_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "facturas"("idFactura") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoCuentaPorPagar" ADD CONSTRAINT "PagoCuentaPorPagar_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "CuentaPorPagar"("cuentaPorPagarId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PiezaReparacion" ADD CONSTRAINT "PiezaReparacion_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "EquipoReparacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacion" ADD CONSTRAINT "OrdenReparacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("clienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacion" ADD CONSTRAINT "OrdenReparacion_equipoTipoId_fkey" FOREIGN KEY ("equipoTipoId") REFERENCES "EquipoReparacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacion" ADD CONSTRAINT "OrdenReparacion_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Empleado"("empleadoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacion" ADD CONSTRAINT "OrdenReparacion_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("ventaId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacionEquipo" ADD CONSTRAINT "OrdenReparacionEquipo_equipoTipoId_fkey" FOREIGN KEY ("equipoTipoId") REFERENCES "EquipoReparacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacionEquipo" ADD CONSTRAINT "OrdenReparacionEquipo_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenReparacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacionItem" ADD CONSTRAINT "OrdenReparacionItem_defectacionId_fkey" FOREIGN KEY ("defectacionId") REFERENCES "DefectacionCatalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacionItem" ADD CONSTRAINT "OrdenReparacionItem_ordenEquipoId_fkey" FOREIGN KEY ("ordenEquipoId") REFERENCES "OrdenReparacionEquipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacionItem" ADD CONSTRAINT "OrdenReparacionItem_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenReparacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacionItem" ADD CONSTRAINT "OrdenReparacionItem_piezaId_fkey" FOREIGN KEY ("piezaId") REFERENCES "PiezaReparacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacionMaterial" ADD CONSTRAINT "OrdenReparacionMaterial_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenReparacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenReparacionMaterial" ADD CONSTRAINT "OrdenReparacionMaterial_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReciboOrdenReparacion" ADD CONSTRAINT "ReciboOrdenReparacion_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenReparacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plato" ADD CONSTRAINT "Plato_categoriaPlatoId_fkey" FOREIGN KEY ("categoriaPlatoId") REFERENCES "CategoriaPlato"("categoriaPlatoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plato" ADD CONSTRAINT "Plato_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("recetaId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetaIngrediente" ADD CONSTRAINT "RecetaIngrediente_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("recetaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetaIngrediente" ADD CONSTRAINT "RecetaIngrediente_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("mesaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("empleadoId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("comandaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_platoId_fkey" FOREIGN KEY ("platoId") REFERENCES "Plato"("platoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenProduccion" ADD CONSTRAINT "OrdenProduccion_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("recetaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licencia" ADD CONSTRAINT "Licencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licencia" ADD CONSTRAINT "Licencia_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("planId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenciaAudit" ADD CONSTRAINT "LicenciaAudit_licenciaId_fkey" FOREIGN KEY ("licenciaId") REFERENCES "Licencia"("licenciaId") ON DELETE CASCADE ON UPDATE CASCADE;
