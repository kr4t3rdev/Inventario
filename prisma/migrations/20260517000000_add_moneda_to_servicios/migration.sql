-- Migration: Add moneda field to Servicios
ALTER TABLE "Servicios" ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'CUP';
