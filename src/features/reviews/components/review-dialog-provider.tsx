'use client';

import React from 'react';

import { ReviewDialog } from '@/features/reviews/components/review-dialog';
import { useReviewDialog } from '@/features/reviews/hooks/use-review-dialog';

/**
 * @description Provider que orquesta la lógica de mostrar el ReviewDialog
 * a usuarios activos sin reseña previa. Se monta en el layout authenticated.
 * @returns {JSX.Element} Fragment con dialog
 */
export function ReviewDialogProvider(): React.JSX.Element {
  const { show, close } = useReviewDialog();

  return <ReviewDialog open={show} onClose={close} />;
}
