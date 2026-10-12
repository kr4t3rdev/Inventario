"""Construye un paquete Prisma heredado desde Git, sin consultar ni escribir bases."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess

EVIDENCE = 'openspec/changes/contabilidad-capa-formal/'


def git(root, *args):
  """Ejecuta Git en root y devuelve bytes; no lee archivos de entorno."""
  return subprocess.check_output(['git', '-C', str(root), *args])


def digest(raw):
  """Devuelve SHA-256 de los bytes exactos, sin normalizar SQL."""
  return hashlib.sha256(raw).hexdigest()


def build(root, commit, output):
  """Valida procedencia/hash antes de crear un paquete nuevo desde un commit fijo.

  Args: root: repositorio; commit: revisión Git; output: directorio inexistente.
  Returns: manifiesto determinista del schema y todos los SQL seleccionados.
  """
  target = git(root, 'rev-parse', '--verify', commit + '^{commit}').decode().strip()
  history = json.loads(git(root, 'show', target + ':' + EVIDENCE
                          + 'r6-baseline-production-2026-10-11.json'))
  lineage = json.loads(git(root, 'show', target + ':' + EVIDENCE
                          + 'r6-production-clone-manifest-2026-10-11.json'))
  crosswalk = json.loads(git(root, 'show', target + ':' + EVIDENCE
                            + 'r6-baseline-production-historical-sql-2026-10-11.json'))
  sources = {item['migration']: item['matches'][0] for item in crosswalk}
  applied = {}
  for row in history['migrations']:
    if row['finishedAt'] and not row['rolledBackAt']:
      name = row['migrationName']
      if name in applied and applied[name] != row['checksum']:
        raise ValueError('Conflicting applied checksums: ' + name)
      applied[name] = row['checksum']
  paths = git(root, 'ls-tree', '-r', '--name-only', target,
              'prisma/migrations').decode().splitlines()
  originals = {path.split('/')[2]: path for path in paths
               if re.fullmatch(r'prisma/migrations/[^/]+/migration.sql', path)}
  records, sql_files = [], {}
  for name in sorted(set(originals) | set(applied)):
    if not re.fullmatch(r'[A-Za-z0-9_]+', name):
      raise ValueError('Invalid migration name: ' + name)
    path = 'prisma/migrations/' + name + '/migration.sql'
    raw = git(root, 'show', target + ':' + path) if name in originals else None
    source = target
    origin = 'target-commit'
    if name in applied and (raw is None or digest(raw) != applied[name]):
      if name in sources:
        source = sources[name]['commit']
        raw = sources[name]['sql'].encode('utf-8')
        origin = 'versioned-verified-crosswalk'
      else:
        source = lineage['sourceCommit']
        raw = git(root, 'show', source + ':' + path)
        origin = 'deployed-source-commit'
    if name in applied and digest(raw) != applied[name]:
      raise ValueError('Recorded checksum mismatch: ' + name)
    sql_files[name] = raw
    records.append({'name': name, 'sha256': digest(raw), 'sourceCommit': source, 'origin': origin,
                    'alreadyApplied': name in applied})
  schema = git(root, 'show', target + ':prisma/schema.prisma')
  manifest = {
    'targetCommit': target, 'sourceCommit': lineage['sourceCommit'],
    'schemaSha256': digest(schema), 'migrations': records,
    'scope': 'captured inherited database only; not empty bootstrap or rollout acceptance',
    'historicalAppliedCount': len(applied), 'pendingCount': len(records) - len(applied),
  }
  output.mkdir(mode=0o700, parents=False, exist_ok=False)
  for name, raw in sql_files.items():
    folder = output / 'prisma/migrations' / name
    folder.mkdir(parents=True)
    (folder / 'migration.sql').write_bytes(raw)
  (output / 'prisma/schema.prisma').write_bytes(schema)
  (output / 'prisma/migrations/migration_lock.toml').write_text('provider = "postgresql"\n')
  (output / 'prisma.config.ts').write_text(
    "import { defineConfig } from 'prisma/config';\n"
    "export default defineConfig({schema: 'prisma/schema.prisma', engine: 'classic', "
    "datasource: {url: process.env.DATABASE_URL, directUrl: process.env.DIRECT_URL}});\n")
  (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
  return manifest


if __name__ == '__main__':
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument('--root', type=pathlib.Path, default=pathlib.Path.cwd())
  parser.add_argument('--commit', required=True)
  parser.add_argument('--output', required=True, type=pathlib.Path)
  args = parser.parse_args()
  result = build(args.root, args.commit, args.output)
  print(json.dumps({'targetCommit': result['targetCommit'],
                    'historicalAppliedCount': result['historicalAppliedCount'],
                    'pendingCount': result['pendingCount'],
                    'schemaSha256': result['schemaSha256']}, indent=2))
