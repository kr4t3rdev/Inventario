/**
 * @description Verifica las dependencias transitivas ejecutables de la máquina compartida con la UI.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * @description Recorre imports de JavaScript emitido, excluyendo dependencias solo de tipos.
 * @param {string} entry - Archivo compartido que importa el cliente.
 * @returns {string[]} Dependencias de servidor alcanzables desde el archivo.
 */
function serverDependencies(entry: string): string[] {
  const visited = new Set<string>();
  const violations: string[] = [];
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    baseUrl: process.cwd(),
    paths: { '@/*': ['src/*'] },
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const pending = [entry];
  while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const emitted = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: options,
      fileName: file,
    }).outputText;
    for (const dependency of ts.preProcessFile(emitted).importedFiles) {
      const specifier = dependency.fileName;
      if (/^(node:|server-only$|next\/(headers|cache)$)/.test(specifier)) {
        violations.push(`${path.relative(process.cwd(), file)} -> ${specifier}`);
        continue;
      }
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      if (!resolved) throw new Error(`Import sin resolver: ${specifier} desde ${file}`);
      if (!resolved.isExternalLibraryImport && !resolved.resolvedFileName.endsWith('.d.ts')) {
        pending.push(resolved.resolvedFileName);
      }
    }
  }
  return violations;
}

describe('máquina de contratos compartida con el cliente', () => {
  it('no alcanza autenticación ni APIs exclusivas del servidor mediante imports transitivos', () => {
    expect(serverDependencies(path.resolve(
      'src/features/contratos/lib/estado-contrato-machine.ts',
    ))).toEqual([]);
  });
});
