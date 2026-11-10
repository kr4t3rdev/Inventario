# Plantillas para firmar gates contables

**Uso:** copiar la plantilla necesaria, completarla con datos verificados y
adjuntarla al paquete de evidencias. Los campos entre `<...>` son obligatorios.
No completar con defaults del código, valores inferidos ni datos de otro
entorno. Si un dato no se puede verificar, se deja `NO VERIFICADO` y el gate no
se firma.

Runbook asociado: `docs/ct1-preparacion-firmas-gates.md`.

---

## Plantilla A — Nominación de responsables y entornos

**Identificador:** `NOM-<año>-<secuencia>`
**Fecha de nominación:**
**Autoriza (dirección):**

### A.1 Entornos

| Entorno | URL | Base de datos (referencia, sin credenciales) | Proveedor | Titular | Suplente |
|---|---|---|---|---|---|
| Staging | | | | | |
| Producción | | | | | |

### A.2 Roles por gate

| Gate | Ejecuta (titular) | Ejecuta (suplente) | Aprueba | Firma |
|---|---|---|---|---|
| R6 local/CI | | | | |
| R6-BASELINE staging | | | | |
| R6-BASELINE producción | | | | |
| R6-ROLLBACK | | | | |
| R7 operacional | | | | |
| R7.4 por tenant | | | | |
| R0.5-ACCEPT | — | — | | |

**Control de separación de funciones:** ninguna fila puede tener el mismo
nombre en «Ejecuta» y «Aprueba». Verificado por: `<nombre>`.

### A.3 Autorización de observación

- Alcance autorizado: `<solo lectura / incluye ventana de cambio>`
- Vigencia: `<inicio ISO>` a `<fin ISO>`
- Restricciones: `<p. ej. no ejecutar apply, no cambiar flags, no tocar tenants
  fuera de la lista>`
- Referencia del documento de autorización: `<correo/acta>`

**Firmas:** dirección `<nombre>` · SRE `<nombre>` · Finanzas `<nombre>`

---

## Plantilla B — Paquete R6 por entorno

**Entorno:** `<staging|producción>`
**Ventana de corte:** `<inicio ISO>` a `<fin ISO>`
**Commit desplegado:** `<sha>`
**Versión de la aplicación:**
**Referencia de backup:** `<id inmutable>`
**Restauración probada:** `<sí/no>` — evidencia: `<ruta o id>`

### B.1 Configuración efectiva observada (redactada)

| Variable / clave | Valor observado | Fuente | Hora |
|---|---|---|---|
| `CONTABILIDAD_FORMAL_MODE` | | | |
| `CONTABILIDAD_FORMAL_NO_CASH_MODE` | | | |
| `CONTABILIDAD_FORMAL_MODO_TENANT` | | | |
| Overrides de licencia por tenant | | | |

Sin secretos, cadenas de conexión ni datos personales.

### B.2 Inventario de saldos por tenant y moneda

| Tenant | Moneda funcional | Saldo libro (antes) | Saldo operativo (antes) | Diferencia | Explicación | Cerrada por |
|---|---|---|---|---|---|---|
| | | | | | | |

Repetir la tabla con los valores **después** del corte.

### B.3 Conciliación forense

| Artefacto | Ruta | Código de salida | Hallazgos | Hora |
|---|---|---|---|---|
| Verificador forense (antes) | | | | |
| Verificador forense (después) | | | | |
| Cobertura de posteos formales | | | | |

### B.4 Fuentes y omisiones

| Métrica | Valor | Fuente |
|---|---|---|
| Candidatos evaluados | | |
| Ya posteados | | |
| Omitidos | | |
| Omitidos por causa | | |

### B.5 Rollback

- Reversión ensayada: `<sí/no>` · Entorno del ensayo: `<...>`
- Evidencia: `<log/prueba>`
- Plan y ventana de reversión: `<ruta>`

### B.6 Declaración

Declaro que los datos anteriores fueron observados en el entorno indicado, en
la ventana indicada, sin inferencia por defaults.

**Produce:** `<nombre>` · **Acepta (Controller):** `<nombre>` · **Fecha:**

---

## Plantilla C — Bitácora R7 (siete días)

**Entorno:**
**Tenants en observación:**
**Modo:** `shadow`
**Ventana:** `<inicio ISO>` a `<fin ISO>` (debe cubrir siete días completos)
**Umbrales de reversión aprobados por Finanzas:** `<valores>`

| Día | Fecha | Eventos simulados | `ERROR_SHADOW` | Causas | Latencia p95 | Reportes OK/Total | Incidencias | Decisión |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |
| 6 | | | | | | | | |
| 7 | | | | | | | | |

Evidencia adjunta por día:

- [ ] Salida de `getMetricasShadowAction` (conteo, resultado y causa)
- [ ] Salida de `pnpm ops:monitor:accounting-reports` (o JSON del monitor)
- [ ] Conciliaciones y alertas del día
- [ ] Incidencias con causa raíz y acción

**Cierre:** siete días completos `<sí/no>` · Incidencias abiertas `<n>`
**Produce:** `<nombre>` · **Acepta (Controller):** `<nombre>`

---

## Plantilla D — Piloto R7.4 por tenant

**Tenant ID:** `<id>` · **Nombre:** `<nombre>`
**Owner del tenant:** `<nombre>` · **Aprobador de Finanzas (distinto del
ejecutor):** `<nombre>`
**Entorno:** `<...>` · **Commit:** `<sha>`

### D.1 Estado y aprobación

| Campo | Valor |
|---|---|
| Gate no Cash del tenant | `<off/shadow/enforce>` |
| Modo anterior | `<off/shadow/enforce>` |
| Modo solicitado | `<shadow/enforce>` |
| Mecanismo `CONTABILIDAD_FORMAL_MODO_TENANT` | `<1 / no definido>` |
| Clave de override en la licencia | `<contabilidad-formal-shadow / -enforce / ninguna>` |
| Aprobación del owner (referencia) | |
| Aprobación de Finanzas (referencia) | |
| Ventana de observación | `<inicio ISO>` a `<fin ISO>` |
| Umbrales de reversión | |

### D.2 Prerrequisitos verificados

- [ ] Plan de cuentas sembrado (35 cuentas, 7 diarios, 25 roles) y plantillas
      activas
- [ ] `TenantAccountingPolicy.functionalCurrencyCode` configurada
- [ ] Flag de plan `contabilidad-formal` activo
- [ ] Baseline R6 del entorno cerrado
- [ ] R7 cerrado

### D.3 Transiciones

| Hora | Actor | Acción | Modo resultante | Evidencia |
|---|---|---|---|---|
| | | Activación | | |
| | | Verificación de modo efectivo | | |
| | | Reversión (si aplica) | | |

### D.4 Prueba de reversión aislada

- Tenant revertido: `<id>`
- Modo tras revertir: `<...>`
- Segundo tenant de control: `<id>` · Modo antes: `<...>` · Modo después:
  `<...>`
- Resultado: `<aislada / no aislada>`

**Produce (operador de rollout):** `<nombre>` · **Acepta (Finanzas del
tenant):** `<nombre>` · **Fecha:**

---

## Plantilla E — Acta R0.5-ACCEPT

**Acta:** `R05-ACCEPT-<año>-<secuencia>`
**Fecha:**
**Alcance:** tenants `<ids>`, entornos `<nombres>`, commit `<sha>`, versión
`<versión>`
**Matriz de referencia:** `docs/ct1-r0-5-matriz-canonica.md` (commit `<sha>`)

### E.1 Gates previos

| Gate | Estado | Evidencia (ruta/referencia) | Firmado por | Fecha |
|---|---|---|---|---|
| R6 local/CI | | | | |
| R6-BASELINE staging | | | | |
| R6-BASELINE producción | | | | |
| R6-ROLLBACK | | | | |
| R7 (siete días) | | | | |
| R7.4 (por tenant) | | | | |

### E.2 Excepciones aceptadas

| Excepción | Riesgo | Mitigación | Aceptada por | Vigencia |
|---|---|---|---|---|
| Brecha de préstamos (§6.1): sin emisor formal y sin filtro por tenant | | | | |
| Brecha de producción (§6.1): sin emisión ni `fechaContabilizacion` | | | | |
| `TRANSFERENCIA_BANCARIA` y `PAGO_DEUDA_CAPITAL` sin writer | | | | |
| Ocho tipos solo plantilla | | | | |

### E.3 Navegación y UX

- [ ] `/busy/contabilidad/reportes` accesible en el deployment
- [ ] Retorno a `/busy/contabilidad` verificado
- [ ] Evidencia adjunta (captura o registro de la verificación)

### E.4 Declaración y firmas

Declaramos que la cobertura descrita corresponde al alcance y versiones
indicados, que las excepciones fueron revisadas y que los gates R6/R7/R7.4
están firmados por las personas nominadas.

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Dueño técnico (recopila) | | | |
| Controller global | | | |
| Propietario de producto/operación | | | |
| SRE/DBA | | | |
