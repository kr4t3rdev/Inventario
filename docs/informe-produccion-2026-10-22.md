# Informe de Readiness de Producción — TCP (plan Básico)

> Fecha: 2026-10-22 · Basado en el programa completo de load testing
> (`docs/auditoria-load-testing-2026-10-05.md`). Despliegue de referencia:
> server homelab 169.254.238.192, app en producción bajo systemd.

## Veredicto

**LISTO PARA PRODUCCIÓN** para el plan Básico en el hardware de referencia,
con los dos límites operativos documentados abajo (techo de login y
-throughput de catálogo- son características del hardware compartido, no
defectos del sistema). El motor transaccional demostró integridad exacta bajo
concurrencia extrema.

## Checklist de producción verificado

| Ítem | Estado | Evidencia |
|---|---|---|
| App en modo producción (`next start`, NODE_ENV=production) | ✅ | `/api/health` → environment: production |
| Servicio con auto-reinicio (systemd user unit) | ✅ | 2h soak + avalancha con NRestarts contados; recuperación automática tras el spike |
| Base de datos alcanzable por loopback (inmune a flaps de red) | ✅ | Postgres publicado en `127.0.0.1:5432`; cero caídas de DB desde el cambio |
| Receta de build reproducible sin OOM | ✅ | `deploy-build.sh` (app detenida, heap 2048, engine debian) |
| Integridad transaccional bajo concurrencia | ✅ | 5,059 ventas concurrentes: vendido = descontado exacto por producto |
| Tokens de sesión únicos por emisión (jti) | ✅ | 0 colisiones P2002 en 1,200 logins simultáneos |
| Rechazo correcto de ventas sin stock | ✅ | 3,248 STOCK_INSUFICIENTE con inventario agotado (comportamiento esperado) |
| Features del plan efectivos en runtime | ✅ (tras fix) | Drift `turnos-pos` del Básico corregido con `jsonb_set` |
| Observabilidad operativa (Prometheus + Grafana + exporters) | ✅ | Dashboards k6 / PostgreSQL / Node activos con remote-write |
| Backup/restore de la demo para reset post-campaña | ⚠️ | Stock repuesto manualmente; automatizar reset si se hacen campañas frecuentes |

## Perfil de capacidad (hardware de referencia)

| Régimen | Límite medido |
|---|---|
| Operación POS sostenida | 30 cajeros, 16.6 req/s, p95 91ms plano (2h) |
| Ventas transaccionales (Básico) | ~10 ventas/s con med 80ms, integridad 100% |
| Catálogo POS en ráfaga | ~120 req/s de tope, 0 errores, encola sin caer |
| Zona cómoda | ~60 req/s con p95 < 800ms |
| Login | ~30-80/s (bcrypt, por diseño) |

## Límites y mitigaciones recomendadas

1. **Rate-limit de login** por IP/usuario: el path de bcrypt es un vector de
   DoS por diseño (un atacante puede saturar el server con logins). El spike
   A lo demostró: 300 logins/s congelan el login durante minutos.
2. **`connection_limit` en DATABASE_URL** si se esperan bursts de logins
   concurrentes > 30 (blips P2024 observados bajo picos).
3. **Automatizar el reset de stock de la demo** (SQL de reposición) como paso
   post-campaña o `--setup` dentro del script k6.
4. **Revisar drift de features de los 3 planes** en producción contra
   `prisma/seed/plans-seed.ts` (se encontró `turnos-pos` desactualizado).

## Postur operativa

- Reinicio de la app: `systemctl --user restart tcp` (auto en fallo).
- Build nuevo: `bash ~/TCP/deploy-build.sh` (detached, detiene y re-arranca la app).
- DB caída tras flap de red: `cd ~/postgresql && docker compose up -d` (ya no
  debería ocurrir con loopback).
- Monitoreo en vivo: dashboards de Grafana; alertas básicas vía uptime-kuma
  (pendiente su leak de memoria: actualizar o limitar RAM del contenedor).
