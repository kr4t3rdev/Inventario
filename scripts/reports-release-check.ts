import { summarizeDurations } from '../src/lib/reports-release-check';
export * from '../src/lib/reports-release-check';
if (process.argv[1]?.endsWith('reports-release-check.ts')) console.log(JSON.stringify(summarizeDurations(process.argv.slice(2).map(Number)), null, 2));
