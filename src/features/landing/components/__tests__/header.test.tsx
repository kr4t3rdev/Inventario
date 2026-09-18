import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingHeader } from '@/features/landing/components/header';

describe('LandingHeader', () => {
	it('exposes a responsive menu with an accessible toggle and Spanish auth CTAs', () => {
		render(<LandingHeader reduceMotion />);

		const toggle = screen.getByRole('button', { name: /menú/i });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(toggle).toHaveAttribute('aria-controls', 'landing-mobile-menu');
		expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
		expect(screen.getByRole('link', { name: 'Registrarse' })).toHaveAttribute('href', '/register');

		fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('navigation', { name: /móvil/i })).toBeVisible();

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(document.activeElement).toBe(toggle);
	});

	it('moves auth actions into the mobile panel and exposes a controlled Más menu', () => {
		render(<LandingHeader reduceMotion />);
		const toggle = screen.getByRole('button', { name: /abrir menú/i });
		fireEvent.click(toggle);
		const mobileNavigation = screen.getByRole('navigation', { name: /móvil/i });
		expect(mobileNavigation.querySelector('a[href="/login"]')).not.toBeNull();
		expect(mobileNavigation.querySelector('a[href="/register"]')).not.toBeNull();
		expect(mobileNavigation.querySelector('a[href="#testimonios"]')).toBeNull();

		const more = screen.getByRole('button', { name: 'Más opciones' });
		expect(more).toHaveAttribute('aria-haspopup', 'menu');
	});
});
