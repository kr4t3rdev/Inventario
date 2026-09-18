# Landing Page

> Es la cara pública del producto: comunica planes, prueba social, estadísticas y propuesta de valor antes del login.

## Qué hace

Este módulo presenta la plataforma a usuarios no autenticados. Reúne pricing, testimonios, estadísticas públicas y componentes de conversión para captar interés comercial antes de que alguien cree cuenta o inicie sesión.

## Qué incluye

- presentación general del producto
- planes públicos
- estadísticas públicas del sistema
- prueba social y testimonios
- CTA hacia registro, demo o login

## Cuándo usarlo

- Cuando querés revisar cómo se presenta comercialmente la plataforma.
- Cuando necesitás validar qué datos públicos está mostrando el sitio.
- Cuando marketing o ventas necesita entender qué promete la página pública.

## Reglas importantes

- La landing consume parte del dominio de `reviews` y `planes` para mostrar contenido real.
- No es un dashboard interno: su objetivo es conversión, confianza y adquisición.
- Los números y testimonios expuestos deberían reflejar datos reales o gobernados por backend.

## Qué conviene cuidar

- Si la prueba social o los planes quedan desactualizados, el problema es comercial además de técnico.
- Conviene pensar esta página como parte del producto, no como un simple folleto.

## Rutas y referencias

- `/`
- `src/features/reviews/actions.ts`
- `src/features/planes/actions.ts`

## En una frase

Es la vitrina pública del producto antes de que el usuario entre al sistema.
