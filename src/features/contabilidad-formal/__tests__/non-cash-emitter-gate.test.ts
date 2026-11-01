import { describe, expect, it } from 'vitest';

import {
	ENV_MODO_EMISOR_NO_CASH,
	emisorNoCashActivo,
	resolveModoEmisorNoCash,
} from '../services/non-cash-emitter-gate';

describe('non-cash-emitter-gate', () => {
	it('is off by default (no env var)', () => {
		expect(resolveModoEmisorNoCash({})).toBe('off');
		expect(emisorNoCashActivo({})).toBe(false);
	});

	it('reads the rollout mode from the environment', () => {
		expect(resolveModoEmisorNoCash({ [ENV_MODO_EMISOR_NO_CASH]: 'shadow' })).toBe('shadow');
		expect(resolveModoEmisorNoCash({ [ENV_MODO_EMISOR_NO_CASH]: 'enforce' })).toBe('enforce');
		expect(emisorNoCashActivo({ [ENV_MODO_EMISOR_NO_CASH]: 'shadow' })).toBe(true);
		expect(emisorNoCashActivo({ [ENV_MODO_EMISOR_NO_CASH]: 'enforce' })).toBe(true);
	});

	it('normalizes case and whitespace', () => {
		expect(resolveModoEmisorNoCash({ [ENV_MODO_EMISOR_NO_CASH]: '  ENFORCE ' })).toBe('enforce');
		expect(resolveModoEmisorNoCash({ [ENV_MODO_EMISOR_NO_CASH]: 'Shadow' })).toBe('shadow');
	});

	it('falls back to off for unknown values', () => {
		expect(resolveModoEmisorNoCash({ [ENV_MODO_EMISOR_NO_CASH]: 'on' })).toBe('off');
		expect(resolveModoEmisorNoCash({ [ENV_MODO_EMISOR_NO_CASH]: '' })).toBe('off');
		expect(resolveModoEmisorNoCash({ [ENV_MODO_EMISOR_NO_CASH]: 'true' })).toBe('off');
	});
});
