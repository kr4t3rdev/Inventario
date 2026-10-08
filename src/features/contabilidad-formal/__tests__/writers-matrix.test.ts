/**
 * @description Verifica que la matriz R0.5 refleje todos los callsites productivos
 * de posteo formal detectables en el árbol fuente.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const SOURCE_ROOT = join(ROOT, 'src');
const MATRIX_PATH = join(
	ROOT,
	'openspec/changes/contabilidad-capa-formal/matriz-writers-r0.5.md',
);

function listTypeScriptFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return listTypeScriptFiles(path);
		return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
	});
}

function isProductiveSource(path: string): boolean {
	return !path.includes('/__tests__/')
		&& !path.includes('/__integration__/')
		&& !path.endsWith('/features/contabilidad-formal/services/posting-engine.ts');
}

function findPostingCallsites(): Map<string, number> {
		return new Map<string, number>(
		listTypeScriptFiles(SOURCE_ROOT)
			.filter(isProductiveSource)
			.map((path): [string, number] => [
				relative(ROOT, path),
				(readFileSync(path, 'utf8').match(/\bpostEvento\s*\(/g) ?? []).length,
			])
				.filter(([, count]) => typeof count === 'number' && count > 0),
	);
}

describe('matriz R0.5 de writers', () => {
	it('cubre todos los archivos productivos que invocan postEvento', () => {
		const matrix = readFileSync(MATRIX_PATH, 'utf8');
		const callsites = findPostingCallsites();
		const total = [...callsites.values()].reduce((sum, count) => sum + count, 0);

		expect(total).toBe(31);
		expect(matrix.replace(/\s+/g, ' ')).toContain('31 callsites productivos en 19 archivos');
		for (const path of callsites.keys()) {
			expect(matrix, `falta ${path} en la matriz`).toContain(path);
		}
	});
});
