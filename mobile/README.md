# TCP Mobile Reference Client

Phase 5 bootstraps a minimal Expo/React Native TypeScript client that consumes the committed SDK at `../sdks/mobile-v1/typescript`. This slice intentionally implements only the authentication/session lifecycle.

## Setup

```bash
cd mobile
pnpm install
pnpm run typecheck
pnpm test
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 pnpm start
```

All dependencies are installed and resolved locally from `mobile/`; this client
does not modify the root workspace or copy the generated SDK.

`EXPO_PUBLIC_API_BASE_URL` is required at runtime. It may be an API origin (`http://localhost:3000`) or a complete mobile base path. No production URL is embedded in the client.

## Secure session behavior

- Access tokens remain in memory and are supplied to the generated SDK through an injectable callback.
- Only refresh tokens are persisted with `expo-secure-store`.
- Refresh rotation and tenant switching write the new refresh token before replacing the in-memory access token.
- Logout clears local state even when the remote revoke call fails.
- Refresh failures and 401 responses clear local state without logging credentials or tokens.
- Tests use an in-memory storage fake; they never access device storage.

## Verification

```bash
cd mobile
pnpm install
pnpm run typecheck
pnpm test
pnpm start
```

The repository root can also run the focused tests with `pnpm exec vitest run mobile/src/*.test.ts`.

## Next slice

Add authenticated API request handling and the first real product surface only after this lifecycle is validated on Expo Go or a development client. This phase does not claim a native build.
