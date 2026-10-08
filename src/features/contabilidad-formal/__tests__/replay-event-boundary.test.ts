import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const authorizedCaller = 'features/contabilidad-formal/services/replay-backfill-service.ts';

/** @description Detects imports that could expose the historical period-guard bypass. */
function importsRestrictedReplayApi(source: string, fileName: string): boolean {
	const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
	const restrictedSymbol = (specifier: string): string | null => {
		const moduleName = specifier.split(/[\\/]/).at(-1)?.replace(/\.[cm]?[jt]sx?$/, '');
		return moduleName === 'posting-engine' ? 'replayEvento'
			: moduleName === 'replay-posting-capability' ? 'withReplayPostingCapability' : null;
	};
	let found = false;
	const visit = (node: ts.Node): void => {
		if (found) return;
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			const specifier = node.moduleSpecifier;
			if (specifier && ts.isStringLiteralLike(specifier) && restrictedSymbol(specifier.text)) {
				if (ts.isExportDeclaration(node)) {
					found = !node.exportClause || !ts.isNamedExports(node.exportClause) || (
						node.exportClause.elements.some((element) =>
							(element.propertyName ?? element.name).text === restrictedSymbol(specifier.text),
						));
				} else {
					const bindings = node.importClause?.namedBindings;
					found = Boolean(bindings && (ts.isNamespaceImport(bindings) ||
						(ts.isNamedImports(bindings) && bindings.elements.some((element) =>
							(element.propertyName ?? element.name).text === restrictedSymbol(specifier.text),
						))));
				}
			}
		}

		if (ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference) &&
			node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression) &&
			restrictedSymbol(node.moduleReference.expression.text)) {
			found = true;
		}

		if (ts.isCallExpression(node) &&
			(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
				(ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
			node.arguments.some((argument) =>
				ts.isStringLiteralLike(argument) && restrictedSymbol(argument.text),
			)) {
			found = true;
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return found;
}

/** @description Lists source files below a directory. */
function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.(ts|tsx|js|jsx|mjs|mts)$/.test(entry.name) ? [path] : [];
	});
}

describe('historical replay capability boundary', () => {
	it('detects namespace, dynamic, aliased, and re-export access to the replay module', () => {
		const modulePath = '@/features/contabilidad-formal/services/posting-engine';
		expect(importsRestrictedReplayApi(`import * as engine from '${modulePath}';`, 'consumer.ts')).toBe(true);
		expect(importsRestrictedReplayApi(`import { replayEvento as bypass } from '${modulePath}';`, 'consumer.ts')).toBe(true);
		expect(importsRestrictedReplayApi(`export * from '${modulePath}';`, 'consumer.ts')).toBe(true);
		expect(importsRestrictedReplayApi(`export * as engine from '${modulePath}';`, 'consumer.ts')).toBe(true);
		expect(importsRestrictedReplayApi(
			"import { withReplayPostingCapability as issue } from '@/features/contabilidad-formal/services/replay-posting-capability';",
			'consumer.ts',
		)).toBe(true);
		expect(importsRestrictedReplayApi(`void import('${modulePath}');`, 'consumer.ts')).toBe(true);
		expect(importsRestrictedReplayApi(`const engine = require('${modulePath}');`, 'consumer.ts')).toBe(true);
		expect(importsRestrictedReplayApi(`import { postEvento } from '${modulePath}';`, 'consumer.ts')).toBe(false);
	});

	it('allows production imports of replayEvento only from the approved backfill service', { timeout: 60_000 }, () => {
		const unauthorizedImports = sourceFiles(sourceRoot).flatMap((path) => {
			const relativePath = relative(sourceRoot, path).split(sep).join('/');
			if (/\.(test|spec)\./.test(path) || relativePath === authorizedCaller) return [];
			const source = readFileSync(path, 'utf8');
			return importsRestrictedReplayApi(source, path) ? [relativePath] : [];
		});

		expect(unauthorizedImports).toEqual([]);
	});
});
