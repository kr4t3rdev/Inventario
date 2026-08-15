import { useCallback, useEffect, useState } from 'react';
import type { MobileGetProductsStockRequest } from '../../sdks/mobile-v1/typescript/src';
import type { BusinessApi } from './business-api';
import { loadBusinessSurface, type BusinessSurfaceResult } from './business-surface';

export interface BusinessSurfaceState extends BusinessSurfaceResult {
  loading: boolean;
}

/**
 * @description Coordinates initial and retryable loading for authenticated business sections.
 * @param {BusinessApi} api - Typed business API adapter.
 * @param {MobileGetProductsStockRequest} stockParams - Contract-supported stock filters.
 * @returns {BusinessSurfaceState & { retry: () => void }} Loading state and retry callback.
 */
export function useBusinessSurface(api: BusinessApi, stockParams: MobileGetProductsStockRequest) {
  const [state, setState] = useState<BusinessSurfaceState>({
    data: { dashboard: null, products: null, stock: null },
    errors: { dashboard: null, products: null, stock: null },
    loading: true,
  });
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => setRetryKey((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true }));
    loadBusinessSurface(api, stockParams).then((result) => {
      if (active) setState({ ...result, loading: false });
    });
    return () => { active = false; };
  }, [api, retryKey, stockParams]);

  return { ...state, retry };
}
