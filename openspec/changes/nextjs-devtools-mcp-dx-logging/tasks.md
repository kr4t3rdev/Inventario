# Tasks: Next.js DevTools MCP and DX Logging Improvements

## Phase 1: Configuration Foundation

- [x] 1.1 Update `.mcp.json` to add a `next-devtools` MCP server entry using `npx -y next-devtools-mcp@latest`.
- [x] 1.2 Preserve the existing `testsprite` MCP server entry in `.mcp.json` and keep the JSON structure valid.
- [x] 1.3 Update `next.config.ts` to introduce a `logging` block without changing the current build/performance settings.

## Phase 2: DX Logging Wiring

- [x] 2.1 Enable `logging.browserToTerminal` in `next.config.ts` so browser console output is forwarded to the terminal during development.
- [x] 2.2 Add inline comments in `next.config.ts` explaining what browser-to-terminal logging covers and why it is the chosen intermediate DX step.
- [x] 2.3 Document in `next.config.ts` comments that `instrumentation.ts` is the next escalation path when terminal logging is not enough.

## Phase 3: Validation of Developer Workflow

- [x] 3.1 Start the app with `pnpm dev` and confirm the Next.js configuration loads successfully with the new MCP and logging settings.
- [x] 3.2 Verify that an MCP-capable client can discover the `next-devtools` server from `.mcp.json` without additional code changes.
- [ ] 3.3 Trigger a browser console message in development and confirm it appears in the terminal output as required by the DX logging spec.
- [ ] 3.4 Trigger a development request/fetch path and confirm terminal output remains useful for debugging without requiring `instrumentation.ts`.

## Phase 4: Quality Check and Documentation Closure

- [x] 4.1 Run `pnpm exec eslint next.config.ts` to ensure the updated config remains lint-clean.
- [ ] 4.2 Run `pnpm run typecheck` to confirm the Next.js config and project types still compile cleanly.
- [ ] 4.3 Review the change artifacts (`proposal.md`, `specs/developer-experience/spec.md`, `design.md`) to ensure the future `instrumentation.ts` path is explicitly captured.
