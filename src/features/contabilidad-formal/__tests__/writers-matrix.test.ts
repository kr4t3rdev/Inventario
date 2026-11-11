/**
 * @description Regresión de la matriz canónica R0.5.
 *
 * Verifica cuatro invariantes del inventario contable formal:
 *
 *  1. Todo callsite productivo de `postEvento()` está inventariado en la
 *     matriz canónica versionada (`docs/ct1-r0-5-matriz-canonica.md`), con el
 *     mismo número de invocaciones por archivo que el código real.
 *  2. Cada ancla `archivo#Lnn` de las tablas de las secciones 3 y 4 apunta a
 *     una línea que realmente invoca `postEvento()`; mover un callsite sin
 *     actualizar la matriz falla.
 *  3. Todo tipo del contrato formal (`REPLAY_SOURCE_MANIFEST`) tiene fila en
 *     la tabla de resolución de los 39 tipos, con la disposición exacta que
 *     declara el código.
 *  4. Los emisores declarados huérfanos siguen sin invocador productivo; si
 *     alguien los cablea, la regresión obliga a actualizar la matriz.
 *
 * La regresión detecta drift del inventario. No certifica permisos, moneda/FX,
 * atomicidad, rollback físico ni aceptación operativa (`R0.5-ACCEPT`), y no
 * detecta adaptadores que creen documentos sin emitir (eso lo cubre el
 * baseline de cada entorno).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPLAY_SOURCE_MANIFEST } from '@/features/contabilidad-formal/services/replay-source-manifest';

const ROOT = resolve(process.cwd());
const SOURCE_ROOT = join(ROOT, 'src');
const MATRIX_PATH = join(ROOT, 'docs/ct1-r0-5-matriz-canonica.md');
const POSTING_ENGINE_PATH = 'src/features/contabilidad-formal/services/posting-engine.ts';
const EXPECTED_CALLSITES = 24;
const EXPECTED_CALLSITE_FILES = 13;
const EXPECTED_MANIFEST_TYPES = 40;
const EXPECTED_ORPHAN_ROWS = 4;
const ORPHAN_KINDS = ['modulo-huerfano', 'funcion-sin-invocador', 'invocacion-interna'];
const CALLSITES_ANCHOR =
	/<!-- R0\.5-CALLSITES:START -->([\s\S]*?)<!-- R0\.5-CALLSITES:END -->/;
const MANIFEST_ANCHOR =
	/<!-- R0\.5-MANIFEST:START -->([\s\S]*?)<!-- R0\.5-MANIFEST:END -->/;
const ORPHANS_ANCHOR =
	/<!-- R0\.5-ORPHANS:START -->([\s\S]*?)<!-- R0\.5-ORPHANS:END -->/;
const CALLSITE_TOKEN = /`(src\/[^`|]+?\.ts)#L(\d+)`/g;

/** Callsite declarado en la matriz: archivo y línea ancla. */
interface DeclaredCallsite {
	path: string;
	line: number;
}

/**
 * @description Normaliza un separador de ruta al estilo POSIX.
 * @param {string} path - Ruta relativa o absoluta.
 * @returns {string} Ruta con separador `/`.
 */
function toPosix(path: string): string {
	return path.split(sep).join('/');
}

/**
 * @description Lista recursivamente los archivos TypeScript de un directorio.
 * @param {string} directory - Directorio raíz de la búsqueda.
 * @returns {string[]} Rutas absolutas de los archivos `.ts` y `.tsx` hallados.
 */
function listTypeScriptFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return listTypeScriptFiles(path);
		return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
	});
}

/**
 * @description Lista los archivos productivos del inventario, en rutas POSIX.
 * @returns {string[]} Rutas relativas de los archivos que entran al inventario.
 */
function listProductiveFiles(): string[] {
	return listTypeScriptFiles(SOURCE_ROOT)
		.map((path) => toPosix(relative(ROOT, path)))
		.filter(isProductiveSource);
}

/**
 * @description Indica si un archivo entra en el inventario de callsites.
 * @param {string} path - Ruta del archivo relativa al repositorio.
 * @returns {boolean} `true` si el archivo es código productivo del inventario.
 */
function isProductiveSource(path: string): boolean {
	return !path.includes('/__tests__/')
		&& !path.includes('/__integration__/')
		&& !/\.test\.tsx?$/.test(path)
		&& path !== POSTING_ENGINE_PATH;
}

/**
 * @description Cuenta invocaciones de `postEvento()` en un archivo, ignorando
 * líneas de comentario completas.
 * @param {string} source - Contenido del archivo.
 * @returns {number} Invocaciones detectadas.
 */
function countPostingCallsites(source: string): number {
	return source.split('\n').filter((line) => {
		const trimmed = line.trim();
		if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
		return /\bpostEvento\s*\(/.test(line);
	}).length;
}

/**
 * @description Cuenta los callsites de `postEvento()` por archivo productivo.
 * @returns {Map<string, number>} Mapa ruta relativa → invocaciones detectadas.
 */
function findPostingCallsites(): Map<string, number> {
	const callsites = new Map<string, number>();
	for (const path of listProductiveFiles()) {
		const count = countPostingCallsites(readFileSync(join(ROOT, path), 'utf8'));
		if (count > 0) callsites.set(path, count);
	}
	return callsites;
}

/**
 * @description Agrupa rutas por cantidad de apariciones.
 * @param {string[]} paths - Rutas declaradas, con repetición por callsite.
 * @returns {Map<string, number>} Mapa ruta → apariciones.
 */
function countByPath(paths: string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const path of paths) counts.set(path, (counts.get(path) ?? 0) + 1);
	return counts;
}

/**
 * @description Devuelve el contenido de una sección delimitada por anclas.
 * @param {string} matrix - Texto completo de la matriz canónica.
 * @param {RegExp} anchor - Patrón con los delimitadores de inicio y fin.
 * @returns {string} Contenido de la sección; cadena vacía si falta el ancla.
 */
function extractSection(matrix: string, anchor: RegExp): string {
	return matrix.match(anchor)?.[1] ?? '';
}

/**
 * @description Extrae los callsites declarados en la tabla de la matriz.
 * @param {string} section - Sección de callsites de la matriz canónica.
 * @returns {DeclaredCallsite[]} Callsites declarados, en orden de aparición.
 */
function parseDeclaredCallsites(section: string): DeclaredCallsite[] {
	const declared: DeclaredCallsite[] = [];
	const pattern = new RegExp(CALLSITE_TOKEN.source, 'g');
	let match = pattern.exec(section);
	while (match !== null) {
		declared.push({ path: match[1], line: Number(match[2]) });
		match = pattern.exec(section);
	}
	return declared;
}

/**
 * @description Extrae las filas de una tabla markdown que cumplen un filtro.
 * @param {string} section - Sección con la tabla markdown.
 * @param {RegExp} keyPattern - Patrón que valida la primera columna.
 * @returns {string[][]} Celdas de cada fila aceptada, en orden de aparición.
 */
function parseTableRowList(section: string, keyPattern: RegExp): string[][] {
	const rows: string[][] = [];
	for (const line of section.split('\n')) {
		if (!line.trim().startsWith('|')) continue;
		const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
		const key = (cells[0] ?? '').replace(/`/g, '').trim();
		if (!keyPattern.test(key)) continue;
		rows.push(cells);
	}
	return rows;
}

/**
 * @description Extrae las celdas de una tabla markdown por su primera columna.
 * @param {string} section - Sección con la tabla markdown.
 * @param {RegExp} keyPattern - Patrón que valida la primera columna.
 * @returns {Map<string, string[]>} Mapa clave → celdas de la fila.
 */
function parseTableRows(section: string, keyPattern: RegExp): Map<string, string[]> {
	const rows = new Map<string, string[]>();
	for (const cells of parseTableRowList(section, keyPattern)) {
		rows.set((cells[0] ?? '').replace(/`/g, '').trim(), cells);
	}
	return rows;
}

/**
 * @description Busca importadores productivos de un módulo por su basename.
 * @param {string} modulePath - Ruta relativa del módulo a verificar.
 * @returns {string[]} Rutas relativas de los archivos que lo importan.
 */
function findProductiveImporters(modulePath: string): string[] {
	const baseName = modulePath.split('/').pop()?.replace(/\.ts$/, '') ?? '';
	const pattern = new RegExp(`from\\s+['"][^'"]*${baseName}['"]`);
	return listProductiveFiles()
		.filter((path) => path !== modulePath)
		.filter((path) => pattern.test(readFileSync(join(ROOT, path), 'utf8')));
}

/**
 * @description Busca invocaciones productivas de un símbolo fuera de su
 * módulo, incluidas las llamadas por miembro (`servicio.simbolo(`).
 * @param {string} modulePath - Ruta relativa del módulo que define el símbolo.
 * @param {string} symbol - Nombre del símbolo buscado.
 * @returns {string[]} Rutas relativas de los archivos que invocan el símbolo.
 */
function findProductiveCallers(modulePath: string, symbol: string): string[] {
	const pattern = new RegExp(`\\b${symbol}\\s*\\(`);
	return listProductiveFiles()
		.filter((path) => path !== modulePath)
		.filter((path) => pattern.test(readFileSync(join(ROOT, path), 'utf8')));
}

/**
 * @description Cuenta invocaciones de un símbolo dentro de su propio módulo,
 * ignorando líneas de comentario completas. Incluye la definición.
 * @param {string} modulePath - Ruta relativa del módulo que define el símbolo.
 * @param {string} symbol - Nombre del símbolo buscado.
 * @returns {number} Invocaciones, incluida su propia definición.
 */
function countCallsInsideModule(modulePath: string, symbol: string): number {
	const pattern = new RegExp(`\\b${symbol}\\s*\\(`);
	return readFileSync(join(ROOT, modulePath), 'utf8')
		.split('\n')
		.filter((line) => {
			const trimmed = line.trim();
			if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
			return pattern.test(line);
		}).length;
}

describe('matriz canónica R0.5 de writers', () => {
	it('inventaría todos los callsites productivos de postEvento', () => {
		const matrix = readFileSync(MATRIX_PATH, 'utf8');
		const scanned = findPostingCallsites();
		const declared = parseDeclaredCallsites(extractSection(matrix, CALLSITES_ANCHOR));
		const declaredCounts = countByPath(declared.map(({ path }) => path));
		const scannedTotal = [...scanned.values()].reduce((sum, count) => sum + count, 0);
		const declaredTotal = declared.length;

		expect(scannedTotal, 'el número de callsites productivos cambió').toBe(EXPECTED_CALLSITES);
		expect(scanned.size, 'el número de archivos con callsites cambió')
			.toBe(EXPECTED_CALLSITE_FILES);
		expect(declaredTotal, 'la matriz no declara todos los callsites').toBe(EXPECTED_CALLSITES);
		expect(declaredCounts.size, 'la matriz no declara todos los archivos')
			.toBe(EXPECTED_CALLSITE_FILES);
		expect(declaredCounts, 'la matriz no coincide con los callsites del código')
			.toEqual(scanned);
		expect(matrix.replace(/\s+/g, ' ')).toContain(
			`${EXPECTED_CALLSITES} callsites en ${EXPECTED_CALLSITE_FILES} archivos`,
		);

		for (const { path, line } of declared) {
			const anchorLine = readFileSync(join(ROOT, path), 'utf8').split('\n')[line - 1] ?? '';
			expect(anchorLine, `ancla obsoleta ${path}#L${line}`).toMatch(/\bpostEvento\s*\(/);
		}
	});

	it('resuelve los 40 tipos del manifiesto formal con su disposición exacta', () => {
		const matrix = readFileSync(MATRIX_PATH, 'utf8');
		const section = extractSection(matrix, MANIFEST_ANCHOR);
		const rowList = parseTableRowList(section, /^[A-Z][A-Z0-9_]+$/);
		const rows = parseTableRows(section, /^[A-Z][A-Z0-9_]+$/);
		const types = Object.keys(REPLAY_SOURCE_MANIFEST);

		expect(types).toHaveLength(EXPECTED_MANIFEST_TYPES);
		expect(rowList, 'la matriz no tiene una fila por tipo, sin duplicados')
			.toHaveLength(types.length);
		expect(rows.size, 'la matriz no resuelve todos los tipos del manifiesto').toBe(types.length);
		for (const [type, entry] of Object.entries(REPLAY_SOURCE_MANIFEST)) {
			const cells = rows.get(type);
			expect(cells, `falta la fila de ${type} en la matriz`).toBeDefined();
			expect(cells?.[1], `disposición incorrecta para ${type}`).toBe(entry.disposition);
		}

		const manifestAnchors = parseDeclaredCallsites(section);
		expect(manifestAnchors.length, 'la tabla de tipos perdió sus anclas')
			.toBeGreaterThanOrEqual(15);
		for (const { path, line } of manifestAnchors) {
			const anchorLine = readFileSync(join(ROOT, path), 'utf8').split('\n')[line - 1] ?? '';
			expect(anchorLine, `ancla obsoleta ${path}#L${line}`).toMatch(/\bpostEvento\s*\(/);
		}
	});

	it('mantiene sin invocador productivo los emisores declarados huérfanos', () => {
		const matrix = readFileSync(MATRIX_PATH, 'utf8');
		const rows = parseTableRowList(extractSection(matrix, ORPHANS_ANCHOR), /^[a-z][a-z-]*$/);

		expect(rows, 'la tabla de emisores huérfanos cambió').toHaveLength(EXPECTED_ORPHAN_ROWS);
		for (const cells of rows) {
			const classification = cells[0];
			const modulePath = (cells[1] ?? '').replace(/`/g, '');
			const symbol = (cells[2] ?? '').replace(/`/g, '');

			expect(ORPHAN_KINDS, `clasificación desconocida: ${classification}`)
				.toContain(classification);

			if (classification === 'modulo-huerfano') {
				expect(
					findProductiveImporters(modulePath),
					`${modulePath} ya tiene importadores productivos: actualiza la matriz`,
				).toHaveLength(0);
			}

			if (classification === 'funcion-sin-invocador') {
				expect(
					findProductiveCallers(modulePath, symbol),
					`${symbol} ya tiene invocadores productivos: actualiza la matriz`,
				).toHaveLength(0);
				expect(
					countCallsInsideModule(modulePath, symbol),
					`${symbol} ya se invoca dentro de su módulo: actualiza la matriz`,
				).toBe(1);
			}

			if (classification === 'invocacion-interna') {
				expect(
					findProductiveCallers(modulePath, symbol),
					`${symbol} ya tiene invocadores externos: actualiza la matriz`,
				).toHaveLength(0);
				expect(
					countCallsInsideModule(modulePath, symbol),
					`${symbol} dejó de invocarse dentro de su módulo: actualiza la matriz`,
				).toBeGreaterThanOrEqual(2);
			}
		}
	});
});
