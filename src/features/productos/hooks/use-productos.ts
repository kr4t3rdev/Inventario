/**
 * @description Hook para obtener la lista de productos via Server Action.
 *   Reemplaza a useGetProductosQuery() de RTK Query.
 *
 * @returns {object} { productos, isLoading, error }
 */
'use client';

import { useEffect, useState } from 'react';
import { getProductosAction } from '@/features/productos/actions';
import type { Producto } from '@/features/productos/types';

interface UseProductosResult {
  productos: Producto[];
  isLoading: boolean;
  error: unknown;
}

export function useProductos(): UseProductosResult {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(undefined);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getProductosAction()
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setProductos((result.data ?? []) as unknown as Producto[]);
        } else {
          setError(result.error);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { productos, isLoading, error };
}
