# Snapshot financiero v3: rollback

La migración de v3 es aditiva. Las filas v2 conservan sus campos y JSON sin
reescritura, y una falla del writer detiene nuevas aprobaciones sin eliminar ni
modificar evidencia aprobada existente.

El estado `APPROVED` se protege en PostgreSQL mediante trigger. El rollback de la
aplicación puede desactivar la captura o la aprobación, pero no puede reactivar
las fórmulas legacy para generar nuevos snapshots ni convertir una fila v2 en v3.
