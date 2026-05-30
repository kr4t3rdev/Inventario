'use client';

import { useCallback, useEffect, useState } from 'react';

import { canPromptReviewAction } from '@/features/reviews/actions';

/**
 * @description Hook que verifica si el usuario activo debe ver el dialog de reseña.
 * Retorna show y funciones para controlar el estado del dialog.
 * Se ejecuta 1 vez al montar el componente.
 */
export function useReviewDialog() {
  const [show, setShow] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const check = useCallback(async () => {
    try {
      setIsChecking(true);
      const result = await canPromptReviewAction(undefined);
      setShow(result.success && result.data?.canPrompt === true);
    } catch {
      // si falla, no mostrar el dialog
      setShow(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const close = useCallback(() => {
    setShow(false);
  }, []);

  return { show, isChecking, close, recheck: check };
}
