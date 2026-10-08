import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expectTypeOf, it } from 'vitest';
import { Prisma } from '@/generated/prisma';
import { replayEvento } from '@/features/contabilidad-formal/services/posting-engine';
import type { PostingTx } from '@/features/contabilidad-formal/services/posting-engine';
import type { CierreTx } from '@/features/contabilidad-formal/services/cierre-formal-service';

const REPLAY_SERVICE_PATH = resolve(
	process.cwd(),
	'src/features/contabilidad-formal/services/replay-backfill-service.ts',
);

it('uses Prisma transaction clients throughout formal accounting services', () => {
	expectTypeOf<PostingTx>().toEqualTypeOf<Prisma.TransactionClient>();
	expectTypeOf<CierreTx>().toEqualTypeOf<Prisma.TransactionClient>();
	expectTypeOf<Parameters<typeof replayEvento>[0]>().toEqualTypeOf<Prisma.TransactionClient>();

	const replaySource = readFileSync(REPLAY_SERVICE_PATH, 'utf8');
	expect(replaySource).not.toMatch(/replayEvento\(\s*tx\s+as\s+never/);
});
