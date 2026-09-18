---
target: landing page de inicio, sección Referidos
total_score: 18
p0_count: 0
p1_count: 2
timestamp: 2026-07-28T11-17-58Z
slug: features-landing-components-affiliate-program-tsx
---
# Impeccable Critique — Referidos

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | Las condiciones existen, pero la modalidad elegida no queda marcada. |
| 2 | Match System / Real World | 2/4 | “Tenant”, “perks”, “tramos” y “liquidación” exigen vocabulario interno. |
| 3 | User Control and Freedom | 2/4 | No hay un selector que permita enfocarse en una sola modalidad. |
| 4 | Consistency and Standards | 3/4 | Sigue el sistema visual existente, aunque lo repite en exceso. |
| 5 | Error Prevention | 2/4 | Las reglas reducen dudas, pero aparecen demasiado tarde. |
| 6 | Recognition Rather Than Recall | 2/4 | El usuario debe comparar mentalmente dos programas extensos. |
| 7 | Flexibility and Efficiency | 1/4 | No existe un camino corto para clientes o gestores decididos. |
| 8 | Aesthetic and Minimalist Design | 1/4 | 41 contenedores visuales y 94 textos visibles diluyen la jerarquía. |
| 9 | Error Recovery | 1/4 | No hay acceso inmediato a ayuda o aclaración sobre pagos o disputas. |
| 10 | Help and Documentation | 2/4 | Hay reglas útiles, pero faltan definiciones y política enlazada. |
| **Total** | | **18/40** | **Débil para una sección de conversión** |

## Anti-Patterns Verdict

**LLM assessment:** no supera el AI-slop test. La sección es funcional y consistente, pero combina el patrón de píldora superior, gran título centrado monoespaciado, muchos bloques redondeados, icono, título, texto y pasos numerados. La repetición hace que todas las ideas parezcan igual de importantes.

**Deterministic scan:** el detector CLI del archivo fuente devolvió 0 hallazgos. La inspección visual del DOM completo encontró 44 patrones en toda la landing; dentro de Referidos intersectaron 24 posibles nested cards, una línea demasiado larga y una señal débil de padding comprimido. Los 24 nested cards son parcialmente ciertos: varias filas internas son divs estilizados, no componentes Card, pero visualmente sí producen el mismo efecto de tarjeta dentro de tarjeta.

**Visual overlays:** la inyección directa desde localhost fue bloqueada por CORS y private-network access. La inyección inline funcionó en un navegador headless y generó `/tmp/tcp-assessment-b-referidos-inline-overlay.png`; no existe un overlay visible en una pestaña del usuario.

## Overall Impression

La información es completa, pero la sección intenta enseñar dos programas enteros al mismo tiempo. La mayor oportunidad es convertirla en una decisión simple: “Ya uso FinanceMDM” o “Quiero recomendarlo como Gestor”, y mostrar solo el camino relevante.

## What's Working

- Las dos modalidades aparecen temprano y ya tienen diferencias conceptuales claras.
- Las reglas de confirmación manual, licencia vigente y pagos en CUP aportan confianza.
- No se detectó overflow horizontal en 390px, 768px ni 1440px; los botones mantienen 44px de altura.

## Priority Issues

### [P1] Dos programas compiten dentro de una sola narrativa

**Why it matters:** crédito de licencia y comisión en efectivo responden a motivaciones distintas. Mostrar ambos completos obliga al visitante a filtrar contenido irrelevante.

**Fix:** abrir con un selector visible: “Ya soy cliente” y “Quiero ser Gestor”. Mantener un resumen comparativo corto y revelar únicamente tiers, pasos y reglas de la modalidad elegida.

**Suggested command:** `$impeccable distill`

### [P1] La acción llega demasiado tarde

**Why it matters:** en móvil la sección mide aproximadamente 6882px. El CTA aparece después de casi toda la explicación, cuando el usuario ya atravesó una mini-documentación.

**Fix:** ubicar un CTA contextual inmediatamente después del selector. Cliente: “Ver mi programa”. Gestor: “Registrarme como Gestor”. Repetir el CTA al final solo como cierre.

**Suggested command:** `$impeccable layout`

### [P2] Exceso de tarjetas y jerarquía plana

**Why it matters:** 41 contenedores redondeados y 94 elementos de texto hacen que beneficios, tiers, reglas y pasos tengan el mismo peso. La sección se percibe ensamblada, no diseñada.

**Fix:** reemplazar la mayoría de tarjetas por una composición de dos carriles, una tabla limpia de tiers y una línea de proceso. Reservar una sola superficie elevada para el elemento decisivo.

**Suggested command:** `$impeccable polish`

### [P2] El copy usa vocabulario interno

**Why it matters:** un visitante nuevo puede no entender “tenant”, “perks”, “tramo” o “liquidación” en pocos segundos.

**Fix:** comenzar con resultados humanos: “Si tu empresa ya usa FinanceMDM…” y “Si querés recomendar FinanceMDM a otras empresas…”. Dejar los términos internos como aclaraciones secundarias.

**Suggested command:** `$impeccable clarify`

### [P3] Monoespaciado aplicado a demasiados niveles

**Why it matters:** Chivo Mono aporta identidad, pero en títulos principales, subtítulos, tarjetas y etiquetas reduce el contraste jerárquico.

**Fix:** reservar font-mono para título principal, porcentajes y labels breves; usar la fuente sans para títulos secundarios y contenido explicativo.

**Suggested command:** `$impeccable typeset`

## Persona Red Flags

**Jordan — visitante por primera vez:** llega a “Tenant activo” y “Gestor de Ventas” sin una definición sencilla. Debe leer varios bloques antes de saber cuál le corresponde.

**Riley — usuario desconfiado:** encuentra “confirmación manual”, “tasa del momento” y “cuenta aprobada”, pero no una política breve de tiempos, discrepancias o contacto directo junto al CTA.

**Casey — usuario móvil distraído:** en el primer viewport solo ve la promesa y parte de una modalidad; debe recorrer cerca de 6.8k px antes de actuar.

## Minor Observations

- La píldora “Referidos” refuerza el aspecto de plantilla, aunque una sola instancia no es crítica.
- hover:shadow-lg aporta movimiento decorativo, pero no comunica interactividad útil.
- No hay problemas de ancho o touch targets en los viewports inspeccionados.
- El padding señalado por el overlay parece un falso positivo menor.

## Questions to Consider

- ¿Qué pasaría si la sección comenzara con “¿Ya sos cliente o querés recomendar FinanceMDM?”
- ¿Los perks son suficientemente concretos para vender, o conviene mostrar ejemplos reales?
- ¿La landing debe explicar todas las reglas o convencer y enlazar a una página de detalle?
