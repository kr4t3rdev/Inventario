import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/landing/components/pos-demo/pv-demo', () => ({
	PvDemoInteractive: ({ reduceMotion }: { reduceMotion?: boolean }) => (
		<div data-testid="pv-demo" data-reduce-motion={String(Boolean(reduceMotion))} />
	),
}));

import { LandingPosDemoSection } from './pos-demo-section';
import { DEMO_CATEGORIAS, DEMO_PRODUCTOS } from './mock-data';

describe('LandingPosDemoSection', () => {
	afterEach(cleanup);

	it('propaga reduced motion y mantiene CTAs como enlaces accesibles', () => {
		render(<LandingPosDemoSection reduceMotion />);

		expect(screen.getByTestId('pv-demo')).toHaveAttribute('data-reduce-motion', 'true');
		for (const link of screen.getAllByRole('link')) {
			expect(link.querySelector('button')).toBeNull();
		}
	});

	it('mantiene un catálogo compacto de tres productos representativos', () => {
		expect(DEMO_PRODUCTOS).toHaveLength(3);
		expect(new Set(DEMO_PRODUCTOS.map((producto) => producto.categoriaId))).toEqual(
			new Set(DEMO_CATEGORIAS.map((categoria) => categoria.catId)),
		);
		render(<LandingPosDemoSection />);
		expect(screen.getByText('3 productos demo')).toBeInTheDocument();
	});
});
