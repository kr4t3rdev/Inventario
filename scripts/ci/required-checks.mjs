import { pathToFileURL } from 'node:url';

/**
 * @description Fail closed unless every required CI dependency succeeded.
 * @param {Record<string, { result?: string }>} results GitHub needs results.
 * @returns {void} Returns only on complete success.
 */
export function checkRequiredResults(results) {
  const names = ['lint', 'typecheck', 'test', 'coverage', 'integration', 'build'];
  for (const name of names) {
    if (results?.[name]?.result !== 'success') {
      throw new Error(`Required check did not succeed: ${name}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkRequiredResults(JSON.parse(process.env.REQUIRED_RESULTS || '{}'));
}
