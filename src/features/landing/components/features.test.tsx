import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FEATURE_ITEMS } from '@/features/landing/data';
import { LandingFeatures } from '@/features/landing/components/features';

describe('LandingFeatures', () => {
  it('renders every capability with a contextual disclosure label', () => {
    const { container } = render(<LandingFeatures />);
    const summaries = Array.from(container.querySelectorAll('summary'));

    expect(summaries).toHaveLength(FEATURE_ITEMS.length);

    for (const feature of FEATURE_ITEMS) {
      expect(screen.getByRole('heading', { name: feature.title })).toBeInTheDocument();
      expect(
        summaries.some((summary) => summary.textContent?.includes(`Ver capacidades de ${feature.title}`)),
      ).toBe(true);

      for (const bullet of feature.bullets) {
        expect(screen.getByText(bullet)).toBeInTheDocument();
      }
    }
  });
});
