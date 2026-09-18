# Reportes Financieros

> Consolida analitica contable con filtros globales, trazabilidad de movimientos y exportaciones CSV/PDF.

## Qué hace

Este módulo es la capa analítica del dominio contable. Se monta sobre `contabilidad/reportes` y ofrece una vista más orientada a lectura, comparación y exportación que a registrar operaciones.

## Qué incluye

- panel de analytics contables
- filtros globales por cuenta, período y otros criterios
- historial y trazabilidad de movimientos
- exportación de movimientos filtrados en CSV y PDF
- acceso a balances y vistas financieras complementarias del módulo contable

## Cuándo usarlo

- Cuando querés analizar resultados sin modificar datos.
- Cuando necesitás descargar reportes para compartir o auditar.
- Cuando buscás una lectura consolidada por cuenta o período.

## Reglas importantes

- El acceso se bloquea si el plan no habilita contabilidad o reportes contables.
- La página usa un componente analítico cargado dinámicamente.
- Las exportaciones de movimientos salen desde endpoints específicos y respetan filtros aplicados.
- Este módulo complementa a `contabilidad`, no lo reemplaza.

## Qué conviene cuidar

- Antes de exportar, verificá que el filtro realmente represente el corte que necesitás.
- Si un reporte no cuadra, revisá primero reconciliación, periodos y movimientos de cuenta.
- La lectura consolidada depende de que la contabilidad fuente esté ordenada.

## Rutas y referencias

- `/busy/contabilidad/reportes`
- `src/app/busy/contabilidad/reportes/page.tsx`
- `src/features/contabilidad/components/reportes-analytics-page.tsx`
- `src/features/contabilidad/components/export-dialog.tsx`

## En una frase

Es la capa de analítica y exportación para leer la contabilidad sin tocar la operación.
