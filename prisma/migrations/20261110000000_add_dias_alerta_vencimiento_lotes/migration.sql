ALTER TABLE "MiEmpresa"
ADD COLUMN "diasAlertaVencimientoLotes" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "MiEmpresa"
ADD CONSTRAINT "MiEmpresa_diasAlertaVencimientoLotes_check"
CHECK ("diasAlertaVencimientoLotes" BETWEEN 1 AND 30);
