# R7.3 — Runbook Shadow 7 Días

**Objetivo:** Habilitar modo shadow para tenant autorizado y registrar ≥7 días continuos
de eventos antes de aprobar enforce (R7.4).

**No sustituible por tests:** la ventana debe ser real y observada.

## 1. Habilitar shadow

```bash
# En el entorno del tenant (no global):
CONTABILIDAD_FORMAL_MODE=shadow
```

Verificar que el modo está activo:
```bash
# Debe responder con el modo actual
curl -s http://localhost:3000/api/contabilidad/formal/mode
```

## 2. Qué registrar cada día

Para cada día (D1..D7), capturar:

| Métrica | Fuente | Umbral |
|---------|--------|--------|
| Eventos recibidos por tipo/writer | `ShadowPosteoOutbox` (estado=SIMULADO) | — |
| Eventos omitidos por causa | `ShadowPosteoOutbox` (estado=OMITIDO, causa) | — |
| Errores shadow | `ShadowPosteoOutbox` (estado=ERROR_SHADOW) | 0 |
| Latencia p95 (ms) | `duracionMs` percentil 95 | <500 |
| Huecos de telemetría | Gaps en `createdAt` por writer | 0 |
| Conciliación comparable exacta | Comparar asiento simulado vs esperado | 100% |

### Query base (PostgreSQL)

```sql
-- Resumen diario por tenant
SELECT
  DATE("createdAt") as dia,
  "tipoEvento",
  estado,
  causa,
  COUNT(*) as total,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "duracionMs") as p95_ms
FROM "ShadowPosteoOutbox"
WHERE "tenantId" = '<TENANT_ID>'
  AND "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2;
```

## 3. Template de log diario

Copiar para cada día:

```
## Día N — YYYY-MM-DD
- Tenant: <ID>
- Responsable: <nombre>
- Eventos recibidos: <N> (desglose por tipo)
- Eventos simulados: <N> (<pct>%)
- Eventos omitidos: <N> (causas: ...)
- Errores shadow: <N>
- Latencia p95: <N>ms
- Huecos telemetría: <N>
- Conciliación exacta: <SÍ/NO> (detalle si NO)
- Incidentes: <ninguno / detalle>
```

## 4. Criterios de éxito (para R7.4)

- [ ] 7 días continuos sin interrupción del modo shadow
- [ ] 0 errores ERROR_SHADOW no explicados
- [ ] Latencia p95 <500ms todos los días
- [ ] 0 huecos de telemetría
- [ ] Conciliación comparable exacta al 100%
- [ ] Sin incidentes que requieran reversión

## 5. Si algo falla

Ver R7.4 — criterio de reversión:
1. Volver a `CONTABILIDAD_FORMAL_MODE=off` para el tenant
2. Detener replay
3. Preservar asientos/evidencia
4. Diagnosticar
5. Repetir shadow (reiniciar conteo de 7 días) antes de reactivar
