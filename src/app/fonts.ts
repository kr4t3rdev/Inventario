import localFont from 'next/font/local';

/**
 * @description Chivo Mono — fuente monospace variable (400-700) para headings,
 *              números grandes, stats y elementos de marca. Cargada localmente.
 */
export const chivoMono = localFont({
  src: [
    {
      path: '../../public/fonts/ChivoMono.woff2',
      weight: '400 700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ChivoMono-Italic.woff2',
      weight: '400 700',
      style: 'italic',
    },
  ],
  variable: '--font-mono',
  display: 'swap',
});

/**
 * @description Inter — fuente sans-serif variable (400-700) para cuerpo de
 *              texto, descripciones y UI en general. Cargada localmente.
 */
export const inter = localFont({
  src: [
    {
      path: '../../public/fonts/Inter.woff2',
      weight: '400 700',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Inter-Italic.woff2',
      weight: '400 700',
      style: 'italic',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
});
