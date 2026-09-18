# Fix: Renderizado de markdown en documentación pública de módulos

## Intent
Resolver que el contenido markdown publicado en `content/docs/modules/` se muestre con los mismos estilos en la web que en el archivo original.

> Nota: el cambio nació cuando estos archivos todavía vivían en `docs/modules/`; luego se movieron al content root público.

## Causa raíz
El componente `DocsContent` (`src/features/docs/components/docs-content.tsx`) usaba clases `prose-*` de Tailwind CSS que dependen del plugin `@tailwindcss/typography`, el cual **no estaba instalado** en el proyecto. Sin ese plugin, las clases prose no tienen efecto y el markdown se renderiza como texto plano sin estilos.

## Problemas detectados
1. **`@tailwindcss/typography` no instalado** — clases prose inoperantes
2. **Uso de `rehype-raw`** — permitía HTML crudo sin control, innecesario
3. **Links a `.md` rotos** — los links relativos tipo `./admin/README.md` renderizaban como-is, resultando en 404
4. **`not-prose` en MermaidBlock** — clase del plugin que no hace nada sin él

## Solución aplicada
- Se reescribió `DocsContent` para usar componentes custom de `ReactMarkdown` con clases Tailwind directas en cada elemento HTML (`h1`-`h4`, `p`, `ul`/`ol`/`li`, `a`, `code`, `blockquote`, `table`/`th`/`td`, `img`, `hr`)
- Se eliminó `rehype-raw` — no es necesario
- Se agregó `resolveDocLink()` que convierte `./admin/README.md` → `/docs/admin`
- Se limpió `not-prose` de `MermaidBlock`

## Archivos modificados
- `src/features/docs/components/docs-content.tsx` — rewrite completo (197 insercciones, 57 eliminaciones)
- `src/features/docs/components/mermaid-block.tsx` — limpieza de clase `not-prose`

## Commit
```
07c76e9e fix(docs): replace prose typography with custom markdown components
```
Rama: `codex/upgrade-next-16`
Pendiente de push (sin acceso a GitHub desde esta red)

## Estado
✅ Completado — el contenido público ahora vive en `content/docs/modules/`
