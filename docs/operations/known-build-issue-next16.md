# Known Build Issue - Next 16 build worker OOM / static generation failure

## Status
Open

## Date
2026-07-02

## Branch
`codex/upgrade-next-16`

## Summary
After fixing the preexisting TypeScript compatibility issues around Next and UploadThing, the remaining deploy blocker is the Next.js production build itself.

This is not currently failing because of `uploadthing/server` imports or the recent sidebar/auth fixes. The active failure mode is build instability caused by memory pressure and/or very heavy compile/prerender work.

## Evidence

### 1) Webpack build on Next 16 can fail with OOM
Running:

```bash
pnpm exec next build --webpack --debug
```

produced a worker crash with:

```text
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
Next.js build worker exited with code: null and signal: SIGABRT
```

Observed worker memory during failure investigation:
- the failing `jest-worker/processChild.js` process grew until heap pressure triggered OOM
- without `NODE_OPTIONS=--max-old-space-size=4096`, the worker aborted around the ~2 GB heap ceiling

### 2) Project build script already tries to mitigate memory pressure
`package.json` uses:

```json
"build": "NODE_OPTIONS='--max-old-space-size=4096' NEXT_TELEMETRY_DISABLED=1 next build"
```

So the repo already depends on a larger Node heap just to attempt production build.

### 3) Historical evidence of failure after compile
Existing local log file:
- `build-output.log`

shows an earlier build on Next 15 that:
- compiled successfully
- skipped type validation and linting
- then failed during static generation with:

```text
Generating static pages (96/193)
Next.js build worker exited with code: null and signal: SIGTERM
```

This suggests the problem is broader than a single import error. The app has a heavy build footprint in both compile and prerender phases.

## Current repo characteristics that likely contribute
- `143` App Router pages (`page.tsx`)
- `123` pages under `/busy`
- only `4` `/busy` pages explicitly marked `force-dynamic`; most remain eligible for heavier build analysis
- `105` docs files feeding the docs route static generation
- `.next` reached roughly `1.2 GB` during investigation

## Important conclusion
The current blocker appears to be:
- **build memory pressure / compile cost**, and possibly also
- **static generation cost during prerender**

It does **not** currently reproduce as the previous UploadThing type/import error.

## Recommended next investigation steps
1. Isolate compile vs prerender cost
   - run build modes separately when possible
   - compare webpack vs default builder behavior
2. Measure whether docs static generation is a major contributor
   - temporarily exclude or narrow docs generation
3. Audit `/busy` routes for pages that should be explicitly dynamic
   - especially pages that call auth/user/tenant/server actions on render
4. Review large client bundles and expensive imports
   - especially with `optimizePackageImports` enabled
5. Re-check behavior in the actual deploy environment
   - local OOM and CI/Railway SIGTERM may be the same root cause with different resource limits

## Files consulted during diagnosis
- `package.json`
- `next.config.mjs`
- `build-output.log`
- `build_output.txt`
- `src/app/busy/layout.tsx`
- `src/app/docs/[...module]/page.tsx`

## Notes for continuation
When resuming, do **not** start by revisiting UploadThing. Start from build-cost isolation.
