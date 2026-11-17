import { readFile, writeFile } from 'node:fs/promises';
import seed from './seed-e2e-user.ts';

const { cleanup, run } = seed;

const command = process.env.E2E_SEED_COMMAND;
const output = process.env.E2E_SEED_OUTPUT;

if (!output) throw new Error('E2E_SEED_OUTPUT es obligatorio.');

if (command === 'run') {
  await writeFile(output, JSON.stringify(await run()), { mode: 0o600 });
} else if (command === 'cleanup') {
  const ownership = JSON.parse(await readFile(output, 'utf8'));
  await cleanup(ownership);
} else {
  throw new Error(`Comando E2E no reconocido: ${command ?? '<vacío>'}.`);
}
