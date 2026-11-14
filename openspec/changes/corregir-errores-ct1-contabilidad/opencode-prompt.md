# Prompt para OpenCode

```text
Implementa el cambio OpenSpec `openspec/changes/corregir-errores-ct1-contabilidad/`.
Lee proposal.md, specs/contabilidad-formal/spec.md y tasks.md; sigue las tareas
en orden y marca casillas solo con evidencia observada. No uses ODD.

Reproduce primero cada fallo en condiciones aisladas. Distingue hechos de
hipótesis: el mensaje de venta no identifica por sí solo el campo o emisor
faltante; la relación de `N/A` con la FK es una deducción estática aún sin
prueba PostgreSQL; las dos pantallas de moneda podrían haber recibido estados
diferentes. Corrige causas demostradas, con pruebas de regresión y atomicidad.
No desactives guards, no suprimas auditoría obligatoria y no inventes tasas,
monedas, saldos ni valoración FIFO para que una prueba pase.

Usa una rama o worktree aislado, verifica el estado actual de origin/main y
preserva todos los cambios locales. El trabajo CRM/fidelización pertenece a su
propio worktree; no lo mezcles. No leas `.env`, `.env.local` ni `prisma/.env`.
Usa solo bases locales desechables para pruebas de escritura; no accedas ni
modifiques producción, Railway, otros tenants o la sesión de navegador de este
chat. No crees demos ni ejecutes scripts de purga. No modifiques Dev.

Prepara commits y PRs encadenadas de menos de 200 líneas por PR como pidió el
usuario, manteniendo cada corrección y sus pruebas revisables. No afirmes que
un PR está desplegado ni que se verificó producción si no hay evidencia. Entrega
rutas, causa confirmada o incertidumbre, pruebas y resultados, commits y PRs, y
los pasos concretos para que la sesión original verifique PonzTest. El build
previo fue interrumpido sin resultado; no lo presentes como aprobado.
```
