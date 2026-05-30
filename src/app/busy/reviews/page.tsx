'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  approveReviewAction,
  getPendingReviewsAction,
  rejectReviewAction,
  type ReviewWithUser,
} from '@/features/reviews';
import { toast } from 'sonner';

/**
 * @description Página de moderación de reseñas para admin/manager.
 * Muestra reseñas pendientes de aprobación con acciones para aprobar/rechazar.
 * @returns {JSX.Element} Panel de moderación
 */
export default function ReviewsPage(): React.JSX.Element {
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadReviews = async () => {
    setIsLoading(true);
    const result = await getPendingReviewsAction(undefined);
    if (result.success) {
      setReviews(result.data?.reviews ?? []);
      setTotal(result.data?.total ?? 0);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleApprove = async (reviewId: string) => {
    const result = await approveReviewAction(reviewId);
    if (result.success) {
      toast.success('Reseña aprobada y visible en la página.');
      loadReviews();
    } else {
      toast.error(result.error?.message || 'Error al aprobar');
    }
  };

  const handleReject = async (reviewId: string) => {
    const result = await rejectReviewAction(reviewId);
    if (result.success) {
      toast.success('Reseña rechazada y eliminada.');
      loadReviews();
    } else {
      toast.error(result.error?.message || 'Error al rechazar');
    }
  };

  const pending = reviews.filter((r) => !r.isApproved);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono">Moderación de Reseñas</h1>
          <p className="text-sm text-muted-foreground">
            {total} reseña{total !== 1 ? 's' : ''} en total — {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground font-mono">No hay reseñas pendientes de moderación.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pending.map((review) => (
            <Card key={review.reviewId}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-base">
                    {review.user.name}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground font-mono">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-4 w-4 inline-block ${
                        i < review.rating ? 'text-amber-400' : 'text-muted-foreground/20'
                      }`}
                    >
                      ★
                    </span>
                  ))}
                  <span className="text-sm font-mono text-muted-foreground ml-1">
                    ({review.rating}/5)
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground mb-4">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1"
                    onClick={() => handleApprove(review.reviewId)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-destructive"
                    onClick={() => handleReject(review.reviewId)}
                  >
                    <XCircle className="h-4 w-4" />
                    Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
