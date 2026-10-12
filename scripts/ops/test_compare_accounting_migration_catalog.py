"""Pruebas de falsos positivos del inventario de catálogos."""
import pathlib
import tempfile
import unittest
from importlib.util import module_from_spec, spec_from_file_location

SPEC = spec_from_file_location(
  'migration_catalog', pathlib.Path(__file__).with_name('compare-accounting-migration-catalog.py')
)
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
compare = MODULE.compare


class CatalogComparisonTest(unittest.TestCase):
  """Verifica asociación y estado operativo, no solo coincidencia de nombres."""

  def run_comparison(self, sql, relations, triggers=None):
    """Ejecuta el comparador con un historial vacío y catálogos controlados."""
    with tempfile.TemporaryDirectory() as directory:
      root = pathlib.Path(directory)
      folder = root / 'prisma/migrations/20260101000000_fixture'
      folder.mkdir(parents=True)
      (folder / 'migration.sql').write_text(sql)
      return compare(root, {'migrations': []}, {
        'capturedAt': 'fixture', 'relations': relations, 'triggers': triggers or []
      })['migrations'][0]

  def test_same_name_on_wrong_table_does_not_pass(self):
    """Un índice de otra tabla no acredita el objeto solicitado."""
    result = self.run_comparison('CREATE UNIQUE INDEX "key" ON "Target"("id");', [{
      'relation': 'Other', 'indexes': [{'name': 'key', 'valid': True, 'ready': True}]
    }])
    self.assertEqual(result['ready'], 0)

  def test_inactive_objects_do_not_pass(self):
    """Índice inválido, CHECK no validado y trigger apagado quedan pendientes."""
    result = self.run_comparison('''
      CREATE INDEX "index" ON "Target"("id");
      ALTER TABLE "Target" ADD CONSTRAINT "check" CHECK ("id" > 0);
      CREATE TRIGGER "trigger" BEFORE UPDATE ON "Target"
        FOR EACH ROW EXECUTE FUNCTION guard();
    ''', [{
      'relation': 'Target',
      'indexes': [{'name': 'index', 'valid': False, 'ready': True}],
      'constraints': [{'name': 'check', 'validated': False}]
    }], [{'relation': 'Target', 'name': 'trigger', 'enabled': 'D'}])
    self.assertEqual(result['total'], 3)
    self.assertEqual(result['ready'], 0)

  def test_multi_column_and_enum_type_are_not_omitted(self):
    """Extrae tipos entre comillas y varias columnas de un mismo ALTER."""
    result = self.run_comparison('''
CREATE TABLE "Target" (
  "id" TEXT NOT NULL,
  "state" "State" NOT NULL
);
ALTER TABLE "Target" ADD COLUMN "a" TEXT, ADD COLUMN "b" TEXT;
''', [{'relation': 'Target', 'columns': [{'name': n} for n in ('id', 'state', 'a')]}])
    self.assertEqual(result['total'], 5)
    self.assertEqual(result['ready'], 4)
    self.assertEqual(result['classification'], 'partial')


if __name__ == '__main__':
  unittest.main()
