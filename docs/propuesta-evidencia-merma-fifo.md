# Propuesta: evidencia para merma y costo FIFO

Estado: migración aditiva probada únicamente en una copia local descartable. El writer y el replay ya usan evidencia de reverso de merma; la prueba USD confirma el replay sin duplicación cuando el asiento existe. En candidato local sin publicar, las compras directas FIFO nuevas ya guardan valoración funcional verificable y conservan el saldo en devoluciones parciales; recepciones, combinaciones monetarias y reconstrucción histórica siguen parciales. Esta propuesta no acredita cobertura global.

## Merma

Cada versión de merma ya tiene un `AjusteInventario` propio. La propuesta añade a ese ajuste la fecha efectiva y la fecha de registro de su reversión formal. El escritor fija ambas dentro de la misma transacción cuando se contabiliza o simula el reverso; si no hay reverso formal deja los campos vacíos. Un reintento no debe sustituir evidencia ya fijada. El replay deberá verificar el origen, la fecha, el costo, la existencia del asiento original y la identidad del reverso antes de emitirlo.

Las fechas nulas no son prueba de que no existiera un reverso. Los ajustes históricos sin evidencia suficiente seguirán sin reconstruirse; un movimiento de inventario o una fecha de modificación no reemplazan automáticamente la fecha contable efectiva. La integridad y la inmutabilidad de esta evidencia requieren validación en el escritor y pruebas transaccionales adicionales.

Para nuevas reversiones en moneda funcional distinta de CUP, el escritor guarda la evidencia FX en `FxEvidence` dentro de la transacción. El replay exige huella válida, fecha límite igual a la fecha del ajuste, una sola evidencia y concordancia con el asiento original. Los importes y tasa sin redondear se conservan en el JSON y se cotejan con las columnas decimales antes de verificar la huella. PostgreSQL confirmó captura y lectura del candidato USD y un ciclo completo con el writer normal, preflight, aprobación independiente, rechazo por cambio de fecha, replay conforme y ausencia de duplicados; las líneas conservaron moneda, importe original, tasa y huella. Ese ciclo reconoce un reverso ya contabilizado. No se ha demostrado que el replay cree un reverso USD ausente bajo enforce: el asiento y `FxEvidence` se escriben atómicamente, así que no existe evidencia de ese estado en una ruta normal. El motor contable rechaza importes funcionales que exceden su precisión admitida.

## FIFO

Cada `PurchaseAllocation` conserva su costo unitario original existente. La propuesta añade moneda y fecha de la fuente, moneda funcional, costo funcional total de la asignación, tasa, fecha de tasa y referencia o huella de evidencia FX. El importe funcional se almacena como total de la asignación, no como costo unitario. La captura debe identificar la fuente real, validar cantidades y registrar la evidencia en la misma transacción operativa; debe conservar la precisión y las reglas de redondeo del writer contable.

La ausencia de campos en registros previos significa evidencia incompleta. No se rellena con CUP, fecha epoch, precios actuales ni tasas reconstruidas sin prueba. El usuario decidió que solo una factura vinculada e inequívoca en cantidad, costo, moneda y fecha FX puede acreditar el costo de una recepción; el precio de la OC y los agregados de facturación no son suficientes. La política para fuentes parcialmente facturadas y en monedas mixtas debe quedar definida antes de emitir una única valoración por asignación; una sola moneda no representa una mezcla.

### Alcance ya probado localmente

Para nuevas asignaciones desde compras directas, el writer captura en la transacción de venta la moneda funcional, el costo funcional total, la tasa y fecha efectiva, y el objeto FX canónico con huella. El lector reconstruye y coteja todas las claves y valores canónicos, y consume el monto guardado sin consultar una tasa distinta. Si solo existe una procedencia antigua completa (costo, moneda y fecha), conserva la consulta de tasa histórica por esa fecha; si la procedencia o un snapshot FX nuevo es parcial o inconsistente, falla cerrado.

En devoluciones parciales, se prorratea el saldo funcional actual a cuatro decimales con redondeo half-up y se actualiza la evidencia del remanente con la misma tasa histórica. La última devolución consume exactamente el residuo. Antes de actualizar o borrar cualquier fila, el writer valida todas las asignaciones afectadas. Vitest focal pasó 41/41; las integraciones PostgreSQL aisladas de venta y devolución en CUP pasaron 6/6; ESLint y TypeScript focal pasaron. La captura y conservación de montos de moneda extranjera se probó en unidades, no en integración PostgreSQL. El `typecheck:tests` completo sigue mostrando errores en archivos fuera de este alcance. No se publicó ni se aplicó este candidato a otro entorno.

Las asignaciones desde lotes recibidos ahora conservan su origen físico y cantidad, pero no guardan el precio de la OC como costo formal. Su valoración de venta queda incompleta hasta que pueda demostrarse el vínculo factura-línea-recepción con importe y FX; en enforce, esa falta de evidencia debe impedir un asiento de costo parcial. La devolución FIFO de cualquier recepción también falla cerrada antes de modificar allocations mientras la procedencia de factura no sea verificable. El esquema actual no contiene ese vínculo, así que el caso positivo requiere diseñar y probar esa relación antes de implementar su lectura.

Esto no recupera tasas ausentes ni costo histórico de fuentes preexistentes. Tampoco resuelve asignaciones que mezclen recepción y compra directa o monedas, replay FIFO ni cobertura entre períodos.

## Migración y límites

La migración solo añade columnas opcionales, sin valores por defecto ni actualización de filas existentes. No impone todavía restricciones de integridad ni inmutabilidad: su diseño definitivo debe cerrarse junto a los escritores y sus pruebas de concurrencia y reversión. Tampoco cambia el reporte, aplica un bloqueo general ni repara el pasado. La aplicación a cualquier entorno distinto de la base local descartable requiere autorización expresa.
