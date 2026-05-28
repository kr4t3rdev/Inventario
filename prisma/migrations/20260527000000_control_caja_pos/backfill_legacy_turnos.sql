-- ============================================
-- Backfill: Crear turnos LEGACY para ventas existentes
-- Ejecutar DESPUÉS de aplicar la migración principal
-- ============================================

-- 1. Crear turnos LEGACY por cada (tenant, puntoDeVenta) con ventas sin turno
INSERT INTO turnos_punto_venta (
    id, "tenantId", "puntoDeVentaId",
    tipo, "fechaApertura", "fechaCierre",
    estado, "fondoInicialCup", "fondoInicialUsd",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    v."tenantId",
    v."puntoDeVentaId",
    'LEGACY',
    MIN(v."createdAt"),
    NOW(),
    'CERRADO',
    0, 0,
    NOW(), NOW()
FROM "Venta" v
WHERE v."turnoId" IS NULL
GROUP BY v."tenantId", v."puntoDeVentaId";

-- 2. Asignar turno LEGACY a ventas huérfanas
UPDATE "Venta" v
SET "turnoId" = tpv.id
FROM turnos_punto_venta tpv
WHERE v."tenantId" = tpv."tenantId"
  AND v."puntoDeVentaId" = tpv."puntoDeVentaId"
  AND v."turnoId" IS NULL
  AND tpv.tipo = 'LEGACY';

-- 3. Actualizar PuntoDeVenta existentes con tipoCaja por defecto
UPDATE "PuntoDeVenta"
SET "tipoCaja" = 'PRINCIPAL'
WHERE "tipoCaja" IS NULL;
