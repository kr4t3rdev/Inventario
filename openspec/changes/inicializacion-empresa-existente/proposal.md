# Inicialización de empresas en funcionamiento

## Objetivo
Permitir cargar el estado de una empresa a una fecha de corte sin respaldo previo ni reconstrucción de todas sus operaciones históricas. El plan Empresarial sirve como alcance de referencia; cada tenant queda limitado por sus capacidades y permisos efectivos. El usuario prepara y retoma un borrador y confirma una apertura conciliada.

## Alcance
Moneda funcional y tasas; bancos y caja; inventario con costo y ubicación; CxC y CxP; anticipos; deudas y préstamos; apertura contable y conciliación de saldos. Una cuenta bancaria existente registra saldo a corte sin exigir ni inventar capital, deuda o anticipo. Los procesos posteriores y reportes deben usar los saldos cargados sin duplicar movimientos.

## Riesgos y reversión
Evitar duplicidad, saldos operativos sin asiento y efectos de tesorería ficticios. Confirmar de forma transaccional, idempotente, aislada por tenant y bajo bloqueo apropiado. Desplegar migraciones compatibles y mantener la función inaccesible hasta completar validación; ante fallo desactivar el acceso y corregir hacia adelante preservando registros confirmados y auditoría. No revertir migraciones destructivamente ni borrar datos.
