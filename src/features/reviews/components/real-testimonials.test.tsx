import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getApprovedReviewsPublicAction } from '@/features/reviews/actions';
import { RealTestimonials } from '@/features/reviews/components/real-testimonials';

vi.mock('@/features/reviews/actions', () => ({
  getApprovedReviewsPublicAction: vi.fn(),
}));

const mockedGetReviews = vi.mocked(getApprovedReviewsPublicAction);

function createReviews(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    reviewId: `review-${index}`,
    rating: 5,
    comment: `Testimonio ${index + 1}`,
    user: { name: `Cliente ${index + 1}`, avatar: null },
  }));
}

describe('RealTestimonials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render the section when fewer than ten approved testimonials exist', async () => {
    mockedGetReviews.mockResolvedValue({ reviews: createReviews(9) } as never);

    render(<RealTestimonials />);

    await waitFor(() => expect(mockedGetReviews).toHaveBeenCalledWith({ limit: 10 }));
    expect(screen.queryByRole('heading', { name: 'Testimonios de clientes' })).not.toBeInTheDocument();
  });

  it('renders a compact selection when at least ten approved testimonials exist', async () => {
    mockedGetReviews.mockResolvedValue({ reviews: createReviews(10) } as never);

    render(<RealTestimonials />);

    expect(
      await screen.findByRole('heading', { name: 'Testimonios de clientes' }),
    ).toBeInTheDocument();
    expect(screen.getByText('“Testimonio 1”')).toBeInTheDocument();
    expect(screen.getByText('“Testimonio 3”')).toBeInTheDocument();
    expect(screen.queryByText('“Testimonio 4”')).not.toBeInTheDocument();
  });
});
