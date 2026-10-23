# Structured, private tenant backups — design and implementation plan

**Status:** approved direction; implementation is in progress. Slice 0 action/engine guards and focused mocked tests have been implemented locally and approved by fresh independent review. Tenant restore nevertheless remains unavailable until the codec, full policy, private storage, integration, and enablement gates below pass. No restore wiring, migration, database access, Blob provisioning, environment/secret operation, commit, or push is part of the current pure-codec slice. The platform-admin full/imported SQL recovery path remains a separate privileged capability.

**Skills loaded before work:**
- `/Users/arturo/.agents/skills/brainstorming/SKILL.md`
- `/Users/arturo/.agents/skills/security-review/SKILL.md`
- `/Users/arturo/.codex/plugins/cache/ecc/ecc/2.2.0/skills/database-migrations/SKILL.md`
- `/Users/arturo/.codex/plugins/cache/openai-curated/vercel/c6ea566d/skills/vercel-storage/SKILL.md`

**Source plan:** `/tmp/tcp-qa-20261021/reconciliation/backup-hardening-plan.md`. This plan keeps its key boundary: tenant SQL restore fails closed until the new format, full policy coverage, and verification gates exist.

## Decision and invariants

Replace only tenant backups with a versioned structured data format and private storage. Do not parse or execute SQL to restore a tenant. No tenant restore may run until a validated signed artifact and complete server-owned policy exist.

1. Tenant and actor identity come from the authenticated request and authorized `BackupLog` lookup, never caller-supplied `tenantId`, filename, path, or URL. The route/action accepts a `backupLogId`; server-side log fields bind the operation to its artifact.
2. Every included row must belong to the current tenant either through its own validated `tenantId` or an explicit same-tenant parent relation. Unknown model/table, column, relation, schema version, enum, or ownership rule is a hard rejection.
3. `Tenant`, `User`, `Plan`, `TenantMembership`, `TenantLicense`, and platform/admin/security data are not tenant-restore write targets. They are excluded or reference-only. Tenant restore must not recreate/change global users, passwords/roles, tenant IDs, plans, memberships, license entitlements, or accounting identity.
4. New writes create private objects only; the artifact contains data but no SQL, DDL, executable code, public URL, or provider credentials. The app never returns the provider URL to clients.
5. Tenant restore is a conservative merge, **not a rewind**. It does not disable triggers, update/delete immutable evidence, or delete history. Identical protected evidence is a no-op; evidence in the backup but absent in target may be inserted after parent validation; any target-only/newer protected evidence or same-identity/different-payload business-row conflict rejects the entire restore before any write. There is no “ignore duplicate” shortcut. A compensating/accounting rollback or replay workflow is outside this approval.
6. Restore is a conservative, non-rewinding merge. Preserve target-only rows by default; absence from the artifact never implies deletion. Insert missing incoming rows only after whole-payload owner/FK preflight. For any same-identity/different-payload business row, fail closed before any write; no overwrite/rewind policy is approved. No blanket delete/reinsert or generic upsert. Preserve referenced protected parents and all inbound FK dependencies; any unproven edge blocks before writes. Existing foreign keys, tenant ownership, and evidence triggers remain enabled.
7. Missing/invalid HMAC key, unknown key ID, unsupported schema, malformed/oversized artifact, incomplete policy inventory, artifact/log mismatch, or storage mismatch disables this feature path. Error logs contain safe error codes and counts, never row payloads, secrets, SQL, signatures, or raw artifact bytes.

## Current state / constraints

- The earlier audit found a tenant restore path that deleted tenant rows and executed parsed backup SQL. The bounded Slice 0 action/engine guards and mocked tests now reject tenant SQL before artifact access or DB effects; fresh independent review approved this boundary. Tenant restore remains unavailable until all later gates pass. Do not extend `sql-builder.ts` or its SQL splitter for tenant restore.
- Current Vercel storage adapter (`src/features/backups/storage/blob-storage.ts`) uploads public objects, downloads by provider URL, and exposes Blob URLs. Keep it as legacy behavior only for explicitly classified old artifacts; add a distinct private-store configuration/path for new artifacts. Do not flip the existing store from public to private in place, provision a store, migrate/delete old public blobs, or change cloud settings in this task.
- Existing full/imported SQL restore remains a separate platform-admin operation with its existing explicit dangerous-action confirmation and audit trail. It must not call tenant codec/policy code, and tenant code must not route into admin SQL helpers.
- The security audit found legacy tenant restore toggling `session_replication_role=replica`, bypassing ten custom trigger invariants. Slice 0 removes the tenant SQL execution path and passed fresh independent review. The structured path must never set that mode or disable any trigger.
- Current `BackupLog` has `backupLogId`, `type`, nullable `tenantId`, `status`, `fileUrl`, `fileName`, `fileSize`, timestamps and `createdBy`; it lacks structured artifact binding metadata. New fields should be additive/nullable so historic SQL backup rows remain readable. Never reuse `fileUrl` to return a new private blob URL.

## Format and integrity contract

### Envelope

Use a bounded binary-safe envelope that can be stored as a regular file without SQL parsing. Proposed v2 framing is an outer JSON object with base64 `headerBytes`, base64 compressed `payloadBytes`, and base64 `hmacSha256`. `headerBytes` are serialized once and are the exact bytes authenticated; `payloadBytes` are the exact gzip bytes authenticated. Encoder output must be a typed sealed artifact containing both the envelope bytes and the exact persisted metadata binding; decoder expected metadata must come only from an authorized, already-persisted `BackupLog`, never from the artifact, request, or a self-asserted encoder header. This avoids a canonical-JSON dependency and avoids decoding the row payload before authentication.

The signed header contains only declared metadata:

- `format: "tcp-tenant-backup"`, `formatVersion: 2`;
- `dataSchemaVersion` (versioned tenant-backup policy/schema registry; restore supports only a registered compatible version, exact version initially);
- `backupType: "tenant"`, source `backupLogId`, `tenantId`, and UTC `createdAt`;
- `integrityAlgorithm: "HMAC-SHA-256"`, `integrityKeyId`, `payloadDigestAlgorithm: "SHA-256"`, digest of the exact compressed payload, compressed/uncompressed byte counts, table count and row count;
- canonical server-generated `storagePath` and stable `storageProfileId`, both bound to trusted BackupLog context;
- compression `gzip` and optional export metadata that is explicitly non-authoritative.

Payload is structured `{ tables: [{ model, rows }] }`, with model names and scalar field names from the reviewed policy, never SQL text. It contains only row data, not a client-controlled write plan. Before decompression, compare authenticated header fields and the trusted DB `BackupLog` metadata exactly on source log ID, tenant ID, type, created time, format/schema version, key ID, digest, row/table counts, compressed/uncompressed byte counts, canonical storage path, and stable storage-profile ID. The profile resolves only through trusted server configuration; neither request nor artifact selects a store. Path is derived from the server-owned log ID, then compared exactly with both header and persisted log. Copying an artifact to another log or tenant must fail.

### Cryptography and validation order

- Use Node's standard `node:crypto` HMAC-SHA-256, SHA-256, and `timingSafeEqual`; add no crypto dependency and invent no cipher. HMAC authenticates integrity/origin; it does **not** encrypt data. Private storage is required for confidentiality in transit/at rest according to the configured provider.
- Key is a new dedicated random 256-bit secret, never copied from `BLOB_READ_WRITE_TOKEN`, JWT/session secrets, DB credentials, or any existing credential. Suggested deployment contract: secret keyring indexed by opaque `keyId`, with a configured active signing key and old verification keys retained while backups using them must remain restorable. Codec takes explicit injected key/key resolver; it never reads `process.env`. Missing/short/malformed key configuration fails closed at the composition boundary. Key rotation signs new artifacts with active key; restore accepts only allowlisted retained key IDs. Never log key material or MAC input.
- Domain-separate the MAC (e.g. fixed `TCP-TENANT-BACKUP-V2\0` prefix) and authenticate exact `headerBytes` plus exact compressed `payloadBytes` with unambiguous length framing. Verify the stored SHA-256 digest and compare authenticated header to the database log before parsing/decompressing row JSON. Use constant-time MAC comparison after validating equal byte lengths.
- Parsing order: cap total envelope bytes → parse only bounded outer framing → cap/decode base64 lengths → parse bounded header and reject unknown format/key/schema → verify payload digest, HMAC and log context → bounded gzip inflate → verify declared byte/row/table counts → parse payload JSON → validate exact model/column and typed values → validate row ownership/relations → only then enter restore transaction. Never call `gunzipSync` without an output cap; do not buffer unbounded streams.
- Initial conservative limits for a Function-buffered v2 artifact: max outer envelope 64 MiB, compressed payload 40 MiB, uncompressed payload 128 MiB, 100,000 rows total, 25,000 rows per model, and a model count sized to the reviewed policy inventory; check both declared and measured values. The 40 MiB compressed cap leaves room for base64 expansion plus header, MAC, JSON framing, and other envelope overhead; enforce the total measured serialized envelope cap rather than assuming the math is sufficient. Export counts/serialized bytes as it builds and aborts before upload when exceeding limits. Restore enforces the same limits before mutation. These are explicit initial caps, not unlimited or silently truncating; measure representative tenant exports and function memory before enabling. Larger tenant support requires a separately designed streaming/chunked format and bounded restore plan.
- Typed values are schema-driven, not guessed from JSON numbers: Prisma Decimal as exact decimal strings; BigInt as base-10 strings; DateTime as validated ISO UTC strings; bytea/Buffer as base64 bytes; JSON/JSONB represented by a tagged raw-JSON-text cell distinct from SQL NULL; validate its syntax but retain exact text/number lexemes (including exponent notation and integers beyond 2^53) and never use parsed JS numeric values for serialization or restore. Never coerce Decimal/BigInt through JS `number`, never let `JSON.stringify` turn NaN/infinity into null without explicit supported semantics. Decode each field using its policy type; reject invalid/unknown tags and lossy conversions. Tests must prove values beyond 2^53, decimal scale, timestamps and byte arrays roundtrip exactly.

### DB binding fields

Add a small forward migration and Prisma fields to `BackupLog`, all nullable for legacy rows: `storagePath`, `formatVersion`, `dataSchemaVersion`, `artifactDigest`, `integrityKeyId`, `compressedBytes`, `uncompressedBytes`, `rowCount`. Keep legacy `fileUrl`/`fileName` untouched for historical records and old admin workflows; new private objects set provider-independent `storagePath`, digest and format metadata. Do not serialize/restore these backup-control records in a tenant backup. The structured export starts with a generated backup-log ID and `status=running`; the server binds that ID into the header/MAC, uploads to a unique no-overwrite key, then marks `completed` only after storage and metadata are persisted. On failure, mark failed with a sanitized code and best-effort delete only the new object; never report completion on partial upload.

## Server-owned table, column, relation and restore policy

Create a typed policy registry owned by server code. No names/columns from the artifact become SQL identifiers or Prisma delegate names without matching the registry. Each model has exactly one policy state: `tenantReplaceable`, `protectedAppendOnly`, `referenceOnly`, or `excluded`. The policy declares allowed scalar fields, identity/natural keys, direct tenant field or owner relation path, required/optional relation checks, restore order, and whether target records are mutable, append-only, or protected. Use model/column identifiers checked into code; values remain parameterized Prisma inputs.

### Inventory-completeness gate

A code test compares every current generated Prisma model with the registry and requires exactly one explicit state. It fails on any new model or scalar/relation field not reviewed. A second test verifies all serialized columns exist in current Prisma DMMF, excludes forbidden security/global fields, and confirms the registry contains explicit handling for every tenant-owned model. No “all models with `tenantId` are safe” implicit fallback and no default-allow behavior. Maintain a separately reviewed expected tenant-business coverage manifest, independent of DMMF and the implementation registry. Every expected tenant-owned business model must be included or explicitly excluded with a reviewed rationale, data-classification basis, and product impact. Tests must fail both for an unreviewed DMMF model/field and for an expected business model missing from the manifest/registry. Before enabling restore, complete this inventory against the then-current Prisma schema; the list below names key relations, not a claim that inventory is complete.

### Direct tenant models

For a direct `tenantId` policy, export only rows with `tenantId = authenticatedTenantId`; on restore require every row's `tenantId` exactly equals the DB-authorized target tenant and validate any other tenant-owned references agree. Direct tenant key alone is insufficient if another FK can cross tenants.

### Child models with no `tenantId`

These need explicit parent-derived ownership policy, never unscoped table selection:

| Child model(s) | Ownership path/check |
|---|---|
| `VentaItem`, then `DevolucionVentaItem` | `VentaItem.ventaId -> Venta.tenantId`; refund item must resolve through its `DevolucionVenta` and/or referenced sale item to the same tenant-owned `Venta`. Its `productoId` must reference a product owned by that tenant. |
| `OfertaItem` | `ofertaId -> Oferta.tenantId`; optional product/service references must resolve to the same tenant. |
| `ReciboOrdenReparacion` | `ordenId -> OrdenReparacion.tenantId`. |
| `Attendance`, `EmployeeWorkSchedule`, `VacationRequest`, `VacationAccrual` | `employeeId -> Empleado.tenantId`; child references to approving/creating users remain references only. |
| `ContratoVersion`, `ContratoFirma`, `ContratoAprobacion`, `ContratoArchivo`, `ContratoAlerta` | `contratoId -> Contrato.tenantId`; all nested version/file references must agree with that contract. |
| `PrecioProducto` | Both `listaPrecioId -> ListaPrecio.tenantId` and `productoId -> Producto.tenantId` must equal target tenant. |
| `ProductoCostHistory` | `productoId -> Producto.tenantId`; no global history query. |
| `AnticipoMovimiento` | Parent `Anticipo` must have a validated non-null target tenant; reject unowned/global parent rows. |

Any further no-tenant model discovered by the inventory test is a block until it receives an explicit policy; do not infer ownership from creator/user alone. Restore validation resolves relations against the authenticated tenant and either current DB parents or rows staged in the same signed artifact, checking both endpoints. Exports reject contradictory parent/child tenant IDs rather than excluding the mismatch silently.

### Shared, global, security, and reference-only records

- `Tenant`: root identity is the authenticated existing tenant; do not create, rename, update, or delete it. Tenant ID in the signed header is a selector/check, not authority to choose another tenant.
- `User`: never serialize/restore credentials, password hashes, global role, login state, or identity rows. User IDs in tenant rows are references; require the referenced User exists in the target DB. Do not rewrite user IDs or recreate absent users. Tenant restore actor authorization is checked independently.
- `TenantMembership`: security boundary; never add/change/delete memberships or roles. Actor must already have current authorized membership. Historical user references are not a reason to recreate membership.
- `Plan` and `TenantLicense`: global catalog/entitlement state. Never restore plan rows, license entitlements, expiration, quotas, features, demo/admin-test flags or license payments from tenant data. Existing current plan/license remains authoritative.
- Platform referral/commission ledgers, admin identities, auth sessions/tokens, global audit/security logs, global currency/system configuration and backup logs/plans are `excluded` unless a dedicated policy explicitly permits read-only reference. Never include or mutate them as a side effect of tenant restore.
- This means a tenant backup is not a self-contained account migration: it requires the same tenant identity and referenced global User/Plan records already exist in the destination. Cross-tenant cloning and tenant-ID remapping are unsupported.

## Restore safety, FK ordering, and immutable evidence

### Before any write

1. Resolve current actor, tenant and requested `BackupLog` under the existing backup permission scope. Require completed `type=tenant`, matching tenant, non-null new private `storagePath`, and supported metadata. Do not accept a caller-supplied path, URL, filename, tenant or backup type.
2. Fetch artifact from the configured private store by server-held path; authenticate and validate envelope/log binding, type, current schema-policy version, digest, HMAC and all size limits.
3. Validate the entire payload: every model and exact column set, unique record identities, required/null fields, enum membership, scalar tags/types, row counts, target tenant and all relation ownership. Verify all shared identities referenced exist and are used only as references.
4. In a serializable DB transaction, preflight **all** target and incoming identities, scalar payloads, relation ownership, inbound FK edges, protected evidence, and configured merge rules before the first write. An identity with matching typed payload is a no-op. Any same-identity/different-payload row fails closed before writes unless a future explicit model-specific rule is reviewed. Target-only mutable rows are preserved. A target-only/newer protected-evidence row aborts the restore before any write because it proves the backup is stale. Never delete merely because a row is absent from the artifact. A backup-only row may be inserted only after every owner/FK/parent requirement is validated.
5. Only after complete preflight, insert only missing permitted rows in FK-valid parent-first order. Do not use `skipDuplicates`, `ON CONFLICT DO NOTHING`, replica role, trigger disable, raw SQL payload, update/upsert on protected rows, or cascade delete as a substitute for policy. Preserve protected FK parents and children; inspect all inbound FK edges, including non-serialized tables, and block if safety cannot be proven. Use one transaction; any failure rolls back all writes. Do not invoke Blob/network/storage work inside the transaction.

Concurrency design: run the restore transaction at `Serializable`, with a bounded retry only for recognized serialization/deadlock conflicts and a maximum retry count. Lock the tenant root row during the restore as a serialization anchor; still rely on serializable conflict detection for concurrent tenant writes. Do not lock unrelated tenants. Any policy table lacking a stable identity or deterministic parent order blocks restore until designed.

### Immutable and evidence-protected records

Never remove, update, or bypass the existing custom trigger behavior. The following identities/payloads require exact comparison before mutation; trigger-protected rows in the backup but missing from target are insert-only, subject to validated FKs:

- `StockMoveLine`: no UPDATE/DELETE.
- `cash_payment_interest_allocations`: append-only/no UPDATE/DELETE.
- `financial_auxiliary_checkpoints`: immutable UPDATE/DELETE.
- `fx_evidence`: immutable UPDATE/DELETE.
- approved rows in `snapshot_periodos`: immutable UPDATE/DELETE; do not treat unapproved snapshots as approved or vice versa.
- `tenant_accounting_policies.functionalCurrencyCode`: trigger forbids changing this after evidence exists. For tenant restore, conservatively treat the whole policy row as protected: exact match/no-op, insert only if absent and all policy prerequisites permit; any differing or target-only policy evidence fails closed.

The policy/implementation test must assert these trigger names and current definitions are still present/enabled and exercise rejected writes. No session variable such as `session_replication_role=replica` is allowed. The product contract is a data-preserving forward merge, not rollback to an earlier date when newer accounting evidence exists. A separate compensating/replay feature would require a new domain design and approval.

### FK ordering

The policy registry supplies an explicit dependency graph, not implicit model-name sorting, and includes inbound references from protected/non-exported tables. At minimum parent-first inserts for `Tenant`-owned parent-child groups such as `Venta -> VentaItem -> DevolucionVentaItem`, `Oferta -> OfertaItem`, `OrdenReparacion -> ReciboOrdenReparacion`, `Empleado -> attendance/schedule/vacation children`, `Contrato -> contract children`, `ListaPrecio + Producto -> PrecioProducto`, and `Producto -> ProductoCostHistory`. Shared roots (`Tenant`, `User`, `Plan`, membership/license) are not in the write order at all. Actual graph is checked against Prisma relations and fixture FK behavior; cycles require an explicitly reviewed deferred FK/write plan, not disabling constraints.

## Private storage and authenticated download

Official Vercel docs were checked live for this plan: Private Blob is now generally available (not beta), requires a private store, and the JS SDK supports private operations from `@vercel/blob >=2.3`; current docs show `get(pathname, { access: 'private' })` returning a stream and recommend authenticated Function delivery. The current lockfile was previously audited at `@vercel/blob` 2.4.0, so implementation should verify the installed package/lock on its branch but should not add a storage dependency by default. Vercel recommends avoiding Function delivery of files over 100 MB unless traffic is low; the proposed 64 MiB artifact cap stays under that published warning. Private store download costs and actual project limits still require deployment owner review.

- Use a separate newly provisioned **private** Blob store, addressed by an explicit store ID/configuration. A Blob store's access mode is store-level; `access: 'private'` on a put does not make an existing public store private. Private store provisioning/configuration is a separate user-approved external gate; do not create or inspect a store now.
- New artifacts use unique path `tenant-backups/v2/<backupLogId>.tbk`; no overwrite. Store the path, not the provider URL, in `BackupLog.storagePath`. Enforce exact prefix/path grammar on server-generated IDs, never `path.join` caller input, and never accept download path from client.
- Adapter's private mode uses Vercel SDK `put(..., {access:'private', storeId: configuredPrivateStoreId, addRandomSuffix:false})` and `get(path,{access:'private',storeId})`; function auth/OIDC or scoped store credential comes from later approved environment setup. Map SDK failures to sanitized errors. The app route returns a stream only after actor/tenant/log authorization and emits safe `Content-Type`, `Content-Disposition` based on server-generated log ID, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`.
- New download route is keyed by `backupLogId`, not path/URL. It resolves log authorization first; foreign/missing IDs return the same not-found response before Blob `get`. Provider URL, read token, pathname, digest, and key ID do not leak in API output. Respect stream abort and report safe telemetry.
- Existing public objects remain publicly readable by anyone who has their URL. New code cannot retroactively make those objects private. Do not migrate/delete public artifacts in this scope. Stop returning legacy provider URLs from tenant actions; classify old objects as `legacyPublic` and either proxy only known trusted storage origins through an authorized route (with explicit warning that direct old URL remains public) or deny tenant download until a separately approved object migration. Never claim old public files became private.
- Prefer authenticated streaming with the documented SDK `get()` API for the capped artifact size. Presigned private GET URLs are a later, narrowly scoped alternative only if traffic/function cost requires it; any such URL is a temporary bearer capability, so must be minted after the same log authorization, one path + GET operation + short expiry, and never be logged. This plan chooses authenticated streaming first.

## Work slices and exact implementation ownership

Each code/test/migration slice should stay at or below roughly 400 changed lines. If a domain policy exceeds that, split by model group and keep the registry coverage test failing until the complete inventory lands. Use strict TDD: test RED evidence first, implement minimum GREEN, then focused improve; mocked Prisma for unit tests, actual DB tests only under `src/**/__integration__/` with the dedicated config.

| Slice | Owned files / boundary | Exit checkpoint |
|---|---|---|
| 0. Preserve fail-closed boundary | `src/features/backups/actions.ts`, `restore-engine.ts`, focused existing action/restore tests | Implemented locally and approved by fresh independent review. Tests show tenant restore rejects before storage parsing/DB write; admin full/imported path tests remain distinct. No SQL parser work. |
| 1. Pure codec only (first implementation slice, <=400 lines) | New `src/features/backups/tenant-backup/codec.ts`; new `src/features/backups/__tests__/tenant-backup-codec.test.ts`; types colocated or one small format-types file | Explicit injected key + injected limits; no Prisma, env, Blob or filesystem import. Tests RED first for header/payload/MAC/log/tenant/path/profile/key/schema tampering, corrupt payload, gzip bomb and measured envelope/payload/count limits. Typed cells must preserve exact Decimal/BigInt/Date/bytea representations without lossy JS-number conversion; raw JSON integers beyond 2^53 are not accepted as lossless data. Codec is independently useful but is not wired to restore or enabled. |
| 2. Server-owned policy inventory/export | New `src/features/backups/tenant-backup/policy.ts` and focused test; `src/features/backups/data-exporter.ts`; focused exporter tests | Every DMMF model has explicit state and is checked against an independent expected tenant-business coverage manifest; explicit scalar columns and relation owner path. Every exclusion has rationale and product impact. Tests prove owner filters/parent joins, shared/global exclusions, field coverage and mismatch rejection. The latest read-only schema inventory reports 155 Prisma models and 107 tenant-business candidates; two ownership paths and six FK cycles remain unresolved in `/tmp/tcp-qa-20261021/reconciliation/tenant-backup-policy-inventory.md`. The injected codec model-count limit must be explicitly sized to the reviewed scope (at least 155 for the current complete schema), with table/memory overhead bounded; never use a limit to silently omit models. This inventory is not policy approval and must not be used to implement exporter/restore policy until reviewed. Export creates signed structured payload only. |
| 3. Metadata contract migration | Additive `BackupLog` fields in `prisma/schema.prisma`, one numbered migration, Prisma schema/migration tests | Nullable metadata leaves legacy rows intact; no table/column drops; target test proves path/digest/log/key/schema binding. Migration locally replayable; no production DB. |
| 4. Restore preflight + transaction (split if >400 lines) | New `src/features/backups/tenant-backup/restore-policy.ts` or planner; `src/features/backups/restore-engine.ts`; focused restore tests | Full policy/FK/protected-set preflight completes before first write; preserve target-only rows; same-identity/different-payload conflicts fail closed; serializable one transaction; parent-first insert only; no SQL execution, replica role, `skipDuplicates`, or protected update/delete. Restore disabled if inventory is incomplete. |
| 5. Private storage adapter | `src/features/backups/storage/types.ts`, `blob-storage.ts`, new adapter tests | Separate private store ID; use documented private `get()` stream API, no public URL return for new records; mocked SDK tests for access mode/path containment/stream errors. No Blob calls in unit suite. |
| 6. Authenticated download and action wiring | `src/features/backups/actions.ts`, new `src/app/api/backups/[backupLogId]/download/route.ts`, action/route tests | Auth/log scope before Blob get; foreign/missing ID gives not-found; no caller path or provider URL; fixed safe headers. Admin local/full download remains separate. |
| 7. Engine integration / enablement | `src/features/backups/backup-engine.ts`, `restore-engine.ts`, `sql-builder.ts` only to keep tenant branch separated; engine tests | Create log ID first; structured tenant export to private storage; current old tenant SQL restore remains blocked; full/imported admin SQL flow unchanged; feature flag stays off until all local gates pass. |
| 8. Isolated DB roundtrip + security review | New `src/features/backups/__integration__/tenant-backup-roundtrip.test.ts`; trigger/FK test suite; fresh-context reviewer | Fixtures prove isolated tenant roundtrip, cross-tenant rejection, exact protected evidence, missing insert-only evidence, stale target-only reject before mutable writes, all triggers intact. Clean fixture teardown. Only then propose enabling. |

No new paid crypto dependency or Vercel resource is part of these slices. Avoid combining this work with unrelated backup plans, cron, prune, or earlier repair/schema changes.

## Verification commands and evidence

These commands are implementation checkpoints; the current codec-specific validation evidence is recorded separately in the reconciliation log directory.

- Unit tests, with Prisma mocked and no live DB:
  - `pnpm exec vitest run src/features/backups/__tests__/tenant-backup-codec.test.ts`
  - `pnpm exec vitest run src/features/backups/__tests__/tenant-backup-policy.test.ts src/features/backups/__tests__/data-exporter.test.ts`
  - `pnpm exec vitest run src/features/backups/__tests__/restore-engine.test.ts src/features/backups/__tests__/actions.test.ts`
  - `pnpm exec vitest run src/features/backups/storage/__tests__/blob-storage.test.ts src/app/api/backups/[backupLogId]/download/__tests__/route.test.ts`
- Focused static checks after code changes: `pnpm exec eslint <changed-files>`; `pnpm exec prisma validate` with only a safe local test env if schema requires `DATABASE_URL`; do not read restricted `.env`, `.env.local`, or `prisma/.env`.
- DB integration only in the dedicated isolated test configuration and disposable local database:
  - `DATABASE_URL_TEST=postgresql://postgres:test@localhost:5433/test_db pnpm test:integration -- src/features/backups/__integration__/tenant-backup-roundtrip.test.ts`
  - Existing project rule: all unit tests mock `@/lib/prisma`; real-DB fixtures live in `__integration__`; never run a DB test against staging or production.
- Fresh-context security review after restore and route wiring: verify no `session_replication_role`, trigger toggling, arbitrary SQL, `ON CONFLICT DO NOTHING`, path/URL input, public provider URL response, shared identity writes, or non-tenant deletes. Review each <=400-line slice before merging; no commit/push authorized here.
- No E2E against Cloud, no test against a live Blob store, no cloud store creation, no secret provisioning, no `vercel env pull`, and no migration application to staging/production in this design.

## Enablement / external gates

Tenant restore stays unavailable until: (1) full DMMF-to-policy inventory coverage passes; (2) all immutable trigger/FK tests pass and the security reviewer signs off; (3) local DB fixture roundtrip and stale-snapshot rejection pass; (4) a dedicated HMAC keyring is generated/configured in the approved secret system, without copying an existing key; (5) an owner separately approves/configures the new private Blob store and its project environment binding; and (6) current handler/action E2E passes in an explicitly authorized non-production environment. No previous public artifacts are migrated by default. Failure at any gate means tenant restore remains disabled, not a fallback to legacy tenant SQL.

## Official Vercel API evidence (checked 2026-10-22)

- Private Blob is GA and private store operations require auth; docs currently show SDK `get(pathname, { access: 'private' })`, Function streaming and OIDC. [Private Storage](https://vercel.com/docs/vercel-blob/private-storage), [Private Blob GA changelog](https://vercel.com/changelog/vercel-private-blob-is-now-generally-available).
- Official limits guidance says not to serve private Blob files larger than 100 MB through Functions unless traffic is low; the proposal caps the envelope at 64 MiB. [Private Storage download charges](https://vercel.com/docs/vercel-blob/private-storage#download-charges).
- Signed URLs are now available and scoped by operation/path/expiration, but this plan chooses the authenticated stream route first. [Vercel Private Blob GA signed URL guidance](https://vercel.com/changelog/vercel-private-blob-is-now-generally-available), [JS SDK `get()` and signed URL reference](https://vercel.com/docs/vercel-blob/using-blob-sdk).
