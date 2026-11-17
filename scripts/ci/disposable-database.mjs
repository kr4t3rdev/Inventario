import helper from './disposable-database.cjs';

export const {
  assertDisposableDatabase,
  assertDisposableDatabaseIdentity,
} = helper;

/**
 * @description Confirm the connected database matches the explicitly approved client target.
 * PostgreSQL may report a container/bridge address from inet_server_addr() even when the
 * configured client URL is loopback, so only database, role and server port identify the target.
 * @param {{ databaseName: string, roleName: string, serverPort: number }} identity
 *   Connected DB identity.
 * @param {Record<string, string | undefined>} env Explicit process environment.
 * @returns {void}
 */
