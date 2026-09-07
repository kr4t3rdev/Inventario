-- FKs compuestas (tenantId, id) para las tablas de OC/recepciones: la base
-- rechaza físicamente relaciones cruzadas entre tenants, sin depender solo
-- de validaciones en la capa de aplicación.

CREATE UNIQUE INDEX "OrdenCompra_tenantId_id_key"
  ON "OrdenCompra"("tenantId", "id");
CREATE UNIQUE INDEX "OrdenCompraItem_tenantId_id_key"
  ON "OrdenCompraItem"("tenantId", "id");
CREATE UNIQUE INDEX "Recepcion_tenantId_id_key"
  ON "Recepcion"("tenantId", "id");

ALTER TABLE "CompraDocumento"
  DROP CONSTRAINT "CompraDocumento_ordenCompraId_fkey",
  ADD CONSTRAINT "CompraDocumento_tenantId_ordenCompraId_fkey"
    FOREIGN KEY ("tenantId", "ordenCompraId")
    REFERENCES "OrdenCompra"("tenantId", "id")
    ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "OrdenCompraItem"
  DROP CONSTRAINT "OrdenCompraItem_ordenId_fkey",
  DROP CONSTRAINT "OrdenCompraItem_productoId_fkey",
  ADD CONSTRAINT "OrdenCompraItem_tenantId_ordenId_fkey"
    FOREIGN KEY ("tenantId", "ordenId")
    REFERENCES "OrdenCompra"("tenantId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OrdenCompraItem_tenantId_productoId_fkey"
    FOREIGN KEY ("tenantId", "productoId")
    REFERENCES "Producto"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Recepcion"
  DROP CONSTRAINT "Recepcion_ordenId_fkey",
  ADD CONSTRAINT "Recepcion_tenantId_ordenId_fkey"
    FOREIGN KEY ("tenantId", "ordenId")
    REFERENCES "OrdenCompra"("tenantId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecepcionItem"
  DROP CONSTRAINT "RecepcionItem_recepcionId_fkey",
  DROP CONSTRAINT "RecepcionItem_ordenItemId_fkey",
  DROP CONSTRAINT "RecepcionItem_productoId_fkey",
  ADD CONSTRAINT "RecepcionItem_tenantId_recepcionId_fkey"
    FOREIGN KEY ("tenantId", "recepcionId")
    REFERENCES "Recepcion"("tenantId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RecepcionItem_tenantId_ordenItemId_fkey"
    FOREIGN KEY ("tenantId", "ordenItemId")
    REFERENCES "OrdenCompraItem"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "RecepcionItem_tenantId_productoId_fkey"
    FOREIGN KEY ("tenantId", "productoId")
    REFERENCES "Producto"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReglaReabastecimiento"
  DROP CONSTRAINT "ReglaReabastecimiento_productoId_fkey",
  ADD CONSTRAINT "ReglaReabastecimiento_tenantId_productoId_fkey"
    FOREIGN KEY ("tenantId", "productoId")
    REFERENCES "Producto"("tenantId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;
