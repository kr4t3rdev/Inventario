# [Nombre del Módulo]

> Explicación corta y concreta: qué resuelve el módulo y por qué existe.

## Qué hace

Explicá el propósito real del módulo en lenguaje simple, pero conectado con el comportamiento del sistema. Evitá frases genéricas que podrían servir para cualquier feature.

## Qué incluye

- listar las capacidades principales del módulo
- incluir operaciones o vistas relevantes
- mencionar si combina catálogo, operación, analytics o configuración

## Cuándo usarlo

- Cuando necesitás resolver una tarea concreta de este módulo.
- Cuando querés consultar o actualizar datos que este dominio controla.
- Cuando otro módulo depende directamente de esta información.

## Reglas importantes

- Documentá restricciones reales del sistema.
- Mencioná features de plan, validaciones, estados o dependencias técnicas si afectan el uso.
- Si el módulo tiene modos distintos, explicalos acá.

## Qué conviene cuidar

- Señalá errores comunes o decisiones que impactan otros módulos.
- Aclarar qué revisar primero cuando algo “no cierra”.
- Explicar si hay efectos en stock, facturación, contabilidad, permisos o documentos.

## Rutas y referencias

- `/ruta/principal`
- `/ruta/secundaria`
- `src/features/<modulo>/actions.ts`
- `src/app/...` o archivos clave que ayuden a ubicar la implementación

## En una frase

Resumen final en una línea, claro y útil.

## Checklist de Calidad

- ¿El texto describe este módulo y no podría pegarse en otro casi sin cambios?
- ¿Incluye reglas reales del negocio o del sistema?
- ¿Menciona dependencias con otros módulos cuando son importantes?
- ¿Apunta a rutas o archivos reales del proyecto?
- ¿Evita lenguaje puramente técnico cuando no aporta contexto?
