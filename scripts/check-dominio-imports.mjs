import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, extname, join, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(process.argv[process.argv.indexOf('--root') + 1] || '.');
const sourceRoot = resolve(root, 'src');
const domainRoot = resolve(sourceRoot, 'dominio');
const extensions = ['.ts', '.tsx', '.js', '.mjs', '.mts', '.js'];
const forbidden = ['next/', '@prisma/', 'prisma', '@/app/', '@/features/', '@/lib/prisma'];

/** @description Ruta relativa para diagnósticos. @param {string} file - Archivo. @returns {string} Ruta. */
function label(file) {
  return relative(root, file).split(sep).join('/');
}

/** @description Resuelve imports locales con extensiones TypeScript. @param {string} from - Origen. @param {string} spec - Import. @returns {string | null} Destino. */
function local(from, spec) {
  const base = spec.startsWith('@/') ? resolve(sourceRoot, spec.slice(2))
    : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  if (base !== sourceRoot && !base.startsWith(sourceRoot + sep)) return null;
  const stem = base.replace(/\.(js|mjs)$/, '');
  return [base, ...extensions.map((ext) => stem + ext),
    ...extensions.map((ext) => join(base, 'index' + ext))]
    .find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) || null;
}

/** @description Enumera archivos de código sin tests. @param {string} directory - Directorio. @returns {string[]} Archivos. */
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return files(target);
    return /\.(ts|tsx|js|mjs|mts)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)
      ? [target] : [];
  });
}

/** @description Detecta efectos durante importación y APIs de request. @param {import('typescript').SourceFile} ast - AST. @returns {string | null} Diagnóstico. */
function unsafe(ast) {
  let reason = null;
  function visit(node) {
    if (reason) return;
    if (ts.isIdentifier(node) && ['headers', 'cookies', 'Request', 'NextRequest'].includes(node.text)
      && (!ts.isPropertyAccessExpression(node.parent) || node.parent.name === node)) {
      reason = `global de request: ${node.text}`;
      return;
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      reason = 'carga dinámica no verificable';
      return;
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'globalThis') {
      reason = 'global de request o efecto de entrada';
      return;
    }
    ts.forEachChild(node, visit);
  }
  for (const node of ast.statements) {
    if (ts.isExpressionStatement(node) || ts.isThrowStatement(node) ||
        ts.isIfStatement(node) || ts.isForStatement(node) || ts.isTryStatement(node)) {
      return 'efecto de entrada';
    }
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) =>
      d.initializer && (ts.isCallExpression(d.initializer) || ts.isNewExpression(d.initializer)))) {
      return 'efecto de entrada';
    }
    visit(node);
  }
  return reason;
}

/** @description Recorre dependencias y muestra cadena de infracción. @param {string} file - Actual. @param {string[]} chain - Camino. @param {Set<string>} visited - Visitados. @returns {string | null} Error. */
function check(file, chain, visited) {
  if (visited.has(file)) return null;
  visited.add(file);
  const path = [...chain, label(file)];
  if (file !== domainRoot && !file.startsWith(domainRoot + sep) &&
      (file.startsWith(resolve(sourceRoot, 'app') + sep) ||
       file.includes(`${sep}adapters${sep}`) || file === resolve(sourceRoot, 'lib/prisma.ts'))) {
    return `${path.join(' → ')}: dependencia prohibida`;
  }
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
    extname(file) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const issue = unsafe(ast);
  if (issue) return `${path.join(' → ')}: ${issue}`;
  for (const node of ast.statements) {
    const spec = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
      ? node.moduleSpecifier?.text
      : ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
        ? node.moduleReference.expression?.text : null;
    if (!spec) continue;
    if (forbidden.some((prefix) => spec === prefix || spec.startsWith(prefix))) {
      return `${path.join(' → ')} → ${spec}: dependencia prohibida`;
    }
    const target = local(file, spec);
    if ((spec.startsWith('.') || spec.startsWith('@/')) && !target) {
      return `${path.join(' → ')} → ${spec}: import local sin resolver`;
    }
    if (!target) return `${path.join(' → ')} → ${spec}: dependencia externa no autorizada`;
    const error = check(target, path, visited);
    if (error) return error;
  }
  return null;
}

if (!existsSync(domainRoot)) {
  console.log('PENDIENTE: src/dominio no existe; reglas cargadas, aislamiento sin verificar.');
} else {
  const sources = files(domainRoot);
  if (sources.length === 0) {
    console.error('src/dominio vacío: aislamiento sin verificar');
    process.exitCode = 1;
  }
  for (const file of sources) {
    const issue = check(file, [], new Set());
    if (issue) {
      console.error(issue);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) console.log(`Aislamiento comprobado: ${sources.length} módulos.`);
}
