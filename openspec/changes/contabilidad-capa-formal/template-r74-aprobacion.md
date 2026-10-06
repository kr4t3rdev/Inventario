# R7.4 — Template de Aprobación por Tenant

**Pre-requisitos:** R7.3 completado (7 días shadow) + R0.1–R0.4 resueltas.

## Datos del tenant

- **Tenant ID:** <ID>
- **Nombre:** <nombre>
- **Fecha solicitud:** YYYY-MM-DD
- **Solicitante:** <nombre/rol>

## Evidencia R7.3 (adjuntar)

- [ ] Log de 7 días (ver runbook R7.3)
- [ ] Query de resumen ejecutada
- [ ] Métricas p95 por día
- [ ] Reporte de conciliación

## Checklist de aprobación

- [ ] 7 días continuos verificados
- [ ] 0 errores críticos
- [ ] Latencia dentro de umbral
- [ ] Conciliación exacta 100%
- [ ] Sin incidentes pendientes

## Decisión

- [ ] **APROBADO** — Habilitar `CONTABILIDAD_FORMAL_MODE=enforce` para el tenant
- [ ] **RECHAZADO** — Volver a shadow, motivo: _______________
- [ ] **DIFERIDO** — Repetir shadow, motivo: _______________

## Firmas

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| Responsable técnico | | | |
| Responsable negocio | | | |

## Criterio de reversión (post-aprobación)

Si tras habilitar enforce:
- Falla cobertura/conciliación, O
- Surge incidente crítico

**Acción inmediata:**
1. `CONTABILIDAD_FORMAL_MODE=off` para el tenant
2. Detener replay
3. Preservar asientos y evidencia
4. Diagnosticar causa raíz
5. Repetir shadow (7 días) antes de reactivar

**Responsable de reversión:** <nombre>
**Contacto emergencia:** <teléfono/email>
