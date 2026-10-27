import { expect, it, vi } from 'vitest';

const loadConfig = async () => {
  vi.resetModules();
  const config = await import('../../../next.config.mjs');
  return config.default as {
    output?: string;
    outputFileTracingIncludes?: Record<string, string[]>;
    outputFileTracingExcludes?: Record<string, string[]>;
  };
};

it('keeps Vercel Prisma runtime assets while excluding types and the Darwin engine', async () => {
  const originalVercel = process.env.VERCEL;
  process.env.VERCEL = '1';

  try {
    const config = await loadConfig();
    const includes = config.outputFileTracingIncludes?.['/**'] ?? [];
    const excludes = config.outputFileTracingExcludes?.['/**'] ?? [];

    expect(config.output).toBe('standalone');
    expect(includes).toContain('./src/generated/prisma/**/*.so.node');
    expect(includes).toContain('./src/generated/prisma/**/*.wasm');
    expect(includes).toContain('./src/generated/prisma/**/*.js');
    expect(includes).toContain('./src/generated/prisma/**/*.mjs');
    expect(includes).toContain('./src/generated/prisma/**/*.json');
    expect(includes).toContain('./src/generated/prisma/**/*.prisma');
    expect(includes).not.toContain('./src/generated/prisma/**');
    expect(excludes).toContain('./src/generated/prisma/**/*.d.ts');
    expect(excludes).toContain('./src/generated/prisma/**/*.dylib.node');
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});

it.each([undefined, '0'])('preserves the complete Prisma trace include when VERCEL is %s', async (vercel) => {
  const originalVercel = process.env.VERCEL;
  if (vercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = vercel;

  try {
    const config = await loadConfig();

    expect(config.output).toBe('standalone');
    expect(config.outputFileTracingIncludes?.['/**']).toEqual([
      './src/generated/prisma/**',
    ]);
    expect(config.outputFileTracingExcludes).toBeUndefined();
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  }
});
