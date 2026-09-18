# Gastos de Distribución y Explotación (Gastos D/E)

> Registra y clasifica gastos operativos del tenant para que luego puedan conciliarse, analizarse y entrar en cierres diarios o contables.

## Qué hace

Este módulo captura gastos operativos corrientes que no entran como compra de producto ni como compra de servicio estructurada. Sirve para darle trazabilidad a egresos del negocio y después conectarlos con contabilidad, cuadre diario y reportes.

## Qué incluye

- registro de gastos operativos
- clasificación por tipo o concepto
- detalle de monto, fecha y descripción
- uso posterior en conciliación contable
- impacto en cuadre diario y reportes

## Cuándo usarlo

- Cuando la empresa incurre en un gasto operativo cotidiano.
- Cuando necesitás distinguir estos egresos de compras o pagos salariales.
- Cuando querés que el gasto aparezca luego en cierres y conciliaciones.

## Reglas importantes

- Este flujo representa gasto operativo directo, no compra de producto ni servicio recibido.
- Lo registrado acá luego puede aparecer como pendiente de conciliación.
- El módulo se entiende mejor junto a `contabilidad` y `cuadre-diario`.

## Qué conviene cuidar

- Elegí bien el concepto o tipo para que después el análisis tenga sentido.
- No mezcles en este módulo egresos que ya tienen flujo específico en compras o contabilidad.

## Rutas y referencias

- `/busy/gastosDE`
- `src/app/busy/gastosDE/page.tsx`

## En una frase

Es el registro operativo de gastos cotidianos que después alimenta cierres y análisis financiero.
