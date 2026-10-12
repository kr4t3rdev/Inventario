"""Inventario focal de declaraciones SQL frente a un snapshot de catálogos.

No es un parser SQL completo ni certifica equivalencia semántica o datos.
Uso: python3 scripts/ops/compare-accounting-migration-catalog.py ROOT HISTORY CATALOG OUTPUT
"""
import hashlib
import json
import pathlib
import re
import sys


def compare(root, history, catalog):
  """Devuelve presencia nominativa de objetos declarados en migraciones no registradas.

  Args: root: raíz; history: historial JSON; catalog: snapshot público JSON.
  Returns: manifiesto con hashes, checks y límites explícitos.
  """
  applied = {r['migrationName'] for r in history['migrations']
             if r['finishedAt'] and not r['rolledBackAt']}
  tables = {r['relation']: r for r in catalog['relations']}
  output = []
  for file in sorted((root / 'prisma/migrations').glob('*/migration.sql')):
    if file.parent.name in applied:
      continue
    sql = re.sub(r'--[^\n]*', '', file.read_text())
    declarations = set()
    for m in re.finditer(r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"([^"]+)"\s*\((.*?)\n\);',
                         sql, re.S):
      table, body = m.groups()
      declarations.add(('table', table, table))
      for name in re.findall(r'^\s*"([^"]+)"\s+[A-Z"]', body, re.M):
        declarations.add(('column', table, name))
      for name in re.findall(r'CONSTRAINT\s+"([^"]+)"', body):
        declarations.add(('constraint', table, name))
    for m in re.finditer(r'ALTER TABLE\s+"([^"]+)"(.*?);', sql, re.S):
      table, body = m.groups()
      for name in re.findall(r'ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"([^"]+)"', body):
        declarations.add(('column', table, name))
      for name in re.findall(r'ADD CONSTRAINT\s+"([^"]+)"', body):
        declarations.add(('constraint', table, name))
    for name, table in re.findall(
        r'CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?"([^"]+)"\s+ON\s+"([^"]+)"', sql):
      declarations.add(('index', table, name))
    for name, table in re.findall(r'CREATE TRIGGER\s+"([^"]+)".*?\bON\s+"([^"]+)"',
                                  sql, re.S):
      declarations.add(('trigger', table, name))
    checks = []
    for kind, table, name in sorted(declarations):
      relation = tables.get(table)
      found = None
      if kind == 'table':
        ready = relation is not None
      elif kind == 'trigger':
        found = next((t for t in catalog['triggers']
                      if t['relation'] == table and t['name'] == name[:63]), None)
        ready = found is not None and found['enabled'] in ('O', 'A')
      else:
        key = {'column': 'columns', 'constraint': 'constraints', 'index': 'indexes'}[kind]
        found = next((o for o in (relation or {}).get(key, [])
                      if o['name'] == name[:63]), None)
        ready = found is not None
        if ready and kind == 'constraint':
          ready = found['validated']
        if ready and kind == 'index':
          ready = found['valid'] and found['ready']
      checks.append({'kind': kind, 'relation': table, 'name': name,
                     'presentAndOperational': ready, 'actual': found})
    count = sum(c['presentAndOperational'] for c in checks)
    output.append({'migration': file.parent.name,
                   'sqlSha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                   'classification': ('no_declarations_extracted' if not checks else
                                      'names_present' if count == len(checks) else
                                      'names_absent' if count == 0 else 'partial'),
                   'ready': count, 'total': len(checks), 'checks': checks})
  return {'scope': 'quoted CREATE TABLE/INDEX/TRIGGER and ALTER TABLE ADD declarations',
          'limits': 'No comparison of SQL semantics, types, defaults, functions, enum changes, '
                    'ALTER COLUMN, DML or unquoted declarations; not migration acceptance.',
          'catalogCapturedAt': catalog['capturedAt'], 'migrations': output}


if __name__ == '__main__':
  root, history, catalog, target = map(pathlib.Path, sys.argv[1:])
  report = compare(root, json.loads(history.read_text()), json.loads(catalog.read_text()))
  target.write_text(json.dumps(report, indent=2) + '\n')
  print(json.dumps([{k: r[k] for k in ('migration', 'classification', 'ready', 'total')}
                    for r in report['migrations']], indent=2))
