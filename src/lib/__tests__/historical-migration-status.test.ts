import { describe, expect, it } from 'vitest';

const { selectHistoricalMigrations, historicalMigrations } = require('../../../scripts/check-prisma-migration-status.cjs');

describe('historical migration status compatibility', () => {
  it('includes only verified historical migrations already applied', () => {
    const migration = historicalMigrations[0];
    expect(selectHistoricalMigrations([{ migration_name: migration.name, checksum: migration.checksum, finished_at: new Date(), rolled_back_at: null }]))
      .toEqual([migration]);
    expect(selectHistoricalMigrations([])).toEqual([]);
  });

  it('rejects an applied historical migration with an unexpected checksum', () => {
    expect(() => selectHistoricalMigrations([
      { migration_name: historicalMigrations[0].name, checksum: 'incorrect', finished_at: new Date(), rolled_back_at: null },
    ])).toThrow();
  });

  it('rejects unfinished or duplicate applied historical migrations', () => {
    const migration = historicalMigrations[0];
    const row = { migration_name: migration.name, checksum: migration.checksum, finished_at: new Date(), rolled_back_at: null };
    expect(() => selectHistoricalMigrations([{ ...row, finished_at: null }])).toThrow();
    expect(() => selectHistoricalMigrations([row, row])).toThrow();
  });
});
