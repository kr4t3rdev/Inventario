# Artefactos congelados de proceso

Esta carpeta conserva artefactos de proceso que antes vivían dentro de rutas
de código y que la auditoría `docs/auditoria-contabilidad-vs-odoo-2026-10-24.md`
señaló como artefactos fuera de lugar en el árbol de código. No son parte del
runtime: no los importa ninguna aplicación y no se regeneran.

## `manifiesto-comparacion-rutas-rl4.json`

- **Qué es**: el manifiesto de comparación de **912 rutas** entre el worktree
  de la capa formal y el `main` fijado, con la clasificación de cada ruta y
  su hash SHA-256 en ambas fuentes.
- **Origen**: commit `6ce65e16` (2026-10-23), donde el manifiesto se había
  commiteado dentro de `src/lib/utils/prestamo-cash.ts` con extensión `.ts`.
  Ese hallazgo es **RL-4** de `docs/auditoria-contabilidad-vs-odoo-2026-10-24.md`
  y el punto **CT-6** de su plan de cierre.
- **Comparación**: `source_head` `d1d06c4` (worktree
  `/Users/arturo/.codex/worktrees/contabilidad-correcciones/TCP`) contra
  `pinned_main` `ea6084c5` (árbol commiteado de `main`; el `main` sucio se
  excluyó). El alcance fueron rutas de aplicación, runtime, esquema,
  migraciones, pruebas, documentación y operaciones con marcadores de
  contabilidad, efectivo, período, capital, formal o FX.
- **Conteos**: 912 rutas relevantes en la unión; 495 `exact-present`, 242
  `genuinely-new-source`, 40 `missing`, 135 `divergent-needs-review`; 58 rutas
  relevantes con overlay sucio o sin seguimiento en el worktree de origen.
- **Cómo recuperarlo desde el historial**:

  ```bash
  git show 6ce65e16:src/lib/utils/prestamo-cash.ts
  ```

- **Cómo verificar la copia**:

  ```bash
  shasum -a 256 docs/artefactos/manifiesto-comparacion-rutas-rl4.json
  # b640dd413c2e1a7abd8adb457fc6b61f8b1dd458c10a722d131c27fc28a86cf4
  ```

- **Estado**: congelado. `src/lib/utils/prestamo-cash.ts` vuelve a ser la
  utilidad real del módulo (42 líneas) desde el commit `b327cf7f9`, que retiró
  el manifiesto de `src/`. La copia de esta carpeta conserva la evidencia del
  hallazgo sin volver a meter un artefacto de proceso en el árbol de código.
