/**
 * @description Hook para verificar si una fecha está bloqueada por un período contable cerrado.
 * Pensado para bloqueos visuales en formularios: banner + campos deshabilitados.
 *
 * @example
 * ```tsx
 * const { isLocked, message, periodo, checking } = usePeriodLock(fecha);
 *
 * {checking && <p>Verificando período...</p>}
 * {isLocked && <PeriodLockBanner message={message!} periodo={periodo!} />}
 * <form>
 *   <fieldset disabled={isLocked}>
 *     ...
 *   </fieldset>
 * </form>
 * ```
 */

import { useState, useEffect, useRef } from 'react';

export interface PeriodLockState {
  /** La fecha está bloqueada por un período cerrado */
  isLocked: boolean;
  /** Mensaje descriptivo (ej: "El período Marzo 2026 está Cerrado") */
  message: string | null;
  /** Datos del período bloqueante */
  periodo: { nombre: string; estado: string } | null;
  /** Todavía verificando */
  checking: boolean;
  /** Hubo error en la verificación */
  error: string | null;
}

/**
 * @description Verifica si una fecha está bloqueada por un período contable.
 * Debounce de 300ms para evitar llamadas innecesarias mientras el usuario escribe.
 *
 * @param {string | null | undefined} fecha - Fecha ISO ("2026-03-15") o período ("2026-03").
 *  Pasar null/undefined para saltar la verificación.
 * @returns {PeriodLockState} Estado del bloqueo.
 */
export function usePeriodLock(fecha: string | null | undefined): PeriodLockState {
  const [state, setState] = useState<PeriodLockState>({
    isLocked: false,
    message: null,
    periodo: null,
    checking: false,
    error: null,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Limpiar timer anterior
    if (timerRef.current) clearTimeout(timerRef.current);

    // Sin fecha → reset
    if (!fecha) {
      setState({ isLocked: false, message: null, periodo: null, checking: false, error: null });
      return;
    }

    // Debounce 300ms
    timerRef.current = setTimeout(async () => {
      setState((prev) => ({ ...prev, checking: true, error: null }));

      try {
        const { checkPeriodLockAction } = await import('@/features/contabilidad/actions-periodos');
        const result = await checkPeriodLockAction({ fecha });

        if (!result.success) {
          setState((prev) => ({ ...prev, checking: false, error: result.error?.message ?? 'Error al verificar período' }));
          return;
        }

        const data = result.data;
        if (data?.isLocked) {
          setState({
            isLocked: true,
            message: data.message,
            periodo: data.periodo,
            checking: false,
            error: null,
          });
        } else {
          setState({
            isLocked: false,
            message: null,
            periodo: null,
            checking: false,
            error: null,
          });
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          checking: false,
          error: err instanceof Error ? err.message : 'Error inesperado',
        }));
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fecha]);

  return state;
}
