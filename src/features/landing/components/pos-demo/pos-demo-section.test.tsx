import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/landing/components/pos-demo/pv-demo', () => ({
	PvDemoInteractive: ({ reduceMotion }: { reduceMotion?: boolean }) => (
		<div data-testid="pv-demo" data-reduce-motion={String(Boolean(reduceMotion))} />
	),
}));

import { LandingPosDemoSection } from './pos-demo-section';

describe('LandingPosDemoSection', () => {
	it('propaga reduced motion y mantiene CTAs como enlaces accesibles', () => {
		render(<LandingPosDemoSection reduceMotion />);

		expect(screen.getByTestId('pv-demo')).toHaveAttribute('data-reduce-motion', 'true');
		for (const link of screen.getAllByRole('link')) {
			expect(link.querySelector('button')).toBeNull();
		}
	});
});
