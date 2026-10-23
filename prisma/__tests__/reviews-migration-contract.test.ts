import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261022140000_add_review_tables/migration.sql',
);

describe('reviews schema migration contract', () => {
  it('keeps the Review and ReviewPrompt model field contracts', () => {
    const review = schema.split('model Review {')[1]?.split('\n}')[0] ?? '';
    const prompt = schema.split('model ReviewPrompt {')[1]?.split('\n}')[0] ?? '';
    expect(review).toMatch(/reviewId\s+String\s+@id\s+@default\(cuid\(\)\)/);
    expect(review).toMatch(/tenantId\s+String/);
    expect(review).toMatch(/userId\s+String/);
    expect(review).toMatch(/isApproved\s+Boolean\s+@default\(false\)/);
    expect(review).toContain('@@map("reviews")');
    expect(prompt).toMatch(/promptId\s+String\s+@id\s+@default\(cuid\(\)\)/);
    expect(prompt).toMatch(/dismissedAt\s+DateTime\?/);
    expect(prompt).toMatch(/submittedAt\s+DateTime\?/);
    expect(prompt).toContain('@@map("review_prompts")');
  });

  it('adds only the reviewed tables, indexes, and tenant/user cascades', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE "reviews"');
    expect(sql).toContain('CREATE TABLE "review_prompts"');
    expect(sql).toContain('"isApproved" BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain('"promptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP');
    expect(sql).toContain('"dismissedAt" TIMESTAMP(3)');
    expect(sql).toContain('"submittedAt" TIMESTAMP(3)');
    expect(sql).toContain('reviews_tenantId_userId_key');
    expect(sql).toContain('reviews_tenantId_isApproved_idx');
    expect(sql).toContain('reviews_tenantId_isPositive_isApproved_idx');
    expect(sql).toContain('review_prompts_tenantId_userId_promptedAt_idx');
    expect(sql).toContain('REFERENCES "tenants"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE');
    expect(sql).toContain('REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE');
    expect(sql).not.toMatch(/\b(?:DROP|ALTER)\s+(?:TABLE|TYPE|COLUMN)\b/i);
    expect(sql).not.toMatch(/\bIF\s+NOT\s+EXISTS\b/i);
    expect(sql).not.toContain('ValeSalida');
    expect(sql).not.toContain('BackupType');
  });
});
