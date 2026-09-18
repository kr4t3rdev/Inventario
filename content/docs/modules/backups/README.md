# Backups

> Administra respaldos del sistema, restauraciones, importaciones y planes automáticos desde una consola administrativa.

## Qué hace

Este módulo es una consola de administración global para copias de seguridad. Permite disparar backups completos o parciales, seguir su estado asíncrono, importar archivos externos, restaurar respaldos y manejar planes automáticos de ejecución.

## Qué incluye

- creación manual de backups
- historial paginado de respaldos
- polling de estado
- importación de backups externos
- restauración
- borrado de backups
- planes automáticos de backup
- soporte de storage local o blob

## Cuándo usarlo

- Cuando necesitás generar una copia antes de una intervención riesgosa.
- Cuando querés restaurar o importar un respaldo.
- Cuando administrás políticas de backup desde el panel global.

## Reglas importantes

- Todas las actions de backup requieren rol `admin` global.
- La ejecución del backup corre en background y devuelve un `backupLogId` para polling.
- Importar un backup no es lo mismo que restaurarlo.
- El módulo usa motores dedicados para backup, restore y validación de archivo.

## Qué conviene cuidar

- Restaurar es una operación de alto impacto; conviene verificar origen y tipo de archivo.
- Un backup “corriendo” todavía no implica éxito hasta que cambie su estado final.
- Los planes automáticos merecen revisión periódica, no solo los respaldos manuales.

## Rutas y referencias

- `/admin/backups`
- `src/features/backups/actions.ts`
- `src/features/backups/actions-plans.ts`
- `src/features/backups/backup-engine.ts`
- `src/features/backups/restore-engine.ts`

## En una frase

Es la consola de resiliencia del sistema para respaldar, importar y restaurar datos.
