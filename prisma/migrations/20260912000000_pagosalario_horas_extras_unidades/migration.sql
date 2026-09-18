-- B-05: separación de unidades en horas extras de nómina.
-- Antes: `horasExtras` guardaba HORAS pero se sumaba como dinero al pago
-- (dashboard, reconciliación) y el diálogo de edición usaba tarifas distintas
-- (240 h vs 192 h). Ahora:
--   - `horasExtrasHoras`: cantidad de horas extras trabajadas (unidad: horas).
--   - `montoHorasExtras`: pago de esas horas (horas × salarioBase/192 × 1.5).
--   - `horasExtras` queda como campo legacy de solo lectura histórica.
-- Backfill: las horas históricas se conservan en `horasExtrasHoras`; el monto
-- histórico queda en 0 a propósito (no se fabrica dinero retroactivo: el
-- sistema nunca pagó esas horas como dinero real, solo las mostraba mal).

ALTER TABLE "Pagosalario" ADD COLUMN "horasExtrasHoras" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Pagosalario" ADD COLUMN "montoHorasExtras" INTEGER NOT NULL DEFAULT 0;

UPDATE "Pagosalario" SET "horasExtrasHoras" = "horasExtras" WHERE "horasExtras" IS NOT NULL;

-- Corrección de registros generados por el cálculo de nómina: antes `salario`
-- persistía el NETO (después de deducciones) mientras que la creación manual
-- guarda el salario base. Bajo el contrato nuevo, `salario` = devengado bruto
-- del período y el pago = salario + bonificaciones + montoHorasExtras − deducciones.
-- Para los registros generados (identificables por el formato exacto que escribe
-- el generador: "Devengado: <n>, Vacaciones (9.09%): ..."), salario_nuevo =
-- salario_neto + deducciones = base imponible, de modo que el total histórico
-- mostrado se conserva exactamente.
UPDATE "Pagosalario"
SET "salario" = "salario" + COALESCE("deducciones", 0)
WHERE "observaciones" LIKE 'Devengado: %, Vacaciones%';
