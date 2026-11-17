'use client';
import { useEffect, useState } from 'react';

import { getMonedaPrincipalAction } from '@/features/contabilidad/actions-accounting-policy';

/**
 * @description Hook que resuelve la moneda principal de la empresa desde su
 * política contable (fuente de verdad). No usa el catálogo de monedas ni
 * sustituye la moneda por CUP cuando no está configurada.
 * @returns {{ monedaPrincipal: string | null; isLoading: boolean }}
 * `monedaPrincipal` es el código normalizado (CONFIGURADA) o null
 * (AUSENTE/ERROR); `isLoading` indica mientras se resuelve la política.
 */
export function useMonedaPrincipal(): {
  monedaPrincipal: string | null;
  isLoading: boolean;
} {
  const [monedaPrincipal, setMonedaPrincipal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getMonedaPrincipalAction()
      .then((result) => {
        if (cancelled) return;
        setMonedaPrincipal(
          result.success && result.data?.estado === 'CONFIGURADA' && result.data.moneda
            ? result.data.moneda
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) setMonedaPrincipal(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { monedaPrincipal, isLoading };
}
