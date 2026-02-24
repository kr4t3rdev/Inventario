/**
 * @description Hook personalizado para detectar breakpoints de pantalla
 * Proporciona información sobre el tamaño actual de la ventana para diseño responsivo
 * @returns Objeto con propiedades de breakpoints y tamaño de pantalla
 */
import { useState, useEffect, useCallback } from 'react';

/**
 * @description Tipo de breakpoint disponible
 */
type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * @description Objeto con estado de cada breakpoint
 */
interface BreakpointsState {
  xs: boolean;
  sm: boolean;
  md: boolean;
  lg: boolean;
  xl: boolean;
  '2xl': boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  currentBreakpoint: Breakpoint;
  windowWidth: number;
  windowHeight: number;
}

/**
 * @description Configuración de breakpoints (mismos que Tailwind CSS)
 * xs: < 640px (móvil)
 * sm: >= 640px (móvil grande)
 * md: >= 768px (tablet)
 * lg: >= 1024px (tablet grande)
 * xl: >= 1280px (desktop)
 * 2xl: >= 1536px (desktop grande)
 */
const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

/**
 * @description Inicializa el estado con los valores actuales de la ventana
 * @returns Estado inicial de los breakpoints
 */
function get_initial_breakpoints_state(): BreakpointsState {
  if (typeof window === 'undefined') {
    return {
      xs: true,
      sm: false,
      md: false,
      lg: false,
      xl: false,
      '2xl': false,
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      currentBreakpoint: 'xs',
      windowWidth: 0,
      windowHeight: 0,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  const state: BreakpointsState = {
    xs: width >= BREAKPOINTS.xs && width < BREAKPOINTS.sm,
    sm: width >= BREAKPOINTS.sm && width < BREAKPOINTS.md,
    md: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    lg: width >= BREAKPOINTS.lg && width < BREAKPOINTS.xl,
    xl: width >= BREAKPOINTS.xl && width < BREAKPOINTS['2xl'],
    '2xl': width >= BREAKPOINTS['2xl'],
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    currentBreakpoint: 'xs',
    windowWidth: width,
    windowHeight: height,
  };

  // Determinar el breakpoint actual
  if (state['2xl']) state.currentBreakpoint = '2xl';
  else if (state.xl) state.currentBreakpoint = 'xl';
  else if (state.lg) state.currentBreakpoint = 'lg';
  else if (state.md) state.currentBreakpoint = 'md';
  else if (state.sm) state.currentBreakpoint = 'sm';
  else state.currentBreakpoint = 'xs';

  return state;
}

/**
 * @description Hook para detectar breakpoints de pantalla
 * @returns Objeto con estado de todos los breakpoints
 */
export function useBreakpoints(): BreakpointsState {
  const [breakpoints, set_breakpoints] = useState<BreakpointsState>(
    get_initial_breakpoints_state
  );

  useEffect(() => {
    /**
     * @description Manejador del evento resize
     */
    const handle_resize = (): void => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      set_breakpoints((prev) => {
        const new_state: BreakpointsState = {
          xs: width >= BREAKPOINTS.xs && width < BREAKPOINTS.sm,
          sm: width >= BREAKPOINTS.sm && width < BREAKPOINTS.md,
          md: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
          lg: width >= BREAKPOINTS.lg && width < BREAKPOINTS.xl,
          xl: width >= BREAKPOINTS.xl && width < BREAKPOINTS['2xl'],
          '2xl': width >= BREAKPOINTS['2xl'],
          isMobile: width < BREAKPOINTS.md,
          isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
          isDesktop: width >= BREAKPOINTS.lg,
          currentBreakpoint: prev.currentBreakpoint,
          windowWidth: width,
          windowHeight: height,
        };

        // Determinar el breakpoint actual
        if (new_state['2xl']) new_state.currentBreakpoint = '2xl';
        else if (new_state.xl) new_state.currentBreakpoint = 'xl';
        else if (new_state.lg) new_state.currentBreakpoint = 'lg';
        else if (new_state.md) new_state.currentBreakpoint = 'md';
        else if (new_state.sm) new_state.currentBreakpoint = 'sm';
        else new_state.currentBreakpoint = 'xs';

        return new_state;
      });
    };

    // Suscribir al evento resize
    window.addEventListener('resize', handle_resize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handle_resize);
    };
  }, []);

  return breakpoints;
}

/**
 * @description Hook para obtener el número de columnas según el breakpoint
 * @param columnsConfig - Configuración de columnas por breakpoint
 * @returns Número de columnas actual
 */
export function useResponsiveColumns(
  columnsConfig: Partial<Record<Breakpoint, number>> = {
    xs: 1,
    sm: 1,
    md: 2,
    lg: 2,
    xl: 3,
    '2xl': 4,
  }
): number {
  const { currentBreakpoint } = useBreakpoints();

  return columnsConfig[currentBreakpoint] ?? columnsConfig.xs ?? 2;
}

/**
 * @description Hook para obtener la altura del gráfico según el breakpoint
 * @param heightsConfig - Configuración de alturas por breakpoint
 * @returns Altura actual del gráfico
 */
export function useResponsiveChartHeight(
  heightsConfig: Partial<Record<Breakpoint, number>> = {
    xs: 200,
    sm: 250,
    md: 300,
    lg: 350,
    xl: 400,
    '2xl': 450,
  }
): number {
  const { currentBreakpoint } = useBreakpoints();

  return heightsConfig[currentBreakpoint] ?? heightsConfig.md ?? 300;
}

/**
 * @description Hook para obtener el tamaño de fuente según el breakpoint
 * @param sizesConfig - Configuración de tamaños por breakpoint
 * @returns Tamaño de fuente actual
 */
export function useResponsiveFontSize(
  sizesConfig: Partial<Record<Breakpoint, number>> = {
    xs: 12,
    sm: 13,
    md: 14,
    lg: 14,
    xl: 14,
    '2xl': 14,
  }
): number {
  const { currentBreakpoint } = useBreakpoints();

  return sizesConfig[currentBreakpoint] ?? sizesConfig.sm ?? 14;
}

/**
 * @description Hook para verificar si debe mostrar versión simplificada
 * @param enableOnMobile - Si true, muestra versión simplificada en móvil
 * @param enableOnTablet - Si true, muestra versión simplificada en tablet
 * @returns Booleano indicando si mostrar versión simplificada
 */
export function useSimplifiedView(
  enableOnMobile: boolean = true,
  enableOnTablet: boolean = false
): boolean {
  const { isMobile, isTablet } = useBreakpoints();

  return (isMobile && enableOnMobile) || (isTablet && enableOnTablet);
}


/**
 * @description Hook para obtener la orientación de la pantalla
 * @returns 'portrait' | 'landscape'
 */
export function useOrientation(): 'portrait' | 'landscape' {
  const { windowWidth, windowHeight } = useBreakpoints();

  return windowWidth >= windowHeight ? 'landscape' : 'portrait';
}

export type { Breakpoint, BreakpointsState };
