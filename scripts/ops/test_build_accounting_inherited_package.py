"""Pruebas físicas Git del paquete heredado: reproducibilidad y procedencia exacta."""
import importlib.util
import json
import pathlib
import subprocess
import tempfile
import unittest

MODULE = pathlib.Path(__file__).with_name('build-accounting-inherited-package.py')
spec = importlib.util.spec_from_file_location('builder', MODULE)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class InheritedPackageTest(unittest.TestCase):
  """Verifica que el constructor no dependa de archivos sucios ni invente historia."""

  def setUp(self):
    """Crea un repositorio sintético con SQL heredado, reescrito y pendiente."""
    base = pathlib.Path(tempfile.gettempdir()) / 'opencode'
    self.temp = tempfile.TemporaryDirectory(dir=base if base.is_dir() else None)
    self.root = pathlib.Path(self.temp.name)
    subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
    self.write('prisma/schema.prisma', '// frozen schema\n')
    self.write('prisma/migrations/old/migration.sql', 'SELECT 1;\n')
    self.write('prisma/migrations/db_only/migration.sql', 'SELECT 2;\n')
    self.source = self.commit()
    self.write('prisma/migrations/old/migration.sql', 'SELECT 999;\n')
    (self.root / 'prisma/migrations/db_only/migration.sql').unlink()
    self.write('prisma/migrations/pending/migration.sql', 'SELECT 3;\n')
    self.history = {'migrations': [
      {'migrationName': n, 'checksum': builder.digest(raw.encode()),
       'finishedAt': '2026-01-01', 'rolledBackAt': None}
      for n, raw in [('old', 'SELECT 1;\n'), ('db_only', 'SELECT 2;\n')]]}
    self.write(builder.EVIDENCE + 'r6-baseline-production-2026-10-11.json',
               json.dumps(self.history))
    self.write(builder.EVIDENCE + 'r6-production-clone-manifest-2026-10-11.json',
               json.dumps({'sourceCommit': self.source}))
    self.write(builder.EVIDENCE + 'r6-baseline-production-historical-sql-2026-10-11.json',
               json.dumps([{'migration': 'old', 'matches': [
                 {'commit': 'unavailable-historical-commit', 'sql': 'SELECT 1;\n'}]}]))
    self.target = self.commit()

  def tearDown(self):
    """Limpia únicamente el repositorio sintético de esta prueba."""
    self.temp.cleanup()

  def write(self, path, content):
    """Escribe un fixture dentro del repositorio sintético."""
    file = self.root / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content)

  def commit(self):
    """Versiona los fixtures sin depender de identidad o configuración global."""
    builder.git(self.root, 'add', '-A')
    builder.git(self.root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@test.local',
                '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null',
                'commit', '-qm', 'fixture')
    return builder.git(self.root, 'rev-parse', 'HEAD').decode().strip()

  def test_reproducible_ignores_dirty_checkout_and_recovers_exact_history(self):
    """Reproduce bytes y manifiesto en dos destinos pese a cambios sin commit."""
    self.write('prisma/migrations/pending/migration.sql', 'SELECT 888;\n')
    a = builder.build(self.root, self.target, self.root / 'package-a')
    b = builder.build(self.root, self.target, self.root / 'package-b')
    self.assertEqual(a, b)
    self.assertEqual(a['historicalAppliedCount'], 2)
    self.assertEqual(a['pendingCount'], 1)
    for name, raw in [('old', 'SELECT 1;\n'), ('db_only', 'SELECT 2;\n'),
                      ('pending', 'SELECT 3;\n')]:
      self.assertEqual((self.root / 'package-a/prisma/migrations' / name
                        / 'migration.sql').read_text(), raw)

  def test_bad_checksum_aborts_before_creating_package(self):
    """Un historial incompatible no produce un paquete parcialmente validado."""
    self.history['migrations'][0]['checksum'] = '0' * 64
    self.write(builder.EVIDENCE + 'r6-baseline-production-2026-10-11.json',
               json.dumps(self.history))
    target = self.commit()
    with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
      builder.build(self.root, target, self.root / 'rejected')
    self.assertFalse((self.root / 'rejected').exists())

  def test_existing_output_is_not_overwritten(self):
    """Protege un paquete o trabajo preexistente en el destino."""
    output = self.root / 'existing'
    output.mkdir()
    (output / 'user-work').write_text('preserve')
    with self.assertRaises(FileExistsError):
      builder.build(self.root, self.target, output)
    self.assertEqual((output / 'user-work').read_text(), 'preserve')


if __name__ == '__main__':
  unittest.main()
