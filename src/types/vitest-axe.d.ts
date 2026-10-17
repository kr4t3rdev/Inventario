/**
 * @description Correccion de tipos para el subpath `vitest-axe/matchers`.
 *
 * El paquete instala `matchers.js` (que reexporta el valor real
 * `toHaveNoViolations`) junto a un `matchers.d.ts` cuyo contenido es
 * `export type * from "./dist/matchers"`. Con `export type *` el simbolo solo
 * existe como tipo, de modo que TypeScript rechaza su uso como valor aunque en
 * runtime si lo sea. Este shim redeclara el subpath como valor y registra el
 * matcher en la interfaz Assertion de Vitest.
 *
 * Debe seguir siendo un modulo externo (de ahi el `export {}` final) para que
 * las declaraciones sean aumentos del modulo real y no lo sustituyan.
 *
 * Se retira cuando `vitest-axe` publique una definicion que reexporte el valor.
 */

declare module 'vitest-axe/matchers' {
  import type { AxeResults } from 'axe-core';

  /** @description Resultado del matcher: si paso y el mensaje de fallo. */
  interface NoViolationsMatcherResult {
    actual: unknown;
    pass: boolean;
    message: () => string;
  }

  /**
   * @description Matcher que verifica ausencia de violaciones de accesibilidad.
   * @param {AxeResults} results - Resultado devuelto por `axe()`.
   * @returns {NoViolationsMatcherResult} Resultado del matcher.
   */
  export function toHaveNoViolations(results: AxeResults): NoViolationsMatcherResult;
}

declare module 'vitest' {
  interface Assertion<T = unknown> {
    /**
     * @description Verifica que el resultado de `axe()` no tenga violaciones.
     * @returns {void}
     */
    toHaveNoViolations(): void;
  }
}

export {};
