# TCP Mobile Reference Client

Phase 6 extends the Expo/React Native TypeScript client with the first authenticated business surface using only the committed SDK at `../sdks/mobile-v1/typescript`: dashboard stats, a product catalog list, and stock by location. It does not add product mutations, location CRUD, navigation, or new backend contract fields.

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
- Unauthorized dashboard, product, or stock responses (401/403) expire the local session and return the app to login; response bodies are not logged.
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

## Phase 6 data behavior

- `src/business-api.ts` adapts the generated `DashboardApi` and `ProductsApi` with a configurable base URL and in-memory access-token callback.
- Dashboard, catalog, and stock requests load independently. A failed section keeps successful sections visible and exposes a retry action; an unavailable stock request does not block dashboard or catalog loading.
- Stock requests require both `ubicacionId` and the generated `tipoUbicacion` enum (`almacen` or `punto_venta`). Stock is not requested until both values are provided, and ready requests use `includeZero=false`.
- The stock empty state asks the user to select a supported location type and enter the required location identifier.
- Product rows display only identity fields, name, code, price, and stock; cost is intentionally not displayed.

## Exact verification commands

Run from the repository root without installing dependencies:

```bash
cd mobile
pnpm exec vitest run src/business-api.test.ts
pnpm exec vitest run src/*.test.ts
pnpm exec tsc --noEmit
cd ..
git diff --check
```

This phase does not claim a native build or a live API verification.
