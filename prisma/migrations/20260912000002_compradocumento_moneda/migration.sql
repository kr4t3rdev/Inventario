-- B-02.1: moneda de la compra en el documento.
-- Antes la CxP de una compra nacía siempre en CUP aunque la factura fuera en
-- USD/MLC. La columna guarda la moneda elegida en la compra y las CxP la heredan.
-- DEFAULT 'CUP' mantiene el comportamiento histórico en filas existentes.

ALTER TABLE "CompraDocumento" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'CUP';
